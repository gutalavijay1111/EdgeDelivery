from django.urls import path

from . import views

urlpatterns = [
    path("content/my/", views.MyContentView.as_view(), name="my-content"),
    path("content/upload/presigned/", views.PresignedUploadView.as_view(), name="presigned-upload"),
    path("content/upload/confirm/", views.ConfirmUploadView.as_view(), name="confirm-upload"),
    path("content/<uuid:content_id>/status/", views.ContentStatusView.as_view(), name="content-status"),
    path("explore/", views.ExploreView.as_view(), name="explore"),
    path("explore/<str:country_code>/", views.ExploreCountryView.as_view(), name="explore-country"),
]
