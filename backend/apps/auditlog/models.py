from django.conf import settings
from django.db import models

from apps.businesses.models import Business


class AuditAction(models.TextChoices):
    CREATE = "CREATE", "Create"
    UPDATE = "UPDATE", "Update"
    DELETE = "DELETE", "Delete"
    LOGIN = "LOGIN", "Login"
    LOGOUT = "LOGOUT", "Logout"
    PAYMENT_APPROVE = "PAYMENT_APPROVE", "Payment Approve"
    PAYMENT_REJECT = "PAYMENT_REJECT", "Payment Reject"
    SUBSCRIPTION_ACTIVATE = "SUBSCRIPTION_ACTIVATE", "Subscription Activate"
    SUBSCRIPTION_EXPIRE = "SUBSCRIPTION_EXPIRE", "Subscription Expire"


class AuditLog(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="audit_logs",
        null=True,
        blank=True,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )

    action = models.CharField(
        max_length=50,
        choices=AuditAction.choices,
    )

    model_name = models.CharField(max_length=120, blank=True, null=True)
    object_id = models.CharField(max_length=120, blank=True, null=True)

    description = models.TextField(blank=True, null=True)

    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        user_email = self.user.email if self.user else "System"
        return f"{user_email} - {self.action} - {self.created_at}"