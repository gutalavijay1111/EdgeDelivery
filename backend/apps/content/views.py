import os
import uuid

import boto3
from django.conf import settings
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Content, Country
from .serializers import ContentSerializer, ContentStatusSerializer, CountrySerializer
from .tasks import generate_poster

_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


class PresignedUploadView(APIView):
    """
    GET /api/content/upload/presigned/?filename=photo.jpg&country=JP

    Returns a presigned S3 PUT URL valid for 5 minutes.
    A Content record (status=pending) is created immediately so the
    confirm step can find it.
    """

    def get(self, request):
        filename = request.query_params.get("filename", "")
        country_code = request.query_params.get("country", "").upper()

        ext = os.path.splitext(filename)[1].lower()
        if ext not in _ALLOWED_EXTENSIONS:
            return Response(
                {"error": f"Unsupported file type. Allowed: {', '.join(_ALLOWED_EXTENSIONS)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        country = get_object_or_404(Country, code=country_code)

        content_id = uuid.uuid4()
        raw_key = f"raw/{country_code}/{content_id}{ext}"

        s3 = boto3.client("s3", region_name=settings.AWS_REGION)
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.AWS_S3_BUCKET,
                "Key": raw_key,
                "ContentType": _CONTENT_TYPES[ext],
            },
            ExpiresIn=300,
        )

        Content.objects.create(
            id=content_id,
            country=country,
            raw_s3_key=raw_key,
            source="user",
            uploaded_by=request.user,
            status=Content.STATUS_PENDING,
        )

        return Response(
            {"content_id": str(content_id), "upload_url": upload_url, "key": raw_key}
        )


class ConfirmUploadView(APIView):
    """
    POST /api/content/upload/confirm/
    Body: { "content_id": "uuid" }

    Called by the frontend after the direct-to-S3 upload completes.
    Kicks off the Celery poster generation task.
    """

    def post(self, request):
        content_id = request.data.get("content_id")
        content = get_object_or_404(
            Content,
            id=content_id,
            uploaded_by=request.user,
            status=Content.STATUS_PENDING,
        )
        content.status = Content.STATUS_PROCESSING
        content.save(update_fields=["status"])
        generate_poster.delay(str(content.id))
        return Response({"status": "processing", "content_id": str(content.id)})


class ContentStatusView(APIView):
    """
    GET /api/content/<uuid>/status/

    Frontend polls this to know when the poster is ready.
    """

    def get(self, request, content_id):
        content = get_object_or_404(Content, id=content_id, uploaded_by=request.user)
        return Response(ContentStatusSerializer(content).data)


class MyContentView(APIView):
    """
    GET /api/content/my/
    Returns all content uploaded by the authenticated user, newest first.
    """

    def get(self, request):
        content = (
            Content.objects.filter(uploaded_by=request.user)
            .order_by("-created_at")
            .select_related("country")
        )
        return Response(ContentSerializer(content, many=True).data)


class ExploreView(APIView):
    """
    GET /api/explore/

    Lists all countries with a count of ready content.
    Public — no auth required.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        countries = Country.objects.annotate(
            content_count=Count("content", filter=Q(content__status=Content.STATUS_READY))
        )
        return Response(CountrySerializer(countries, many=True).data)


class ExploreCountryView(APIView):
    """
    GET /api/explore/<country_code>/

    Returns all ready content for a country.  Images are served via
    CloudFront CDN — the URLs in the response are already CDN URLs.
    Public — no auth required.
    """

    permission_classes = [AllowAny]

    def get(self, request, country_code):
        country = get_object_or_404(Country, code=country_code.upper())
        content = Content.objects.filter(
            country=country, status=Content.STATUS_READY
        ).select_related("uploaded_by")
        return Response(
            {
                "country": country.code,
                "country_name": country.name,
                "content": ContentSerializer(content, many=True).data,
            }
        )
