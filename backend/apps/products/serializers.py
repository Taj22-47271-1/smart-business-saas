from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.businesses.models import Business
from apps.core.permissions import is_business_employee, user_can_access_business
from apps.products.models import Product, ProductCategory


class ProductCategorySerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = ProductCategory
        fields = [
            "id",
            "business",
            "business_name",
            "name",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "business_name",
            "created_at",
            "updated_at",
        ]


class ProductCategoryCreateUpdateSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = ProductCategory
        fields = [
            "id",
            "business_id",
            "name",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        business = None
        business_id = attrs.get("business_id")

        if self.instance:
            business = self.instance.business

            if not user_can_access_business(request.user, business):
                raise serializers.ValidationError(
                    {"business_id": "Permission denied for this category."}
                )

            if business_id and int(business_id) != int(business.id):
                raise serializers.ValidationError(
                    {"business_id": "You cannot move category to another business."}
                )
        else:
            if not business_id:
                raise serializers.ValidationError(
                    {"business_id": "Business ID is required."}
                )

            try:
                business = Business.objects.get(id=business_id)
            except Business.DoesNotExist:
                raise serializers.ValidationError(
                    {"business_id": "Invalid business."}
                )

            if not user_can_access_business(request.user, business):
                raise serializers.ValidationError(
                    {"business_id": "Permission denied for this business."}
                )

        name = attrs.get("name", self.instance.name if self.instance else None)

        if name:
            category_qs = ProductCategory.objects.filter(
                business=business,
                name__iexact=name,
            )

            if self.instance:
                category_qs = category_qs.exclude(id=self.instance.id)

            if category_qs.exists():
                raise serializers.ValidationError(
                    {"name": "This category already exists for this business."}
                )

        attrs["business"] = business
        return attrs

    def create(self, validated_data):
        validated_data.pop("business_id", None)
        business = validated_data.pop("business")

        return ProductCategory.objects.create(
            business=business,
            **validated_data,
        )

    def update(self, instance, validated_data):
        validated_data.pop("business_id", None)
        validated_data.pop("business", None)
        validated_data.pop("initial_stock", None)

        return super().update(instance, validated_data)


class ProductCategoryCreateSerializer(ProductCategoryCreateUpdateSerializer):
    pass


class ProductSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    stock_value = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    profit_per_unit = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "business",
            "business_name",
            "category",
            "category_name",
            "name",
            "sku",
            "barcode",
            "description",
            "image",
            "unit",
            "size",
            "color",
            "purchase_price",
            "selling_price",
            "stock_quantity",
            "low_stock_limit",
            "stock_value",
            "profit_per_unit",
            "is_low_stock",
            "status",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "business_name",
            "category_name",
            "stock_quantity",
            "stock_value",
            "profit_per_unit",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and is_business_employee(request.user, instance.business):
            for field_name in ("purchase_price", "stock_value", "profit_per_unit"):
                data.pop(field_name, None)
        return data


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True, required=False)
    initial_stock = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        write_only=True,
        required=False,
        default=0,
        min_value=Decimal("0"),
    )
    stock_quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "business_id",
            "category",
            "name",
            "sku",
            "barcode",
            "description",
            "image",
            "unit",
            "size",
            "color",
            "purchase_price",
            "selling_price",
            "low_stock_limit",
            "initial_stock",
            "stock_quantity",
            "status",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "stock_quantity", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        business = None
        business_id = attrs.get("business_id")

        if self.instance:
            business = self.instance.business

            if not user_can_access_business(request.user, business):
                raise serializers.ValidationError(
                    {"business_id": "Permission denied for this product."}
                )

            if business_id and int(business_id) != int(business.id):
                raise serializers.ValidationError(
                    {"business_id": "You cannot move product to another business."}
                )
        else:
            if not business_id:
                raise serializers.ValidationError(
                    {"business_id": "Business ID is required."}
                )

            try:
                business = Business.objects.get(id=business_id)
            except Business.DoesNotExist:
                raise serializers.ValidationError(
                    {"business_id": "Invalid business."}
                )

            if not user_can_access_business(request.user, business):
                raise serializers.ValidationError(
                    {"business_id": "Permission denied for this business."}
                )

        category = attrs.get("category")

        if category:
            if category.business_id != business.id:
                raise serializers.ValidationError(
                    {"category": "This category does not belong to this business."}
                )

            if not category.is_active:
                raise serializers.ValidationError(
                    {"category": "This category is inactive."}
                )

        name = (attrs.get("name", self.instance.name if self.instance else "") or "").strip()
        size = (attrs.get("size", self.instance.size if self.instance else "") or "").strip()
        color = (attrs.get("color", self.instance.color if self.instance else "") or "").strip()

        product_qs = Product.objects.filter(
            business=business,
            name__iexact=name,
            size__iexact=size,
            color__iexact=color,
        )

        if self.instance:
            product_qs = product_qs.exclude(id=self.instance.id)

        if product_qs.exists():
            label = " / ".join(value for value in (name, size, color) if value)
            raise serializers.ValidationError(
                {"name": f"This product variant already exists: {label}."}
            )

        attrs["name"] = name
        attrs["size"] = size
        attrs["color"] = color
        attrs["business"] = business
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from apps.inventory.models import StockTransaction, StockTransactionType

        validated_data.pop("business_id", None)
        initial_stock = validated_data.pop("initial_stock", 0)
        business = validated_data.pop("business")

        product = Product.objects.create(
            business=business,
            **validated_data,
        )

        if initial_stock > 0:
            request = self.context.get("request")
            StockTransaction.objects.create(
                business=business,
                product=product,
                transaction_type=StockTransactionType.STOCK_IN,
                quantity=initial_stock,
                unit_cost=product.purchase_price,
                note="Initial stock added during product creation.",
                created_by=request.user if request else None,
            )
            product.refresh_from_db(fields=["stock_quantity", "updated_at"])

        return product

    def update(self, instance, validated_data):
        validated_data.pop("business_id", None)
        validated_data.pop("business", None)
        validated_data.pop("initial_stock", None)

        return super().update(instance, validated_data)
