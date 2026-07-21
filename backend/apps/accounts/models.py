from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    USER = "USER", "User"
    BUSINESS_OWNER = "BUSINESS_OWNER", "Business Owner"
    MANAGER = "MANAGER", "Manager"
    STAFF = "STAFF", "Staff"
    ACCOUNTANT = "ACCOUNTANT", "Accountant"


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(
        max_length=30,
        choices=UserRole.choices,
        default=UserRole.USER,
    )

    is_email_verified = models.BooleanField(default=False)
    is_phone_verified = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_super_admin_role(self):
        return self.role == UserRole.SUPER_ADMIN

    @property
    def is_business_owner_role(self):
        return self.role == UserRole.BUSINESS_OWNER

    @property
    def is_manager_role(self):
        return self.role == UserRole.MANAGER

    @property
    def is_staff_role(self):
        return self.role == UserRole.STAFF

    @property
    def is_accountant_role(self):
        return self.role == UserRole.ACCOUNTANT

    def save(self, *args, **kwargs):
        # Keep Django superusers and the API platform role synchronized.
        if self.is_superuser:
            self.role = UserRole.SUPER_ADMIN
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} - {self.role}"


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_otps",
    )

    email = models.EmailField()
    otp = models.CharField(max_length=6)

    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=10)

        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired

    def __str__(self):
        return f"{self.email} - {self.otp}"
