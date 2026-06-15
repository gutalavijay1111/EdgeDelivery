from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

urlpatterns = [
    path("health/", lambda r: JsonResponse({"status": "ok"})),
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/", include("apps.content.urls")),
]
