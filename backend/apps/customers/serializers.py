from django.db import transaction
from rest_framework import serializers

from apps.businesses.models import Business
from apps.core.permissions import user_can_access_business
from apps.customers.models import Customer, CustomerPayment
from apps.sales.models import Sale, SalePayment, SalePaymentStatus, SaleStatus


class CustomerSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "business",
            "business_name",
            "name",
            "phone",
            "email",
            "address",
            "opening_due",
            "current_due",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "business_name",
            "current_due",
            "created_at",
            "updated_at",
        ]


class CustomerCreateUpdateSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Customer
        fields = [
            "id",
            "business_id",
            "name",
            "phone",
            "email",
            "address",
            "opening_due",
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
                    {"business_id": "Permission denied for this customer."}
                )

            if business_id and int(business_id) != int(business.id):
                raise serializers.ValidationError(
                    {"business_id": "You cannot move customer to another business."}
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

        opening_due = attrs.get(
            "opening_due",
            self.instance.opening_due if self.instance else 0,
        )

        if opening_due < 0:
            raise serializers.ValidationError(
                {"opening_due": "Opening due cannot be negative."}
            )

        phone = attrs.get("phone", self.instance.phone if self.instance else None)

        if phone:
            customer_qs = Customer.objects.filter(
                business=business,
                phone=phone,
            )

            if self.instance:
                customer_qs = customer_qs.exclude(id=self.instance.id)

            if customer_qs.exists():
                raise serializers.ValidationError(
                    {"phone": "This phone number already exists for this business."}
                )

        attrs["business"] = business
        return attrs

    def create(self, validated_data):
        validated_data.pop("business_id", None)
        business = validated_data.pop("business")

        opening_due = validated_data.get("opening_due", 0)

        customer = Customer.objects.create(
            business=business,
            **validated_data,
        )

        customer.current_due = opening_due
        customer.save(update_fields=["current_due"])

        return customer

    def update(self, instance, validated_data):
        validated_data.pop("business_id", None)
        validated_data.pop("business", None)

        old_opening_due = instance.opening_due
        new_opening_due = validated_data.get("opening_due", old_opening_due)

        customer = super().update(instance, validated_data)

        if new_opening_due != old_opening_due:
            difference = new_opening_due - old_opening_due
            customer.current_due = customer.current_due + difference

            if customer.current_due < 0:
                customer.current_due = 0

            customer.save(update_fields=["current_due"])

        return customer


class CustomerPaymentSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)

    class Meta:
        model = CustomerPayment
        fields = [
            "id",
            "business",
            "business_name",
            "customer",
            "customer_name",
            "customer_phone",
            "amount",
            "payment_method",
            "note",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "business_name",
            "customer_name",
            "customer_phone",
            "created_at",
        ]


class CustomerPaymentCreateSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True)
    customer_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = CustomerPayment
        fields = [
            "id",
            "business_id",
            "customer_id",
            "amount",
            "payment_method",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        business_id = attrs.get("business_id")
        customer_id = attrs.get("customer_id")
        amount = attrs.get("amount")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if amount <= 0:
            raise serializers.ValidationError(
                {"amount": "Amount must be greater than 0."}
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
            customer = Customer.objects.get(
                id=customer_id,
                business=business,
                is_active=True,
            )
        except Customer.DoesNotExist:
            raise serializers.ValidationError(
                {"customer_id": "Invalid or inactive customer for this business."}
            )

        if customer.current_due <= 0:
            raise serializers.ValidationError(
                {"amount": "This customer has no due balance."}
            )

        if amount > customer.current_due:
            raise serializers.ValidationError(
                {
                    "amount": (
                        "Payment amount cannot be greater than current due. "
                        f"Current due is {customer.current_due}."
                    )
                }
            )

        attrs["business"] = business
        attrs["customer"] = customer

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")
        validated_data.pop("business_id")
        validated_data.pop("customer_id")
        business = validated_data.pop("business")
        customer_reference = validated_data.pop("customer")
        amount = validated_data["amount"]
        payment_method = validated_data.get("payment_method", "Cash")
        note = validated_data.get("note")

        customer = Customer.objects.select_for_update().get(pk=customer_reference.pk)
        if amount > customer.current_due:
            raise serializers.ValidationError(
                {"amount": f"Payment cannot exceed current due of {customer.current_due}."}
            )

        receipt = CustomerPayment.objects.create(
            business=business,
            customer=customer,
            **validated_data,
        )

        remaining = amount
        due_sales = Sale.objects.select_for_update().filter(
            business=business,
            customer=customer,
            status=SaleStatus.ACTIVE,
            due_amount__gt=0,
        ).order_by("created_at", "id")

        for sale in due_sales:
            if remaining <= 0:
                break

            allocation = min(remaining, sale.due_amount)
            previous_paid = sale.paid_amount
            SalePayment.objects.create(
                sale=sale,
                amount=allocation,
                payment_method=payment_method,
                note=(
                    f"Allocated from customer payment receipt #{receipt.id}. "
                    f"{note or ''}"
                ).strip(),
                received_by=request.user if request else None,
            )

            sale.paid_amount = previous_paid + allocation
            sale.due_amount = sale.total_amount - sale.paid_amount
            if sale.due_amount <= 0:
                sale.due_amount = 0
                sale.payment_status = SalePaymentStatus.PAID
            else:
                sale.payment_status = SalePaymentStatus.PARTIAL

            if previous_paid <= 0:
                sale.payment_method = payment_method
            elif sale.payment_method != payment_method and sale.payment_method != "Multiple":
                sale.payment_method = "Multiple"

            sale.save(
                update_fields=[
                    "paid_amount",
                    "due_amount",
                    "payment_status",
                    "payment_method",
                    "updated_at",
                ]
            )
            remaining -= allocation

        return receipt

