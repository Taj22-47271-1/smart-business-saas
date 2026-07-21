from django.contrib import admin

from apps.sales.models import Sale, SaleItem, SalePayment


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "invoice_number",
        "customer",
        "total_amount",
        "paid_amount",
        "due_amount",
        "payment_status",
        "payment_method",
        "sold_by",
        "created_at",
    )
    list_filter = ("payment_status", "payment_method", "created_at")
    search_fields = (
        "business__name",
        "invoice_number",
        "customer__name",
        "customer__phone",
    )
    inlines = [SaleItemInline]
    ordering = ("-created_at",)


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "sale",
        "product",
        "quantity",
        "purchase_price",
        "selling_price",
        "line_total",
        "profit",
    )
    search_fields = ("sale__invoice_number", "product__name")

@admin.register(SalePayment)
class SalePaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "sale",
        "amount",
        "payment_method",
        "received_by",
        "created_at",
    )
    list_filter = ("payment_method", "created_at")
    search_fields = (
        "sale__invoice_number",
        "sale__customer__name",
        "sale__customer__phone",
        "received_by__email",
    )
    ordering = ("-created_at",)
