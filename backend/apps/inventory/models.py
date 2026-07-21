from django.conf import settings
from django.db import models

from apps.businesses.models import Business
from apps.products.models import Product


class StockTransactionType(models.TextChoices):
    STOCK_IN = "STOCK_IN", "Stock In"
    STOCK_OUT = "STOCK_OUT", "Stock Out"
    ADJUSTMENT = "ADJUSTMENT", "Adjustment"
    DAMAGED = "DAMAGED", "Damaged"
    RETURNED = "RETURNED", "Returned"


class StockTransaction(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="stock_transactions",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="stock_transactions",
    )

    transaction_type = models.CharField(
        max_length=30,
        choices=StockTransactionType.choices,
    )

    quantity = models.DecimalField(max_digits=12, decimal_places=2)

    previous_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    new_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    note = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_stock_transactions",
    )

    is_reversed = models.BooleanField(default=False)
    is_reversal = models.BooleanField(default=False)

    reversed_transaction = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reversal_transactions",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.total_cost:
            self.total_cost = self.quantity * self.unit_cost

        if not self.pk:
            self.previous_quantity = self.product.stock_quantity

            if self.transaction_type in [
                StockTransactionType.STOCK_IN,
                StockTransactionType.RETURNED,
            ]:
                self.product.stock_quantity += self.quantity

            elif self.transaction_type in [
                StockTransactionType.STOCK_OUT,
                StockTransactionType.DAMAGED,
            ]:
                self.product.stock_quantity -= self.quantity

            elif self.transaction_type == StockTransactionType.ADJUSTMENT:
                self.product.stock_quantity = self.quantity

            self.new_quantity = self.product.stock_quantity
            self.product.save(update_fields=["stock_quantity", "updated_at"])

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} - {self.transaction_type} - {self.quantity}"