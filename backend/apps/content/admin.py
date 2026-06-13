from django.contrib import admin

from .models import Content, Country


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("code", "name")


@admin.register(Content)
class ContentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "country", "source", "status", "uploaded_by", "created_at")
    list_filter = ("status", "source", "country")
    search_fields = ("title", "uploaded_by__username")
    readonly_fields = ("id", "created_at", "processed_at", "poster_metadata")
    actions = ["retry_failed"]

    @admin.action(description="Retry poster generation for selected items")
    def retry_failed(self, request, queryset):
        from .tasks import generate_poster

        for content in queryset.filter(status=Content.STATUS_FAILED):
            content.status = Content.STATUS_PENDING
            content.save(update_fields=["status"])
            generate_poster.delay(str(content.id))
        self.message_user(request, f"Re-queued {queryset.count()} item(s).")
