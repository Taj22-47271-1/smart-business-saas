from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.businesses.models import Business, BusinessMember, BusinessMemberRole
from apps.payments.models import Payment, PaymentMethod
from apps.subscriptions.models import Subscription, SubscriptionPlan, SubscriptionStatus


class AdminSubscriptionPlanTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com", username="admin", password="Pass12345!",
            role=UserRole.SUPER_ADMIN,
        )
        self.user = User.objects.create_user(
            email="owner@example.com", username="owner", password="Pass12345!",
        )
        self.plan = SubscriptionPlan.objects.create(
            name="Starter", price="500.00", interval="MONTHLY",
        )

    def test_super_admin_can_create_and_update_plan_price(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            reverse("admin-subscription-plans"),
            {
                "name": "Business",
                "price": "1200.00",
                "interval": "MONTHLY",
                "max_products": 500,
                "max_staff": 10,
                "has_reports": True,
                "has_online_shop": False,
                "has_pdf_invoice": True,
                "features": ["Priority support", "Daily backup"],
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            created.data["features"],
            ["Priority support", "Daily backup"],
        )

        updated = self.client.patch(
            reverse("admin-subscription-plan-detail", kwargs={"pk": self.plan.id}),
            {"price": "750.00"},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.plan.refresh_from_db()
        self.assertEqual(str(self.plan.price), "750.00")

    def test_super_admin_can_view_and_change_business_package(self):
        business = Business.objects.create(
            owner=self.user,
            name="Package Shop",
            slug="package-shop",
        )
        subscription = Subscription.objects.create(business=business)
        premium = SubscriptionPlan.objects.create(
            name="Premium",
            price="2000.00",
            interval="MONTHLY",
            features=["Priority support", "Custom branding"],
        )
        self.client.force_authenticate(self.admin)

        listed = self.client.get(reverse("admin-subscriptions"))
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data[0]["business_name"], "Package Shop")
        self.assertEqual(listed.data[0]["owner_email"], self.user.email)

        updated = self.client.patch(
            reverse("admin-subscription-update", kwargs={"pk": subscription.id}),
            {"plan_id": premium.id},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["plan_name"], "Premium")
        self.assertEqual(updated.data["plan_features"], premium.features)
        subscription.refresh_from_db()
        self.assertEqual(subscription.plan, premium)
        self.assertEqual(subscription.status, SubscriptionStatus.ACTIVE)
        self.assertTrue(subscription.has_access)

    def test_sold_subscription_detail_contains_owner_expiry_and_payment_history(self):
        self.user.phone = "01700000000"
        self.user.save(update_fields=["phone"])
        business = Business.objects.create(
            owner=self.user, name="History Shop", slug="history-shop"
        )
        subscription = Subscription.objects.create(business=business)
        subscription.activate_subscription(self.plan)
        Payment.objects.create(
            business=business,
            user=self.user,
            plan=self.plan,
            amount="500.00",
            payment_method=PaymentMethod.BKASH,
            transaction_id="HISTORY-001",
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            reverse("admin-sold-subscription-detail", kwargs={"pk": subscription.id})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["owner_phone"], "01700000000")
        self.assertGreater(response.data["days_remaining"], 0)
        self.assertEqual(response.data["latest_payment_status"], "PENDING")
        self.assertEqual(len(response.data["payment_history"]), 1)

    def test_employee_only_receives_subscription_access_flag(self):
        employee = User.objects.create_user(
            email="employee@example.com", username="employee", password="Pass12345!"
        )
        business = Business.objects.create(
            owner=self.user, name="Private Shop", slug="private-shop"
        )
        BusinessMember.objects.create(
            business=business, user=self.user, role=BusinessMemberRole.OWNER
        )
        BusinessMember.objects.create(
            business=business, user=employee, role=BusinessMemberRole.EMPLOYEE
        )
        Subscription.objects.create(business=business)
        self.client.force_authenticate(employee)

        response = self.client.get(
            reverse("business-subscription-detail", kwargs={"business_id": business.id})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data.keys()), {"has_access"})

    def test_owner_can_submit_pending_renewal_but_employee_cannot(self):
        employee = User.objects.create_user(
            email="renew.employee@example.com", username="renew-employee", password="Pass12345!"
        )
        business = Business.objects.create(
            owner=self.user, name="Renewal Shop", slug="renewal-shop"
        )
        BusinessMember.objects.create(
            business=business, user=self.user, role=BusinessMemberRole.OWNER
        )
        BusinessMember.objects.create(
            business=business, user=employee, role=BusinessMemberRole.EMPLOYEE
        )
        Subscription.objects.create(business=business)
        payload = {
            "plan_id": self.plan.id,
            "amount": "500.00",
            "payment_method": PaymentMethod.BKASH,
            "transaction_id": "RENEW-001",
        }

        self.client.force_authenticate(self.user)
        created = self.client.post(
            reverse("business-subscription-renew", kwargs={"business_id": business.id}),
            payload,
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["status"], "PENDING")

        payload["transaction_id"] = "RENEW-002"
        self.client.force_authenticate(employee)
        forbidden = self.client.post(
            reverse("business-subscription-renew", kwargs={"business_id": business.id}),
            payload,
            format="json",
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_normal_user_cannot_view_or_change_business_packages(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("admin-subscriptions"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_normal_user_cannot_manage_plans(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("admin-subscription-plan-detail", kwargs={"pk": self.plan.id}),
            {"price": "1.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_public_plan_list_only_returns_active_plans(self):
        SubscriptionPlan.objects.create(
            name="Hidden", price="900.00", interval="MONTHLY", is_active=False,
        )
        response = self.client.get(reverse("subscription-plans"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["name"] for item in response.data], ["Starter"])

    def test_variable_month_year_and_lifetime_durations(self):
        monthly = SubscriptionPlan.objects.create(
            name="Six Months", price="2500.00", interval="MONTHLY", duration_count=6,
        )
        yearly = SubscriptionPlan.objects.create(
            name="Two Years", price="8000.00", interval="YEARLY", duration_count=2,
        )
        lifetime = SubscriptionPlan.objects.create(
            name="Lifetime", price="25000.00", interval="LIFETIME",
        )
        self.assertEqual(monthly.duration_days, 180)
        self.assertEqual(yearly.duration_days, 730)
        self.assertIsNone(lifetime.duration_days)

        business = Business.objects.create(
            owner=self.user, name="Lifetime Shop", slug="lifetime-shop",
        )
        subscription = Subscription.objects.create(business=business)
        subscription.activate_subscription(lifetime)
        subscription.refresh_from_db()
        self.assertEqual(subscription.status, SubscriptionStatus.ACTIVE)
        self.assertIsNone(subscription.subscription_end_date)
        self.assertTrue(subscription.has_access)
