from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember, BusinessMemberRole
from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import DiscountType, DiscountVoucher, SalePayment
from apps.subscriptions.models import Subscription


class SaleFlowTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="StrongPass123!",
        )
        self.employee = User.objects.create_user(
            email="employee@example.com",
            username="employee",
            password="StrongPass123!",
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Test Shop",
            slug="test-shop",
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMemberRole.OWNER,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.employee,
            role=BusinessMemberRole.EMPLOYEE,
        )
        Subscription.objects.create(
            business=self.business,
            trial_end_date=timezone.now() + timezone.timedelta(days=5),
        )
        self.product = Product.objects.create(
            business=self.business,
            name="Rice",
            purchase_price=Decimal("60.00"),
            selling_price=Decimal("100.00"),
            stock_quantity=Decimal("10.00"),
        )

    def sale_payload(self, **overrides):
        payload = {
            "business_id": self.business.id,
            "discount": "0.00",
            "tax": "10.00",
            "paid_amount": "210.00",
            "payment_method": "Cash",
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": "2.00",
                    "selling_price": "100.00",
                }
            ],
        }
        payload.update(overrides)
        return payload

    def test_owner_can_sell_and_total_stock_and_receipt_are_correct(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse("sale-create"), self.sale_payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(response.data["subtotal"]), Decimal("200.00"))
        self.assertEqual(Decimal(response.data["total_amount"]), Decimal("210.00"))
        self.assertEqual(Decimal(response.data["due_amount"]), Decimal("0.00"))
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("8.00"))

        receipt = self.client.get(
            reverse("sale-detail", kwargs={"pk": response.data["id"]})
        )
        self.assertEqual(receipt.status_code, status.HTTP_200_OK)
        self.assertEqual(receipt.data["invoice_number"], response.data["invoice_number"])
        self.assertEqual(len(receipt.data["items"]), 1)

    def test_staff_role_can_open_sale_flow_and_create_invoice(self):
        membership = BusinessMember.objects.get(
            business=self.business,
            user=self.employee,
        )
        membership.role = BusinessMemberRole.STAFF
        membership.save(update_fields=["role"])
        self.client.force_authenticate(self.employee)

        response = self.client.post(
            reverse("sale-create"), self.sale_payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["sold_by_email"], self.employee.email)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("8.00"))

    def test_employee_can_sell_at_listed_price_and_stock_decreases(self):
        self.client.force_authenticate(self.employee)

        response = self.client.post(
            reverse("sale-create"), self.sale_payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("8.00"))
        self.assertEqual(response.data["sold_by_email"], self.employee.email)
        self.assertNotIn("purchase_price", response.data["items"][0])
        self.assertNotIn("profit", response.data["items"][0])

    def test_employee_cannot_change_listed_price_or_apply_discount(self):
        self.client.force_authenticate(self.employee)
        changed_price = self.sale_payload()
        changed_price["items"][0]["selling_price"] = "90.00"

        price_response = self.client.post(
            reverse("sale-create"), changed_price, format="json"
        )
        discount_response = self.client.post(
            reverse("sale-create"),
            self.sale_payload(discount="5.00"),
            format="json",
        )

        self.assertEqual(price_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(discount_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("10.00"))

    def test_sale_is_rejected_when_stock_is_insufficient(self):
        self.client.force_authenticate(self.owner)
        payload = self.sale_payload()
        payload["items"][0]["quantity"] = "11.00"

        response = self.client.post(reverse("sale-create"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("10.00"))

    def test_employee_can_apply_owner_approved_voucher(self):
        DiscountVoucher.objects.create(
            business=self.business,
            code="SAVE10",
            discount_type=DiscountType.PERCENT,
            value=Decimal("10.00"),
            is_active=True,
        )
        self.client.force_authenticate(self.employee)
        payload = self.sale_payload(paid_amount="190.00", voucher_code="save10")

        response = self.client.post(reverse("sale-create"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["voucher_code"], "SAVE10")
        self.assertEqual(Decimal(response.data["discount"]), Decimal("20.00"))
        self.assertEqual(Decimal(response.data["total_amount"]), Decimal("190.00"))

    def test_employee_cannot_create_voucher(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post(
            reverse("discount-voucher-list-create", kwargs={"business_id": self.business.id}),
            {"code": "BLOCKED", "discount_type": "FIXED", "value": "5.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_create_multiple_sales_consecutively(self):
        self.client.force_authenticate(self.owner)

        first = self.client.post(
            reverse("sale-create"), self.sale_payload(), format="json"
        )
        second = self.client.post(
            reverse("sale-create"), self.sale_payload(), format="json"
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(first.data["invoice_number"], second.data["invoice_number"])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("6.00"))


    def test_due_invoice_can_receive_partial_and_full_payments_later(self):
        customer = Customer.objects.create(
            business=self.business,
            name="Due Customer",
            phone="01700000001",
        )
        self.client.force_authenticate(self.owner)
        sale_response = self.client.post(
            reverse("sale-create"),
            self.sale_payload(customer_id=customer.id, paid_amount="50.00"),
            format="json",
        )
        self.assertEqual(sale_response.status_code, status.HTTP_201_CREATED)
        sale_id = sale_response.data["id"]
        payment_url = reverse(
            "sale-payment-list-create",
            kwargs={"business_id": self.business.id, "sale_id": sale_id},
        )

        first_payment = self.client.post(
            payment_url,
            {"amount": "60.00", "payment_method": "bKash", "note": "First due payment"},
            format="json",
        )
        self.assertEqual(first_payment.status_code, status.HTTP_201_CREATED)

        detail_after_first = self.client.get(
            reverse("sale-detail", kwargs={"pk": sale_id})
        )
        self.assertEqual(detail_after_first.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(detail_after_first.data["paid_amount"]), Decimal("110.00"))
        self.assertEqual(Decimal(detail_after_first.data["due_amount"]), Decimal("100.00"))
        self.assertEqual(detail_after_first.data["payment_status"], "PARTIAL")

        final_payment = self.client.post(
            payment_url,
            {"amount": "100.00", "payment_method": "Cash"},
            format="json",
        )
        self.assertEqual(final_payment.status_code, status.HTTP_201_CREATED)

        final_detail = self.client.get(reverse("sale-detail", kwargs={"pk": sale_id}))
        self.assertEqual(Decimal(final_detail.data["paid_amount"]), Decimal("210.00"))
        self.assertEqual(Decimal(final_detail.data["due_amount"]), Decimal("0.00"))
        self.assertEqual(final_detail.data["payment_status"], "PAID")
        self.assertEqual(len(final_detail.data["payment_history"]), 2)

        customer.refresh_from_db()
        self.assertEqual(customer.current_due, Decimal("0.00"))
        self.assertEqual(SalePayment.objects.filter(sale_id=sale_id).count(), 2)

    def test_due_payment_cannot_exceed_invoice_due(self):
        customer = Customer.objects.create(
            business=self.business,
            name="Overpay Customer",
            phone="01700000002",
        )
        self.client.force_authenticate(self.owner)
        sale_response = self.client.post(
            reverse("sale-create"),
            self.sale_payload(customer_id=customer.id, paid_amount="10.00"),
            format="json",
        )
        payment_url = reverse(
            "sale-payment-list-create",
            kwargs={"business_id": self.business.id, "sale_id": sale_response.data["id"]},
        )

        response = self.client.post(
            payment_url,
            {"amount": "201.00", "payment_method": "Cash"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SalePayment.objects.count(), 0)


    def test_customer_payment_receipt_updates_oldest_due_invoice_status(self):
        customer = Customer.objects.create(
            business=self.business,
            name="Receipt Customer",
            phone="01700000003",
        )
        self.client.force_authenticate(self.owner)
        sale_response = self.client.post(
            reverse("sale-create"),
            self.sale_payload(customer_id=customer.id, paid_amount="10.00"),
            format="json",
        )
        self.assertEqual(sale_response.status_code, status.HTTP_201_CREATED)

        payment_response = self.client.post(
            reverse("customer-payment-create"),
            {
                "business_id": self.business.id,
                "customer_id": customer.id,
                "amount": "200.00",
                "payment_method": "Nagad",
                "note": "Paid from customer page",
            },
            format="json",
        )

        self.assertEqual(payment_response.status_code, status.HTTP_201_CREATED)
        detail = self.client.get(
            reverse("sale-detail", kwargs={"pk": sale_response.data["id"]})
        )
        self.assertEqual(detail.data["payment_status"], "PAID")
        self.assertEqual(Decimal(detail.data["due_amount"]), Decimal("0.00"))
        self.assertEqual(len(detail.data["payment_history"]), 1)
        customer.refresh_from_db()
        self.assertEqual(customer.current_due, Decimal("0.00"))
