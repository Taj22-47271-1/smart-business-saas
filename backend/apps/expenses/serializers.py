from rest_framework import serializers

from apps.businesses.models import Business
from apps.core.permissions import user_can_access_business
from apps.expenses.models import Expense, ExpenseCategory


class ExpenseCategorySerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = ExpenseCategory
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


class ExpenseCategoryCreateUpdateSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = ExpenseCategory
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

            if not business.is_available:
                raise serializers.ValidationError(
                    {"business_id": "This business is not active."}
                )

        name = attrs.get("name", self.instance.name if self.instance else None)

        if name:
            category_qs = ExpenseCategory.objects.filter(
                business=business,
                name__iexact=name,
            )

            if self.instance:
                category_qs = category_qs.exclude(id=self.instance.id)

            if category_qs.exists():
                raise serializers.ValidationError(
                    {"name": "This expense category already exists for this business."}
                )

        attrs["business"] = business
        return attrs

    def create(self, validated_data):
        validated_data.pop("business_id", None)
        business = validated_data.pop("business")

        return ExpenseCategory.objects.create(
            business=business,
            **validated_data,
        )

    def update(self, instance, validated_data):
        validated_data.pop("business_id", None)
        validated_data.pop("business", None)

        return super().update(instance, validated_data)


class ExpenseSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "business",
            "business_name",
            "category",
            "category_name",
            "title",
            "amount",
            "expense_date",
            "payment_method",
            "note",
            "created_by",
            "created_by_email",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "business_name",
            "category_name",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]


class ExpenseCreateUpdateSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Expense
        fields = [
            "id",
            "business_id",
            "category",
            "title",
            "amount",
            "expense_date",
            "payment_method",
            "note",
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
                    {"business_id": "Permission denied for this expense."}
                )

            if business_id and int(business_id) != int(business.id):
                raise serializers.ValidationError(
                    {"business_id": "You cannot move expense to another business."}
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

            if not business.is_available:
                raise serializers.ValidationError(
                    {"business_id": "This business is not active."}
                )

        amount = attrs.get("amount", self.instance.amount if self.instance else None)

        if amount is not None and amount <= 0:
            raise serializers.ValidationError(
                {"amount": "Amount must be greater than 0."}
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

        attrs["business"] = business
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        validated_data.pop("business_id", None)
        business = validated_data.pop("business")

        return Expense.objects.create(
            business=business,
            created_by=request.user,
            **validated_data,
        )

    def update(self, instance, validated_data):
        validated_data.pop("business_id", None)
        validated_data.pop("business", None)

        return super().update(instance, validated_data)