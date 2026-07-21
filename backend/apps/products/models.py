from django.db import models

from apps.businesses.models import Business


class ProductStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"


class ProductCategory(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="product_categories",
    )

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, null=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ["business", "name"]

    def __str__(self):
        return f"{self.business.name} - {self.name}"


class Product(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="products",
    )

    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )

    name = models.CharField(max_length=180)
    sku = models.CharField(max_length=100, blank=True, null=True)
    barcode = models.CharField(max_length=100, blank=True, null=True)

    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to="products/images/", blank=True, null=True)

    unit = models.CharField(max_length=30, default="pcs")
    size = models.CharField(max_length=80, blank=True, default="")
    color = models.CharField(max_length=80, blank=True, default="")

    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    stock_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    low_stock_limit = models.DecimalField(max_digits=12, decimal_places=2, default=5)

    status = models.CharField(
        max_length=20,
        choices=ProductStatus.choices,
        default=ProductStatus.ACTIVE,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ["business", "name", "size", "color"]

    @property
    def stock_value(self):
        return self.stock_quantity * self.purchase_price

    @property
    def profit_per_unit(self):
        return self.selling_price - self.purchase_price

    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_limit

    def __str__(self):
        return f"{self.business.name} - {self.name}"