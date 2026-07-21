from rest_framework import serializers

from apps.businesses.models import Business
from apps.core.permissions import is_business_employee, user_can_access_business
from apps.inventory.models import StockTransaction, StockTransactionType
from apps.products.models import Product


class StockTransactionSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    reversed_transaction_reference = serializers.SerializerMethodField()

    class Meta:
        model = StockTransaction
        fields = [
            "id",
            "business",
            "business_name",
            "product",
            "product_name",
            "transaction_type",
            "quantity",
            "previous_quantity",
            "new_quantity",
            "unit_cost",
            "total_cost",
            "note",
            "created_by",
            "created_by_email",
            "is_reversed",
            "is_reversal",
            "reversed_transaction",
            "reversed_transaction_reference",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "business_name",
            "product_name",
            "previous_quantity",
            "new_quantity",
            "total_cost",
            "created_by",
            "created_by_email",
            "is_reversed",
            "is_reversal",
            "reversed_transaction",
            "reversed_transaction_reference",
            "created_at",
            "updated_at",
        ]

    def get_reversed_transaction_reference(self, obj):
        if not obj.reversed_transaction:
            return None

        return {
            "id": obj.reversed_transaction.id,
            "transaction_type": obj.reversed_transaction.transaction_type,
            "quantity": obj.reversed_transaction.quantity,
            "created_at": obj.reversed_transaction.created_at,
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and is_business_employee(request.user, instance.business):
            data.pop("unit_cost", None)
            data.pop("total_cost", None)
        return data


class StockTransactionCreateSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True)
    product_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = StockTransaction
        fields = [
            "id",
            "business_id",
            "product_id",
            "transaction_type",
            "quantity",
            "unit_cost",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        business_id = attrs.get("business_id")
        product_id = attrs.get("product_id")
        transaction_type = attrs.get("transaction_type")
        quantity = attrs.get("quantity")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if is_business_employee(request.user, business_id):
            allowed_employee_types = {
                StockTransactionType.STOCK_OUT,
                StockTransactionType.RETURNED,
                StockTransactionType.DAMAGED,
            }
            if transaction_type not in allowed_employee_types:
                raise serializers.ValidationError(
                    {"transaction_type": "Employees can only record stock out, returns, or damage."}
                )
            attrs["unit_cost"] = 0

        if transaction_type == StockTransactionType.ADJUSTMENT:
            if quantity < 0:
                raise serializers.ValidationError(
                    {"quantity": "Adjustment quantity cannot be negative."}
                )
        else:
            if quantity <= 0:
                raise serializers.ValidationError(
                    {"quantity": "Quantity must be greater than 0."}
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

        if not business.is_available:
            raise serializers.ValidationError(
                {"business_id": "This business is not active."}
            )

        try:
            product = Product.objects.get(
                id=product_id,
                business=business,
                is_active=True,
            )
        except Product.DoesNotExist:
            raise serializers.ValidationError(
                {"product_id": "Invalid or inactive product for this business."}
            )

        if transaction_type in [
            StockTransactionType.STOCK_OUT,
            StockTransactionType.DAMAGED,
        ]:
            if product.stock_quantity < quantity:
                raise serializers.ValidationError(
                    {
                        "quantity": f"Not enough stock. Current stock is {product.stock_quantity}."
                    }
                )

        attrs["business"] = business
        attrs["product"] = product

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        validated_data.pop("business_id")
        validated_data.pop("product_id")

        stock_transaction = StockTransaction.objects.create(
            business=validated_data.pop("business"),
            product=validated_data.pop("product"),
            created_by=request.user,
            **validated_data,
        )

        return stock_transaction
