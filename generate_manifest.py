import json
import os
from datetime import datetime, timezone

IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.gif')
REGIONS = {'JP': 'Japan', 'US': 'United States', 'IN': 'India', 'NL': 'Netherlands'}
BUCKET = os.environ.get('S3_BUCKET')


def list_images(region_code):
    if BUCKET:
        return _list_s3(region_code)
    return _list_local(region_code)


def _list_local(region_code):
    folder = f'data/{region_code}'
    if not os.path.isdir(folder):
        return []
    return [
        f"{folder}/{f}"
        for f in sorted(os.listdir(folder))
        if f.lower().endswith(IMAGE_EXTS)
    ]


def _list_s3(region_code):
    import boto3
    client = boto3.client('s3')
    paginator = client.get_paginator('list_objects_v2')
    keys = []
    for page in paginator.paginate(Bucket=BUCKET, Prefix=f'data/{region_code}/'):
        for obj in page.get('Contents', []):
            if obj['Key'].lower().endswith(IMAGE_EXTS):
                keys.append(obj['Key'])
    return sorted(keys)


def write_manifest(path, region_code, region_name, images):
    manifest = {
        'region': region_code,
        'region_name': region_name,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'images': images,
    }
    with open(path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f'  {path}: {len(images)} images')


print('Generating manifests...')
all_images = []

for code, name in REGIONS.items():
    images = list_images(code)
    write_manifest(f'manifest-{code}.json', code, name, images)
    all_images.extend(images)

write_manifest('manifest.json', 'GLOBAL', 'Global', all_images)
