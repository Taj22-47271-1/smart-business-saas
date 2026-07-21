from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.businesses.models import Business, BusinessMember, BusinessMemberRole
from apps.chat.models import SupportThread, SupportThreadType


class SupportChatTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@example.com", username="admin", password="Pass12345!", role=UserRole.SUPER_ADMIN)
        self.owner = User.objects.create_user(email="owner@example.com", username="owner", password="Pass12345!")
        self.employee = User.objects.create_user(email="employee@example.com", username="employee", password="Pass12345!")
        self.outsider = User.objects.create_user(email="outside@example.com", username="outside", password="Pass12345!")
        self.business = Business.objects.create(owner=self.owner, name="Shop", slug="chat-shop")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMemberRole.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.employee, role=BusinessMemberRole.EMPLOYEE)

    def test_admin_can_start_and_message_employee_thread(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse("chat-threads"), {"business_id": self.business.id, "member_id": self.employee.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = self.client.post(reverse("chat-messages", kwargs={"thread_id": response.data["id"]}), {"body": "Hello employee"})
        self.assertEqual(message.status_code, status.HTTP_201_CREATED)

    def test_owner_can_start_thread_and_reply(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(reverse("chat-threads"), {"business_id": self.business.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["member"], self.owner.id)

    def test_outsider_cannot_read_thread(self):
        thread = SupportThread.objects.create(business=self.business, member=self.owner, created_by=self.owner)
        self.client.force_authenticate(self.outsider)
        response = self.client.get(reverse("chat-messages", kwargs={"thread_id": thread.id}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_only_admin_can_list_participants(self):
        self.client.force_authenticate(self.employee)
        self.assertEqual(self.client.get(reverse("chat-participants")).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(reverse("chat-participants")).status_code, status.HTTP_200_OK)

    def test_owner_employee_thread_is_private_from_super_admin(self):
        thread = SupportThread.objects.create(
            thread_type=SupportThreadType.OWNER_EMPLOYEE,
            business=self.business,
            owner=self.owner,
            member=self.employee,
            created_by=self.owner,
        )

        self.client.force_authenticate(self.employee)
        self.assertEqual(
            self.client.post(
                reverse("chat-messages", kwargs={"thread_id": thread.id}),
                {"body": "Hello owner"},
            ).status_code,
            status.HTTP_201_CREATED,
        )

        self.client.force_authenticate(self.owner)
        self.assertEqual(
            self.client.get(reverse("chat-messages", kwargs={"thread_id": thread.id})).status_code,
            status.HTTP_200_OK,
        )

        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.get(reverse("chat-messages", kwargs={"thread_id": thread.id})).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_owner_without_legacy_membership_can_chat_with_super_admin(self):
        BusinessMember.objects.filter(
            business=self.business,
            user=self.owner,
        ).delete()
        self.client.force_authenticate(self.owner)

        thread_response = self.client.post(
            reverse("chat-threads"),
            {"business_id": self.business.id},
            format="json",
        )

        self.assertEqual(thread_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            BusinessMember.objects.filter(
                business=self.business,
                user=self.owner,
                role=BusinessMemberRole.OWNER,
            ).exists()
        )

        owner_message = self.client.post(
            reverse("chat-messages", kwargs={"thread_id": thread_response.data["id"]}),
            {"body": "I need subscription support."},
            format="json",
        )
        self.assertEqual(owner_message.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.admin)
        admin_messages = self.client.get(
            reverse("chat-messages", kwargs={"thread_id": thread_response.data["id"]})
        )
        self.assertEqual(admin_messages.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_messages.data[0]["body"], "I need subscription support.")
