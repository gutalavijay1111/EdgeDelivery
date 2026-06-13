import logging
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import boto3
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)

# poster_generators is at the project root — already on sys.path via settings/base.py,
# but guard in case the worker was started without loading Django settings first.
_project_root = Path(__file__).resolve().parents[3]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_poster(self, content_id: str):
    from apps.content.models import Content
    from poster_generators.netflix_style_poster import (
        DEFAULT_EMOTION,
        EMOTION_STYLES,
        ensure_font,
        extract_accent_color,
        get_concept,
        render_background,
        render_thumbnail,
    )
    from PIL import Image

    content = Content.objects.select_related("country").get(id=content_id)
    content.status = Content.STATUS_PROCESSING
    content.save(update_fields=["status"])

    s3 = boto3.client("s3", region_name=settings.AWS_REGION)
    bucket = settings.AWS_S3_BUCKET

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            raw_path = os.path.join(tmpdir, "raw.jpg")
            s3.download_file(bucket, content.raw_s3_key, raw_path)

            os.environ.setdefault("GOOGLE_API_KEY", settings.GOOGLE_API_KEY)
            concept = get_concept(raw_path)
            emotion = concept.get("emotion", DEFAULT_EMOTION)
            style = EMOTION_STYLES.get(emotion, EMOTION_STYLES[DEFAULT_EMOTION])
            accent = extract_accent_color(Image.open(raw_path))

            ensure_font(style["title_font"])
            ensure_font(style["tagline_font"])

            thumb_path = os.path.join(tmpdir, "thumbnail.jpg")
            bg_path = os.path.join(tmpdir, "background.jpg")
            render_thumbnail(raw_path, concept, accent, style, thumb_path)
            render_background(raw_path, concept, accent, style, bg_path)

            thumb_key = f"processed/{content_id}/thumbnail.jpg"
            bg_key = f"processed/{content_id}/background.jpg"
            for local, key in [(thumb_path, thumb_key), (bg_path, bg_key)]:
                s3.upload_file(
                    local,
                    bucket,
                    key,
                    ExtraArgs={"ContentType": "image/jpeg", "CacheControl": "max-age=31536000"},
                )

            cdn = settings.CDN_DOMAIN
            title = f"{concept.get('title_line1', '')} {concept.get('title_line2', '')}".strip()
            content.thumbnail_url = f"https://{cdn}/{thumb_key}"
            content.background_url = f"https://{cdn}/{bg_key}"
            content.title = title
            content.poster_metadata = concept
            content.status = Content.STATUS_READY
            content.processed_at = datetime.now(timezone.utc)
            content.save()

            _invalidate_cloudfront([f"/{thumb_key}", f"/{bg_key}"], content_id)

    except Exception as exc:
        logger.exception("Poster generation failed for content %s", content_id)
        Content.objects.filter(id=content_id).update(status=Content.STATUS_FAILED)
        raise self.retry(exc=exc)


def _invalidate_cloudfront(paths: list[str], caller_ref: str):
    dist_id = settings.CLOUDFRONT_DISTRIBUTION_ID
    if not dist_id:
        return
    try:
        cf = boto3.client("cloudfront", region_name=settings.AWS_REGION)
        cf.create_invalidation(
            DistributionId=dist_id,
            InvalidationBatch={
                "Paths": {"Quantity": len(paths), "Items": paths},
                "CallerReference": caller_ref,
            },
        )
    except Exception:
        logger.warning("CloudFront invalidation failed for %s", paths, exc_info=True)
