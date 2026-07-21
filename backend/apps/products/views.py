from rest_framework import generics, permissions

from apps.core.permissions import (
    CanManageProducts,
    HasActiveBusinessSubscription,
    HasBusinessAccess,
    get_user_business_queryset,
)
from apps.products.models import Product, ProductCategory
from apps.products.serializers import (
    ProductCategoryCreateSerializer,
    ProductCategoryCreateUpdateSerializer,
    ProductCategorySerializer,
    ProductCreateUpdateSerializer,
    ProductSerializer,
)


class ProductCategoryListView(generics.ListAPIView):
    serializer_class = ProductCategorySerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageProducts,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        return ProductCategory.objects.filter(
            business_id=business_id,
            business__in=allowed_businesses,
        ).select_related("business")


class ProductCategoryCreateView(generics.CreateAPIView):
    serializer_class = ProductCategoryCreateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageProducts,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]


class ProductCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageProducts,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        allowed_businesses = get_user_business_queryset(self.request.user)

        return ProductCategory.objects.filter(
            business__in=allowed_businesses,
        ).select_related("business")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return ProductCategoryCreateUpdateSerializer

        return ProductCategorySerializer


class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageProducts,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    search_fields = ["name", "sku", "barcode", "size", "color"]
    ordering_fields = ["name", "stock_quantity", "selling_price", "created_at"]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        return Product.objects.filter(
            business_id=business_id,
            business__in=allowed_businesses,
        ).select_related("business", "category")


class ProductCreateView(generics.CreateAPIView):
    serializer_class = ProductCreateUpdateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageProducts,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageProducts,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        allowed_businesses = get_user_business_queryset(self.request.user)

        return Product.objects.filter(
            business__in=allowed_businesses,
        ).select_related("business", "category")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return ProductCreateUpdateSerializer

        return ProductSerializer