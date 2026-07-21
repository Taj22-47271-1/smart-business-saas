from django.contrib import admin

from apps.subscriptions.models import Subscription, SubscriptionPlan


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "price",
        "interval",
        "max_products",
        "max_staff",
        "has_reports",
        "has_online_shop",
        "has_pdf_invoice",
        "is_active",
    )
    list_filter = ("interval", "is_active")
    search_fields = ("name",)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "plan",
        "status",
        "trial_start_date",
        "trial_end_date",
        "subscription_start_date",
        "subscription_end_date",
        "is_locked",
    )
    list_filter = ("status", "is_locked")
    search_fields = ("business__name",)
    ordering = ("-created_at",)