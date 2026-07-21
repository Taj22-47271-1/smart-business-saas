from django.contrib import admin

from apps.chat.models import SupportMessage, SupportThread


@admin.register(SupportThread)
class SupportThreadAdmin(admin.ModelAdmin):
    list_display = ("business", "member", "created_by", "updated_at")
    search_fields = ("business__name", "member__email")


@admin.register(SupportMessage)
class SupportMessageAdmin(admin.ModelAdmin):
    list_display = ("thread", "sender", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
    search_fields = ("body", "sender__email")
