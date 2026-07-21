from django.contrib import admin

from apps.payments.models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "user",
        "plan",
        "amount",
        "payment_method",
        "transaction_id",
        "status",
        "created_at",
        "approved_at",
    )
    list_filter = ("payment_method", "status", "created_at")
    search_fields = (
        "business__name",
        "user__email",
        "transaction_id",
        "sender_number",
    )
    ordering = ("-created_at",)