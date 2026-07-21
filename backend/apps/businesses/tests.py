from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.businesses.models import (
    Business,
    BusinessMember,
    BusinessMemberRole,
)
from apps.products.models import Product
from apps.chat.models import SupportThread, SupportThreadType


class BusinessRolePermissionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", username="owner", password="StrongPass123!"
        )
        self.employee = User.objects.create_user(
            email="employee@example.com", username="employee", password="StrongPass123!"
        )
        self.super_admin = User.objects.create_user(
            email="admin@example.com", username="admin", password="StrongPass123!",
            role=UserRole.SUPER_ADMIN,
        )
        self.business = Business.objects.create(
            owner=self.owner, name="Owner Shop", slug="owner-shop"
        )
        BusinessMember.objects.create(
            business=self.business, user=self.owner, role=BusinessMemberRole.OWNER
        )
        BusinessMember.objects.create(
            business=self.business, user=self.employee, role=BusinessMemberRole.EMPLOYEE
        )
        self.product = Product.objects.create(
            business=self.business,
            name="Private Product",
            purchase_price="60.00",
            selling_price="100.00",
        )

    def test_employee_product_response_hides_cost_and_profit(self):
        self.client.force_authenticate(self.employee)
        response = self.client.get(
            reverse("product-list", kwargs={"business_id": self.business.id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        product = response.data[0]
        self.assertNotIn("purchase_price", product)
        self.assertNotIn("stock_value", product)
        self.assertNotIn("profit_per_unit", product)
        self.assertIn("selling_price", product)

    def test_employee_cannot_create_product(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post(
            reverse("product-create"),
            {
                "business_id": self.business.id,
                "name": "Forbidden Product",
                "purchase_price": "10.00",
                "selling_price": "20.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_cannot_access_private_products(self):
        self.client.force_authenticate(self.super_admin)
        response = self.client.get(
            reverse("product-list", kwargs={"business_id": self.business.id})
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_cannot_access_any_private_operation_lists(self):
        self.client.force_authenticate(self.super_admin)
        urls = [
            reverse("stock-transaction-list", kwargs={"business_id": self.business.id}),
            reverse("sale-list", kwargs={"business_id": self.business.id}),
            reverse("customer-list", kwargs={"business_id": self.business.id}),
            reverse("expense-list", kwargs={"business_id": self.business.id}),
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(
                    self.client.get(url).status_code,
                    status.HTTP_403_FORBIDDEN,
                )

    def test_reports_are_owner_only(self):
        url = reverse("dashboard-summary", kwargs={"business_id": self.business.id})

        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.employee)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.super_admin)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

    def test_business_creation_creates_owner_membership(self):
        new_owner = User.objects.create_user(
            email="new@example.com", username="new-owner", password="StrongPass123!"
        )
        self.client.force_authenticate(new_owner)
        response = self.client.post(
            reverse("business-create"),
            {"name": "New Shop", "slug": "new-shop", "currency": "BDT"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(BusinessMember.objects.filter(
            business_id=response.data["id"], user=new_owner,
            role=BusinessMemberRole.OWNER,
        ).exists())

    def test_only_owner_can_create_staff_with_temporary_password(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse("business-members", kwargs={"business_id": self.business.id}),
            {
                "email": "new.employee@example.com",
                "first_name": "New",
                "last_name": "Employee",
                "temporary_password": "TemporaryPass456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        employee = User.objects.get(email="new.employee@example.com")
        self.assertTrue(employee.must_change_password)
        self.assertTrue(employee.check_password("TemporaryPass456!"))
        self.assertTrue(BusinessMember.objects.filter(
            business=self.business,
            user=employee,
            role=BusinessMemberRole.STAFF,
        ).exists())
        self.assertTrue(SupportThread.objects.filter(
            thread_type=SupportThreadType.OWNER_EMPLOYEE,
            business=self.business,
            owner=self.owner,
            member=employee,
        ).exists())

        self.client.force_authenticate(self.employee)
        forbidden = self.client.post(
            reverse("business-members", kwargs={"business_id": self.business.id}),
            {"email": "blocked@example.com", "temporary_password": "TemporaryPass456!"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_remove_employee_without_deleting_user_account(self):
        membership = BusinessMember.objects.get(
            business=self.business,
            user=self.employee,
        )
        SupportThread.objects.create(
            thread_type=SupportThreadType.OWNER_EMPLOYEE,
            business=self.business,
            owner=self.owner,
            member=self.employee,
            created_by=self.owner,
        )
        self.client.force_authenticate(self.owner)

        response = self.client.delete(
            reverse(
                "business-member-detail",
                kwargs={"business_id": self.business.id, "pk": membership.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(BusinessMember.objects.filter(pk=membership.id).exists())
        self.assertTrue(User.objects.filter(pk=self.employee.id).exists())
        self.assertFalse(SupportThread.objects.filter(
            business=self.business,
            member=self.employee,
        ).exists())


    def test_business_creation_refresh_data_contains_owner_role(self):
        new_owner = User.objects.create_user(
            email="trial-owner@example.com",
            username="trial-owner",
            password="StrongPass123!",
        )
        self.client.force_authenticate(new_owner)

        create_response = self.client.post(
            reverse("business-create"),
            {"name": "Trial Shop", "slug": "trial-shop", "currency": "BDT"},
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        new_owner.refresh_from_db()
        self.assertEqual(new_owner.role, UserRole.BUSINESS_OWNER)

        profile_response = self.client.get(reverse("profile"))
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertIn(
            {
                "business_id": create_response.data["id"],
                "business_name": "Trial Shop",
                "role": BusinessMemberRole.OWNER,
                "status": "ACTIVE",
            },
            profile_response.data["business_memberships"],
        )

    def test_legacy_owner_without_membership_still_has_workspace_access(self):
        legacy_owner = User.objects.create_user(
            email="legacy-owner@example.com",
            username="legacy-owner",
            password="StrongPass123!",
        )
        legacy_business = Business.objects.create(
            owner=legacy_owner,
            name="Legacy Shop",
            slug="legacy-shop",
        )
        self.assertFalse(
            BusinessMember.objects.filter(
                business=legacy_business,
                user=legacy_owner,
            ).exists()
        )

        self.client.force_authenticate(legacy_owner)

        profile_response = self.client.get(reverse("profile"))
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertIn(
            {
                "business_id": legacy_business.id,
                "business_name": "Legacy Shop",
                "role": BusinessMemberRole.OWNER,
                "status": "ACTIVE",
            },
            profile_response.data["business_memberships"],
        )

        businesses_response = self.client.get(reverse("my-businesses"))
        self.assertEqual(businesses_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [business["id"] for business in businesses_response.data],
            [legacy_business.id],
        )

        products_response = self.client.get(
            reverse("product-list", kwargs={"business_id": legacy_business.id})
        )
        self.assertEqual(products_response.status_code, status.HTTP_200_OK)


class MultipleBusinessRoleTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="roles-owner@example.com",
            username="roles-owner",
            password="StrongPass123!",
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Roles Shop",
            slug="roles-shop",
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMemberRole.OWNER,
        )

    def test_owner_can_assign_and_change_team_roles(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse("business-members", kwargs={"business_id": self.business.id}),
            {
                "email": "manager@example.com",
                "first_name": "Team",
                "last_name": "Manager",
                "temporary_password": "TemporaryPass456!",
                "role": BusinessMemberRole.MANAGER,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["role"], BusinessMemberRole.MANAGER)

        response = self.client.patch(
            reverse(
                "business-member-detail",
                kwargs={"business_id": self.business.id, "pk": response.data["id"]},
            ),
            {"role": BusinessMemberRole.ACCOUNTANT},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], BusinessMemberRole.ACCOUNTANT)

    def test_manager_and_accountant_can_view_reports_but_staff_cannot(self):
        url = reverse("dashboard-summary", kwargs={"business_id": self.business.id})
        expected = [
            (BusinessMemberRole.MANAGER, status.HTTP_200_OK),
            (BusinessMemberRole.ACCOUNTANT, status.HTTP_200_OK),
            (BusinessMemberRole.STAFF, status.HTTP_403_FORBIDDEN),
        ]

        for index, (role, expected_status) in enumerate(expected):
            user = User.objects.create_user(
                email=f"role-{index}@example.com",
                username=f"role-{index}",
                password="StrongPass123!",
            )
            BusinessMember.objects.create(
                business=self.business,
                user=user,
                role=role,
            )
            self.client.force_authenticate(user)
            with self.subTest(role=role):
                self.assertEqual(self.client.get(url).status_code, expected_status)
