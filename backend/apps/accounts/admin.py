from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.accounts.models import PasswordResetOTP, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = (
        "id",
        "email",
        "username",
        "phone",
        "role",
        "is_active",
        "is_staff",
        "created_at",
    )
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    search_fields = ("email", "username", "phone")
    ordering = ("-created_at",)

    fieldsets = UserAdmin.fieldsets + (
        (
            "Extra Information",
            {
                "fields": (
                    "phone",
                    "role",
                    "is_email_verified",
                    "is_phone_verified",
                )
            },
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Extra Information",
            {
                "fields": (
                    "email",
                    "phone",
                    "role",
                )
            },
        ),
    )


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "email",
        "otp",
        "is_used",
        "expires_at",
        "created_at",
    )
    list_filter = ("is_used", "created_at", "expires_at")
    search_fields = ("user__email", "email", "otp")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)