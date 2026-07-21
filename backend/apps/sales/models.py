from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.businesses.models import Business
from apps.customers.models import Customer
from apps.products.models import Product


class SalePaymentStatus(models.TextChoices):
    PAID = "PAID", "Paid"
    PARTIAL = "PARTIAL", "Partial"
    DUE = "DUE", "Due"


class SaleStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    CANCELLED = "CANCELLED", "Cancelled"


class DiscountType(models.TextChoices):
    FIXED = "FIXED", "Fixed amount"
    PERCENT = "PERCENT", "Percentage"


class DiscountVoucher(models.Model):
    business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name="discount_vouchers"
    )
    code = models.CharField(max_length=50)
    description = models.CharField(max_length=255, blank=True, default="")
    discount_type = models.CharField(
        max_length=10, choices=DiscountType.choices, default=DiscountType.FIXED
    )
    value = models.DecimalField(max_digits=12, decimal_places=2)
    minimum_purchase = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    maximum_discount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "code"], name="unique_business_voucher_code"
            )
        ]

    def __str__(self):
        return f"{self.business.name} - {self.code}"


class Sale(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="sales",
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales",
    )

    voucher = models.ForeignKey(
        DiscountVoucher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales",
    )

    invoice_number = models.CharField(max_length=100, unique=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    due_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    payment_method = models.CharField(max_length=50, default="Cash")
    payment_status = models.CharField(
        max_length=20,
        choices=SalePaymentStatus.choices,
        default=SalePaymentStatus.PAID,
    )

    status = models.CharField(
        max_length=20,
        choices=SaleStatus.choices,
        default=SaleStatus.ACTIVE,
    )

    note = models.TextField(blank=True, null=True)

    sold_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_sales",
    )

    cancel_reason = models.TextField(blank=True, null=True)

    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_sales",
    )

    cancelled_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def calculate_totals(self):
        subtotal = sum(item.line_total for item in self.items.all())

        self.subtotal = subtotal
        self.total_amount = subtotal - self.discount + self.tax
        self.due_amount = self.total_amount - self.paid_amount

        if self.due_amount <= 0:
            self.due_amount = 0
            self.payment_status = SalePaymentStatus.PAID
        elif self.paid_amount > 0:
            self.payment_status = SalePaymentStatus.PARTIAL
        else:
            self.payment_status = SalePaymentStatus.DUE

        self.save()

    def update_customer_due(self):
        if self.customer and self.due_amount > 0:
            self.customer.current_due += self.due_amount
            self.customer.save(update_fields=["current_due", "updated_at"])

    def cancel_sale(self, user, reason=None):
        if self.status == SaleStatus.CANCELLED:
            raise ValueError("This sale has already been cancelled.")

        for item in self.items.select_related("product").all():
            item.product.stock_quantity += item.quantity
            item.product.save(update_fields=["stock_quantity", "updated_at"])

        if self.customer and self.due_amount > 0:
            self.customer.current_due -= self.due_amount

            if self.customer.current_due < 0:
                self.customer.current_due = 0

            self.customer.save(update_fields=["current_due", "updated_at"])

        self.status = SaleStatus.CANCELLED
        self.cancel_reason = reason
        self.cancelled_by = user
        self.cancelled_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "cancel_reason",
                "cancelled_by",
                "cancelled_at",
                "updated_at",
            ]
        )

    def __str__(self):
        return f"{self.invoice_number} - {self.total_amount}"


class SalePayment(models.Model):
    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=50, default="Cash")
    note = models.TextField(blank=True, null=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_sale_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.sale.invoice_number} received {self.amount}"


class SaleItem(models.Model):
    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name="items",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="sale_items",
    )

    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)

    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        if not self.purchase_price:
            self.purchase_price = self.product.purchase_price

        self.line_total = self.quantity * self.selling_price
        self.profit = (self.selling_price - self.purchase_price) * self.quantity

        if not self.pk:
            self.product.stock_quantity -= self.quantity
            self.product.save(update_fields=["stock_quantity", "updated_at"])

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"
