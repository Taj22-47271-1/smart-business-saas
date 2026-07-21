from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember, BusinessMemberRole
from apps.inventory.models import StockTransaction, StockTransactionType
from apps.products.models import Product
from apps.subscriptions.models import Subscription


class ProductVariantTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="product-owner@example.com",
            username="product-owner",
            password="StrongPass123!",
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Fashion Shop",
            slug="fashion-shop",
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
        self.client.force_authenticate(self.owner)

    def payload(self, **overrides):
        payload = {
            "business_id": self.business.id,
            "name": "Classic T-Shirt",
            "sku": "TS-001",
            "unit": "pcs",
            "size": "M",
            "color": "Black",
            "purchase_price": "400.00",
            "selling_price": "650.00",
            "low_stock_limit": "5.00",
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    def test_product_size_and_color_are_saved_and_returned(self):
        response = self.client.post(
            reverse("product-create"), self.payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["size"], "M")
        self.assertEqual(response.data["color"], "Black")

    def test_same_product_name_can_have_different_variants(self):
        first = self.client.post(
            reverse("product-create"), self.payload(), format="json"
        )
        second = self.client.post(
            reverse("product-create"),
            self.payload(sku="TS-002", size="L", color="Blue"),
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

    def test_exact_duplicate_variant_is_rejected(self):
        self.client.post(reverse("product-create"), self.payload(), format="json")
        duplicate = self.client.post(
            reverse("product-create"),
            self.payload(sku="TS-009", size="m", color="black"),
            format="json",
        )

        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_product_can_be_created_with_initial_stock_and_stock_history(self):
        response = self.client.post(
            reverse("product-create"),
            self.payload(initial_stock="12.00"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        product = Product.objects.get(pk=response.data["id"])
        self.assertEqual(product.stock_quantity, 12)
        transaction = StockTransaction.objects.get(product=product)
        self.assertEqual(transaction.transaction_type, StockTransactionType.STOCK_IN)
        self.assertEqual(transaction.quantity, 12)

    def test_new_zero_stock_product_is_returned_for_stock_management(self):
        create_response = self.client.post(
            reverse("product-create"),
            self.payload(name="New Zero Stock Product", sku="ZERO-001", size="", color=""),
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(
            reverse("product-list", kwargs={"business_id": self.business.id})
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in list_response.data}
        self.assertIn(create_response.data["id"], ids)
        zero_product = next(item for item in list_response.data if item["id"] == create_response.data["id"])
        self.assertEqual(zero_product["stock_quantity"], "0.00")

