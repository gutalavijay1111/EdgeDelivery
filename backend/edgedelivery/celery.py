import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "edgedelivery.settings.local")

app = Celery("edgedelivery")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
