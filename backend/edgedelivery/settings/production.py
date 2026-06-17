import environ

from .base import *  # noqa: F401, F403

env = environ.Env()

DEBUG = False
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

DATABASES = {
    "default": env.db("DATABASE_URL")
}

# Celery — SQS broker for production
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="sqs://")
CELERY_BROKER_TRANSPORT_OPTIONS = {
    "region": env("AWS_REGION", default="us-east-1"),
    "predefined_queues": {
        "celery": {
            "url": env("SQS_QUEUE_URL", default=""),
        }
    },
    "visibility_timeout": 3600,
}
# No result backend needed in production — tasks are fire-and-forget;
# status is tracked in the Content DB record instead.
CELERY_TASK_IGNORE_RESULT = True

# AWS
AWS_REGION = env("AWS_REGION", default="us-east-1")
AWS_S3_BUCKET = env("AWS_S3_BUCKET")
CDN_DOMAIN = env("CDN_DOMAIN")
CLOUDFRONT_DISTRIBUTION_ID = env("CLOUDFRONT_DISTRIBUTION_ID", default="")

# Auth
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")
GOOGLE_API_KEY = env("GOOGLE_API_KEY", default="")
UNSPLASH_ACCESS_KEY = env("UNSPLASH_ACCESS_KEY", default="")

# Security hardening
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
