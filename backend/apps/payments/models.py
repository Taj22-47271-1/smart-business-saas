from django.conf import settings
from django.db import models

from apps.businesses.models import Business
from apps.subscriptions.models import SubscriptionPlan


class PaymentMethod(models.TextChoices):
    BKASH = "BKASH", "bKash"
    NAGAD = "NAGAD", "Nagad"
    ROCKET = "ROCKET", "Rocket"
    BANK = "BANK", "Bank"
    CASH = "CASH", "Cash"


class PaymentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class Payment(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)

    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
    )

    sender_number = models.CharField(max_length=20, blank=True, null=True)
    transaction_id = models.CharField(max_length=100, unique=True)
    screenshot = models.ImageField(
        upload_to="payments/screenshots/",
        blank=True,
        null=True,
    )

    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    note = models.TextField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_payments",
    )

    paid_at = models.DateTimeField(blank=True, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.business.name} - {self.amount} - {self.status}"