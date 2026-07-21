from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember, BusinessMemberRole
from apps.inventory.models import StockTransaction, StockTransactionType
from apps.products.models import Product
from apps.subscriptions.models import Subscription


class StockProductFlowTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="stock-owner@example.com",
            username="stock-owner",
            password="StrongPass123!",
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Stock Shop",
            slug="stock-shop",
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMemberRole.OWNER,
        )
        Subscription.objects.create(
            business=self.business,
            trial_end_date=timezone.now() + timezone.timedelta(days=5),
        )
        self.product = Product.objects.create(
            business=self.business,
            name="Zero Stock Product",
            purchase_price=Decimal("25.00"),
            selling_price=Decimal("40.00"),
            stock_quantity=Decimal("0.00"),
        )
        self.client.force_authenticate(self.owner)

    def test_zero_stock_product_can_receive_stock(self):
        response = self.client.post(
            reverse("stock-transaction-create"),
            {
                "business_id": self.business.id,
                "product_id": self.product.id,
                "transaction_type": StockTransactionType.STOCK_IN,
                "quantity": "15.00",
                "unit_cost": "25.00",
                "note": "Opening stock",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("15.00"))
        self.assertTrue(
            StockTransaction.objects.filter(
                product=self.product,
                transaction_type=StockTransactionType.STOCK_IN,
            ).exists()
        )

    def test_product_list_used_by_stock_page_includes_zero_stock_product(self):
        response = self.client.get(
            reverse("product-list", kwargs={"business_id": self.business.id})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        product_ids = {row["id"] for row in response.data}
        self.assertIn(self.product.id, product_ids)
