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
    avatar_url = models.URLField(blank=True)

    class Meta:
        db_table = "users"
