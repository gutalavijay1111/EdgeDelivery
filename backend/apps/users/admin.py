from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "country", "google_id", "is_staff", "date_joined")
    list_filter = ("country", "is_staff", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("EdgeDelivery", {"fields": ("country", "google_id", "avatar_url")}),
    )
