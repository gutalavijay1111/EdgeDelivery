from django.urls import path

from . import views

urlpatterns = [
    path("content/my/", views.MyContentView.as_view(), name="my-content"),
    path("content/upload/presigned/", views.PresignedUploadView.as_view(), name="presigned-upload"),
    path("content/upload/confirm/", views.ConfirmUploadView.as_view(), name="confirm-upload"),
    path("content/upload/from-url/", views.FetchFromUrlView.as_view(), name="fetch-from-url"),
    path("content/<uuid:content_id>/", views.DeleteContentView.as_view(), name="delete-content"),
    path("content/<uuid:content_id>/status/", views.ContentStatusView.as_view(), name="content-status"),
    path("content/<uuid:content_id>/stream/", views.ContentStreamView.as_view(), name="content-stream"),
    path("explore/", views.ExploreView.as_view(), name="explore"),
    path("explore/<str:country_code>/", views.ExploreCountryView.as_view(), name="explore-country"),
]
