import environ
from pathlib import Path

# Read .env before importing base so env() calls in base see the values
_base_dir = Path(__file__).resolve().parent.parent.parent
environ.Env.read_env(_base_dir / ".env")

from .base import *  # noqa: F401, F403

env = environ.Env()

DEBUG = True
SECRET_KEY = env("SECRET_KEY", default="local-dev-secret-key-change-before-any-deployment")
ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True

DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://postgres:postgres@localhost:5432/edgedelivery")
}

# Celery — Redis broker for local dev
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/0")

# AWS
AWS_REGION = env("AWS_REGION", default="ap-south-1")
AWS_S3_BUCKET = env("AWS_S3_BUCKET", default="")
CDN_DOMAIN = env("CDN_DOMAIN", default="")
CLOUDFRONT_DISTRIBUTION_ID = env("CLOUDFRONT_DISTRIBUTION_ID", default="")

# Auth
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")
GOOGLE_API_KEY = env("GOOGLE_API_KEY", default="")
UNSPLASH_ACCESS_KEY = env("UNSPLASH_ACCESS_KEY", default="")
