import json
import logging
import os
import time
import uuid

import boto3
import requests as http_requests
from django.conf import settings
from django.db.models import Count, Q
from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request as DRFRequest
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .models import Content, Country
from .serializers import ContentSerializer, ContentStatusSerializer, CountrySerializer
from .tasks import fetch_and_store_image, generate_poster

logger = logging.getLogger(__name__)

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


def _fetch_unsplash_url(keyword: str = "") -> str:
    key = getattr(settings, "UNSPLASH_ACCESS_KEY", "")
    if not key:
        raise ValueError("UNSPLASH_ACCESS_KEY not configured")
    params = {"orientation": "landscape", "content_filter": "high"}
    if keyword:
        params["query"] = keyword
    resp = http_requests.get(
        "https://api.unsplash.com/photos/random",
        headers={"Authorization": f"Client-ID {key}"},
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["urls"]["regular"]


class FetchFromUrlView(APIView):
    """
    POST /api/content/upload/from-url/
    Body: { country, source: "url"|"unsplash", url?, unsplash_keyword? }

    Queues a Celery task to download the image and generate a poster.
    The client should open the SSE stream endpoint to track progress.
    """

    def post(self, request):
        country_code = request.data.get("country", "").upper()
        source = request.data.get("source", "")
        url = request.data.get("url", "").strip()
        keyword = request.data.get("unsplash_keyword", "").strip()

        country = get_object_or_404(Country, code=country_code)

        if source == "url":
            if not url:
                return Response({"error": "url is required"}, status=status.HTTP_400_BAD_REQUEST)
            if not url.startswith(("http://", "https://")):
                return Response({"error": "url must start with http:// or https://"}, status=status.HTTP_400_BAD_REQUEST)
        elif source == "unsplash":
            try:
                url = _fetch_unsplash_url(keyword)
            except Exception:
                logger.exception("Unsplash fetch failed")
                return Response(
                    {"error": "Failed to fetch image from Unsplash. Try again."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        else:
            return Response({"error": "source must be 'url' or 'unsplash'"}, status=status.HTTP_400_BAD_REQUEST)

        content_id = uuid.uuid4()
        Content.objects.create(
            id=content_id,
            country=country,
            raw_s3_key="",
            source="user",
            uploaded_by=request.user,
            status=Content.STATUS_PENDING,
        )

        fetch_and_store_image.delay(str(content_id), url)

        return Response({"content_id": str(content_id)}, status=status.HTTP_201_CREATED)


def _jwt_user(django_request):
    """Authenticate a plain Django request via JWT Bearer token."""
    drf_request = DRFRequest(django_request)
    try:
        result = JWTAuthentication().authenticate(drf_request)
        return result[0] if result else None
    except (InvalidToken, TokenError):
        return None


@method_decorator(csrf_exempt, name="dispatch")
class ContentStreamView(View):
    """
    GET /api/content/<uuid>/stream/

    SSE endpoint — streams status updates every 2 s until the content
    reaches a terminal state (ready / failed).  Max ~5 minutes.
    """

    def get(self, request, content_id):
        user = _jwt_user(request)
        if user is None:
            return HttpResponse("Unauthorized", status=401)

        def event_stream():
            for _ in range(150):
                try:
                    content = Content.objects.get(id=content_id, uploaded_by=user)
                    yield "data: {}\n\n".format(
                        json.dumps(
                            {
                                "status": content.status,
                                "thumbnail_url": content.thumbnail_url or "",
                                "background_url": content.background_url or "",
                            }
                        )
                    )
                    if content.status in (Content.STATUS_READY, Content.STATUS_FAILED):
                        break
                except Content.DoesNotExist:
                    yield 'data: {"status":"failed","error":"not found"}\n\n'
                    break
                time.sleep(2)

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class DeleteContentView(APIView):
    """
    DELETE /api/content/<uuid>/

    Deletes the Content record and all associated S3 objects (raw upload +
    processed thumbnail + background).  Only the owner can delete.
    """

    def delete(self, request, content_id):
        content = get_object_or_404(Content, id=content_id, uploaded_by=request.user)
        s3 = boto3.client("s3", region_name=settings.AWS_REGION)
        keys = [k for k in [
            content.raw_s3_key,
            f"processed/{content_id}/thumbnail.jpg",
            f"processed/{content_id}/background.jpg",
        ] if k]
        if keys:
            try:
                s3.delete_objects(
                    Bucket=settings.AWS_S3_BUCKET,
                    Delete={"Objects": [{"Key": k} for k in keys], "Quiet": True},
                )
            except Exception:
                logger.warning("S3 delete failed for content %s", content_id, exc_info=True)
        content.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
