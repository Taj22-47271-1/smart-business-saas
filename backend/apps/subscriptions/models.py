from datetime import timedelta
from calendar import monthrange

from django.db import models
from django.utils import timezone

from apps.businesses.models import Business


class PlanInterval(models.TextChoices):
    MONTHLY = "MONTHLY", "Monthly"
    YEARLY = "YEARLY", "Yearly"
    LIFETIME = "LIFETIME", "Lifetime"


class SubscriptionStatus(models.TextChoices):
    TRIAL = "TRIAL", "Trial"
    ACTIVE = "ACTIVE", "Active"
    EXPIRED = "EXPIRED", "Expired"
    CANCELLED = "CANCELLED", "Cancelled"


class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    interval = models.CharField(
        max_length=20,
        choices=PlanInterval.choices,
        default=PlanInterval.MONTHLY,
    )
    duration_count = models.PositiveIntegerField(default=1)

    max_products = models.PositiveIntegerField(default=100)
    max_staff = models.PositiveIntegerField(default=3)

    has_reports = models.BooleanField(default=True)
    has_online_shop = models.BooleanField(default=False)
    has_pdf_invoice = models.BooleanField(default=True)
    features = models.JSONField(default=list, blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["price"]

    def __str__(self):
        return f"{self.name} - {self.price} {self.interval}"

    @property
    def is_lifetime(self):
        return self.interval == PlanInterval.LIFETIME

    @property
    def duration_days(self):
        if self.is_lifetime:
            return None
        multiplier = 365 if self.interval == PlanInterval.YEARLY else 30
        return self.duration_count * multiplier

    def calculate_end_date(self, start):
        """Use calendar months/years instead of approximate day counts."""
        if self.is_lifetime:
            return None
        months = self.duration_count * (12 if self.interval == PlanInterval.YEARLY else 1)
        month_index = start.month - 1 + months
        year = start.year + month_index // 12
        month = month_index % 12 + 1
        day = min(start.day, monthrange(year, month)[1])
        return start.replace(year=year, month=month, day=day)


class Subscription(models.Model):
    business = models.OneToOneField(
        Business,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subscriptions",
    )

    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIAL,
    )

    trial_start_date = models.DateTimeField(default=timezone.now)
    trial_end_date = models.DateTimeField()

    subscription_start_date = models.DateTimeField(blank=True, null=True)
    subscription_end_date = models.DateTimeField(blank=True, null=True)

    last_payment_id = models.PositiveIntegerField(blank=True, null=True)

    is_locked = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.trial_end_date:
            self.trial_end_date = timezone.now() + timedelta(days=5)
        super().save(*args, **kwargs)

    @property
    def is_trial_valid(self):
        return self.status == SubscriptionStatus.TRIAL and timezone.now() <= self.trial_end_date

    @property
    def is_subscription_valid(self):
        if self.status != SubscriptionStatus.ACTIVE or not self.plan:
            return False
        if self.plan.is_lifetime:
            return True
        return bool(
            self.subscription_end_date
            and timezone.now() <= self.subscription_end_date
        )

    @property
    def has_access(self):
        return self.is_trial_valid or self.is_subscription_valid

    @property
    def days_remaining(self):
        end_date = (
            self.trial_end_date
            if self.status == SubscriptionStatus.TRIAL
            else self.subscription_end_date
        )
        if not end_date:
            return None
        remaining = end_date - timezone.now()
        if remaining.total_seconds() <= 0:
            return 0
        return max(1, (remaining.days + (1 if remaining.seconds else 0)))

    def activate_subscription(self, plan, days=None, payment_id=None, renew=False):
        now = timezone.now()
        renewal_start = now
        is_active_same_plan = (
            renew
            and self.status == SubscriptionStatus.ACTIVE
            and self.plan_id == plan.id
            and self.subscription_end_date
            and self.subscription_end_date > now
        )
        if is_active_same_plan:
            renewal_start = self.subscription_end_date

        self.plan = plan
        self.status = SubscriptionStatus.ACTIVE
        self.subscription_start_date = now
        if plan.is_lifetime:
            self.subscription_end_date = None
        elif days is not None:
            self.subscription_end_date = renewal_start + timedelta(days=days)
        else:
            self.subscription_end_date = plan.calculate_end_date(renewal_start)
        self.last_payment_id = payment_id
        self.is_locked = False
        self.save()

    def mark_expired(self):
        self.status = SubscriptionStatus.EXPIRED
        self.is_locked = True
        self.save()

    def __str__(self):
        return f"{self.business.name} - {self.status}"
