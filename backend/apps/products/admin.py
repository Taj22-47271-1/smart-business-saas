from django.contrib import admin

from apps.products.models import Product, ProductCategory


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "name",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("business__name", "name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "category",
        "name",
        "sku",
        "size",
        "color",
        "purchase_price",
        "selling_price",
        "stock_quantity",
        "low_stock_limit",
        "status",
        "is_active",
    )
    list_filter = ("status", "is_active", "category")
    search_fields = ("business__name", "name", "sku", "barcode", "size", "color")