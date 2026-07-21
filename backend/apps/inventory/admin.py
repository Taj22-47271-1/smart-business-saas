from django.contrib import admin

from apps.inventory.models import StockTransaction


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "product",
        "transaction_type",
        "quantity",
        "previous_quantity",
        "new_quantity",
        "unit_cost",
        "total_cost",
        "created_by",
        "created_at",
    )
    list_filter = ("transaction_type", "created_at")
    search_fields = ("business__name", "product__name", "created_by__email")
    ordering = ("-created_at",)