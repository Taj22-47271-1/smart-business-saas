from django.contrib import admin

from apps.businesses.models import Business, BusinessMember


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "owner",
        "phone",
        "email",
        "status",
        "is_active",
        "created_at",
    )
    list_filter = ("status", "is_active", "created_at")
    search_fields = ("name", "slug", "phone", "email", "owner__email")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("-created_at",)


@admin.register(BusinessMember)
class BusinessMemberAdmin(admin.ModelAdmin):
    list_display = ("business", "user", "role", "status", "joined_at")
    list_filter = ("role", "status")
    search_fields = ("business__name", "user__email", "user__username")
