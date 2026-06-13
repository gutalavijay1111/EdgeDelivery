import uuid

from django.db import models

from apps.users.models import User


class Country(models.Model):
    code = models.CharField(max_length=2, primary_key=True)
    name = models.CharField(max_length=100)

    class Meta:
        verbose_name_plural = "countries"
        db_table = "countries"

    def __str__(self):
        return f"{self.name} ({self.code})"


class Content(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_READY = "ready"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_READY, "Ready"),
        (STATUS_FAILED, "Failed"),
    ]
    SOURCE_CHOICES = [
        ("user", "User Upload"),
        ("wikimedia", "Wikimedia Commons"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    country = models.ForeignKey(Country, on_delete=models.PROTECT, related_name="content")
    title = models.CharField(max_length=500, blank=True)
    raw_s3_key = models.CharField(max_length=500)
    thumbnail_url = models.URLField(blank=True)
    background_url = models.URLField(blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="user")
    uploaded_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="uploads"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    poster_metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "content"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title or self.id} [{self.country_id}] ({self.status})"
