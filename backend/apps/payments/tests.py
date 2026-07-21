from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.businesses.models import Business
from apps.payments.models import Payment, PaymentMethod
from apps.subscriptions.models import (
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
)


class AdminPaymentSubscriptionTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="StrongPass123!",
            role=UserRole.SUPER_ADMIN,
        )
        self.owner = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            first_name="Shop",
            last_name="Owner",
            password="StrongPass123!",
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Renew Shop",
            slug="renew-shop",
        )
        self.plan = SubscriptionPlan.objects.create(
            name="Premium",
            price="1000.00",
            interval="MONTHLY",
            duration_count=1,
            features=["Priority support", "Daily backup"],
        )
        self.subscription = Subscription.objects.create(business=self.business)

    def create_payment(self, transaction_id="TX-001"):
        return Payment.objects.create(
            business=self.business,
            user=self.owner,
            plan=self.plan,
            amount=self.plan.price,
            payment_method=PaymentMethod.BKASH,
            transaction_id=transaction_id,
        )

    def test_admin_sees_owner_package_and_benefits_in_sold_subscription_details(self):
        self.create_payment()
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse("admin-payment-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment = response.data[0]
        self.assertEqual(payment["owner_email"], self.owner.email)
        self.assertEqual(payment["owner_name"], "Shop Owner")
        self.assertEqual(payment["plan_name"], self.plan.name)
        self.assertEqual(payment["plan_features"], self.plan.features)

    def test_approving_same_package_renews_after_current_expiry(self):
        current_end = timezone.now() + timedelta(days=12)
        self.subscription.plan = self.plan
        self.subscription.status = SubscriptionStatus.ACTIVE
        self.subscription.subscription_start_date = timezone.now() - timedelta(days=18)
        self.subscription.subscription_end_date = current_end
        self.subscription.save()
        payment = self.create_payment()
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse("payment-approve", kwargs={"pk": payment.id}),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.subscription.refresh_from_db()
        self.assertEqual(
            self.subscription.subscription_end_date,
            self.plan.calculate_end_date(current_end),
        )

    def test_approving_different_package_switches_from_now(self):
        old_plan = SubscriptionPlan.objects.create(
            name="Starter",
            price="500.00",
            interval="MONTHLY",
        )
        self.subscription.plan = old_plan
        self.subscription.status = SubscriptionStatus.ACTIVE
        self.subscription.subscription_end_date = timezone.now() + timedelta(days=20)
        self.subscription.save()
        payment = self.create_payment()
        before_approval = timezone.now()
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse("payment-approve", kwargs={"pk": payment.id}),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.subscription.refresh_from_db()
        expected_earliest_end = self.plan.calculate_end_date(before_approval)
        self.assertEqual(self.subscription.plan, self.plan)
        self.assertGreaterEqual(
            self.subscription.subscription_end_date,
            expected_earliest_end,
        )

    def test_approval_repairs_missing_subscription_record(self):
        payment = self.create_payment(transaction_id="TX-MISSING-SUB")
        self.subscription.delete()
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse("payment-approve", kwargs={"pk": payment.id}),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        repaired = Subscription.objects.get(business=self.business)
        self.assertEqual(payment.status, "APPROVED")
        self.assertEqual(repaired.status, SubscriptionStatus.ACTIVE)
        self.assertEqual(repaired.plan, self.plan)
        self.assertEqual(repaired.last_payment_id, payment.id)

    def test_legacy_django_superuser_can_approve_payment_through_jwt(self):
        platform_admin = User.objects.create_superuser(
            email="jwt-admin@example.com",
            username="jwt-admin",
            password="StrongPass123!",
        )
        User.objects.filter(pk=platform_admin.pk).update(role=UserRole.USER)
        payment = self.create_payment(transaction_id="TX-JWT-ADMIN")

        login = self.client.post(
            reverse("login"),
            {"email": platform_admin.email, "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        profile = self.client.get(reverse("profile"))
        approve = self.client.post(
            reverse("payment-approve", kwargs={"pk": payment.id}),
            {},
            format="json",
        )

        self.assertEqual(profile.status_code, status.HTTP_200_OK)
        self.assertEqual(profile.data["role"], UserRole.SUPER_ADMIN)
        self.assertEqual(approve.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertEqual(payment.status, "APPROVED")
