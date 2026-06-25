from django.contrib.auth.models import AbstractUser
from django.db import models

COUNTRY_CHOICES = [
    ("JP", "Japan"),
    ("US", "United States"),
    ("IN", "India"),
    ("NL", "Netherlands"),
]


class User(AbstractUser):
    country = models.CharField(max_length=2, choices=COUNTRY_CHOICES, blank=True, default="")
    google_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    avatar_url = models.URLField(blank=True, max_length=500)
    is_guest = models.BooleanField(default=False)
    # SHA-256 of "{ip}:{SECRET_KEY}" — one guest account per IP
    guest_ip_hash = models.CharField(max_length=64, blank=True, null=True, unique=True)

    class Meta:
        db_table = "users"
