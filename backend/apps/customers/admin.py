from django.contrib import admin

from apps.customers.models import Customer, CustomerPayment


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "name",
        "phone",
        "email",
        "opening_due",
        "current_due",
        "is_active",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("business__name", "name", "phone", "email")


@admin.register(CustomerPayment)
class CustomerPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "customer",
        "amount",
        "payment_method",
        "created_at",
    )
    list_filter = ("payment_method", "created_at")
    search_fields = ("business__name", "customer__name", "customer__phone")