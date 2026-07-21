from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.current_password = "CurrentPass123!"
        self.new_password = "NewSecurePass456!"
        self.user = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password=self.current_password,
        )
        self.url = reverse("change-password")

    def test_authenticated_user_can_change_password(self):
        self.user.must_change_password = True
        self.user.save(update_fields=["must_change_password"])
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.url,
            {
                "current_password": self.current_password,
                "new_password": self.new_password,
                "confirm_password": self.new_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))
        self.assertFalse(self.user.must_change_password)

    def test_temporary_password_user_is_blocked_from_business_apis(self):
        self.user.must_change_password = True
        self.user.save(update_fields=["must_change_password"])
        access = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        response = self.client.get(reverse("my-businesses"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("temporary password", response.data["detail"])

    def test_wrong_current_password_is_rejected(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.url,
            {
                "current_password": "WrongPassword123!",
                "new_password": self.new_password,
                "confirm_password": self.new_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.current_password))

    def test_password_confirmation_must_match(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.url,
            {
                "current_password": self.current_password,
                "new_password": self.new_password,
                "confirm_password": "DifferentPass789!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_authentication_is_required(self):
        response = self.client.post(
            self.url,
            {
                "current_password": self.current_password,
                "new_password": self.new_password,
                "confirm_password": self.new_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SuperAdminRoleSyncTests(APITestCase):
    def test_createsuperuser_is_also_platform_super_admin(self):
        user = User.objects.create_superuser(
            email="platform@example.com",
            username="platform-admin",
            password="StrongPass123!",
        )

        self.assertEqual(user.role, "SUPER_ADMIN")

    def test_profile_reports_stale_django_superuser_as_super_admin(self):
        user = User.objects.create_superuser(
            email="legacy-platform@example.com",
            username="legacy-platform-admin",
            password="StrongPass123!",
        )
        # Simulate an old database row that predates the role sync migration.
        User.objects.filter(pk=user.pk).update(role="USER")
        user.refresh_from_db()
        self.client.force_authenticate(user)

        response = self.client.get(reverse("profile"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "SUPER_ADMIN")
