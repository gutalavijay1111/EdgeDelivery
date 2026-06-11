import json
import os
import boto3
from datetime import datetime, timezone

s3 = boto3.client("s3")
cf = boto3.client("cloudfront")

BUCKET = os.environ["S3_BUCKET"]
CF_DIST_ID = os.environ.get("CLOUDFRONT_DISTRIBUTION_ID", "")
ALLOWED_REGIONS = {"JP", "US", "IN", "NL"}
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")
REGION_NAMES = {
    "JP": "Japan", "US": "United States", "IN": "India", "NL": "Netherlands"
}

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = "/" + event.get("rawPath", "/").lstrip("/")

    # OPTIONS is handled by the Lambda Function URL CORS config — no need to intercept it
    if path == "/upload" and method == "GET":
        return _handle_upload(event)
    if path == "/manifest" and method == "POST":
        return _handle_manifest(event)
    return _resp(404, {"error": "not found"})


def _handle_upload(event):
    params = event.get("queryStringParameters") or {}
    filename = os.path.basename(params.get("filename", ""))
    region = params.get("region", "").upper()

    if region not in ALLOWED_REGIONS:
        return _resp(400, {"error": f"region must be one of {sorted(ALLOWED_REGIONS)}"})
    if not filename or not filename.lower().endswith(IMAGE_EXTS):
        return _resp(400, {"error": "filename must end with .jpg/.jpeg/.png/.webp"})

    ext = filename.rsplit(".", 1)[-1].lower()
    content_type = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "webp": "image/webp",
    }.get(ext, "image/jpeg")

    key = f"data/{region}/{filename}"
    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    return _resp(200, {"url": presigned_url, "key": key, "content_type": content_type})


def _handle_manifest(event):
    params = event.get("queryStringParameters") or {}
    region = params.get("region", "").upper()
    regions = [region] if region in ALLOWED_REGIONS else list(ALLOWED_REGIONS)

    all_images = []
    now = datetime.now(timezone.utc).isoformat()
    paginator = s3.get_paginator("list_objects_v2")

    for code in regions:
        keys = []
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f"data/{code}/"):
            for obj in page.get("Contents", []):
                if obj["Key"].lower().endswith(IMAGE_EXTS):
                    keys.append(obj["Key"])
        keys.sort()
        all_images.extend(keys)

        manifest = {
            "region": code,
            "region_name": REGION_NAMES[code],
            "generated_at": now,
            "images": keys,
        }
        s3.put_object(
            Bucket=BUCKET, Key=f"manifest-{code}.json",
            Body=json.dumps(manifest, indent=2).encode(),
            ContentType="application/json", CacheControl="no-cache",
        )

    if not region:
        global_manifest = {
            "region": "GLOBAL", "region_name": "Global",
            "generated_at": now, "images": sorted(all_images),
        }
        s3.put_object(
            Bucket=BUCKET, Key="manifest.json",
            Body=json.dumps(global_manifest, indent=2).encode(),
            ContentType="application/json", CacheControl="no-cache",
        )

    if CF_DIST_ID:
        paths = [f"/manifest-{r}.json" for r in regions]
        if not region:
            paths.append("/manifest.json")
        cf.create_invalidation(
            DistributionId=CF_DIST_ID,
            InvalidationBatch={
                "Paths": {"Quantity": len(paths), "Items": paths},
                "CallerReference": str(datetime.now().timestamp()),
            },
        )

    return _resp(200, {"ok": True, "refreshed": regions})


def _resp(status, body):
    r = {"statusCode": status, "headers": {"Content-Type": "application/json"}}
    if body is not None:
        r["body"] = json.dumps(body)
    return r
