from django.contrib import admin

from apps.auditlog.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "user",
        "action",
        "model_name",
        "object_id",
        "ip_address",
        "created_at",
    )
    list_filter = ("action", "created_at")
    search_fields = (
        "business__name",
        "user__email",
        "model_name",
        "object_id",
        "description",
    )
    readonly_fields = (
        "business",
        "user",
        "action",
        "model_name",
        "object_id",
        "description",
        "ip_address",
        "user_agent",
        "created_at",
    )
    ordering = ("-created_at",)