from django.db import models

from apps.businesses.models import Business


class Customer(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="customers",
    )

    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    opening_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ["business", "phone"]

    def __str__(self):
        return f"{self.business.name} - {self.name}"


class CustomerPayment(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="customer_payments",
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="payments",
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=50, default="Cash")
    note = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.pk:
            self.customer.current_due -= self.amount
            if self.customer.current_due < 0:
                self.customer.current_due = 0
            self.customer.save()

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.customer.name} paid {self.amount}"