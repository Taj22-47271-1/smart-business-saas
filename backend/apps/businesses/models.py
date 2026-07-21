from django.conf import settings
from django.db import models


class BusinessStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    EXPIRED = "EXPIRED", "Expired"


class BusinessMemberRole(models.TextChoices):
    OWNER = "OWNER", "Owner"
    MANAGER = "MANAGER", "Manager"
    ACCOUNTANT = "ACCOUNTANT", "Accountant"
    STAFF = "STAFF", "Staff"
    # Kept for old databases; new team members use STAFF instead.
    EMPLOYEE = "EMPLOYEE", "Employee (Legacy)"


class BusinessMemberStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"


class Business(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_businesses",
    )

    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=180, unique=True)

    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    logo = models.ImageField(upload_to="business/logos/", blank=True, null=True)
    banner = models.ImageField(upload_to="business/banners/", blank=True, null=True)

    currency = models.CharField(max_length=10, default="BDT")
    status = models.CharField(
        max_length=20,
        choices=BusinessStatus.choices,
        default=BusinessStatus.ACTIVE,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_available(self):
        return self.is_active and self.status == BusinessStatus.ACTIVE

    @property
    def has_active_subscription(self):
        subscription = getattr(self, "subscription", None)

        if not subscription:
            return False

        return subscription.has_access

    def __str__(self):
        return self.name


class BusinessMember(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="business_memberships",
    )
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_business_members",
    )
    role = models.CharField(
        max_length=20,
        choices=BusinessMemberRole.choices,
    )
    status = models.CharField(
        max_length=20,
        choices=BusinessMemberStatus.choices,
        default=BusinessMemberStatus.ACTIVE,
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["business_id", "role", "user_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "user"],
                name="unique_business_member",
            )
        ]

    def __str__(self):
        return f"{self.user.email} - {self.business.name} - {self.role}"
