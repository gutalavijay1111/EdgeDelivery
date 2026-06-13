from rest_framework import serializers

from .models import Content, Country


class CountrySerializer(serializers.ModelSerializer):
    content_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Country
        fields = ("code", "name", "content_count")


class ContentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.StringRelatedField()

    class Meta:
        model = Content
        fields = (
            "id",
            "title",
            "thumbnail_url",
            "background_url",
            "source",
            "status",
            "uploaded_by",
            "poster_metadata",
            "created_at",
            "processed_at",
        )


class ContentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Content
        fields = ("id", "status", "thumbnail_url", "background_url")
