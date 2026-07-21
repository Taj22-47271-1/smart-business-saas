from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.businesses.models import Business


class SupportThreadType(models.TextChoices):
    PLATFORM = "PLATFORM", "Platform Support"
    OWNER_EMPLOYEE = "OWNER_EMPLOYEE", "Owner and Employee"


class SupportThread(models.Model):
    thread_type = models.CharField(
        max_length=30,
        choices=SupportThreadType.choices,
        default=SupportThreadType.PLATFORM,
    )
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="support_threads",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_threads",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="employee_chat_threads",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_support_threads",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "member"],
                condition=Q(thread_type=SupportThreadType.PLATFORM),
                name="unique_platform_support_thread",
            ),
            models.UniqueConstraint(
                fields=["business", "owner", "member"],
                condition=Q(thread_type=SupportThreadType.OWNER_EMPLOYEE),
                name="unique_owner_employee_thread",
            ),
        ]

    def __str__(self):
        return f"{self.business.name} - {self.member.email}"


class SupportMessage(models.Model):
    thread = models.ForeignKey(
        SupportThread,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_messages",
    )
    body = models.TextField(max_length=4000)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Message #{self.id} in thread #{self.thread_id}"
