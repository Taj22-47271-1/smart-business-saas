from django.utils import timezone
from rest_framework import serializers

from apps.businesses.models import Business
from apps.core.permissions import user_can_access_business
from apps.payments.models import Payment, PaymentStatus
from apps.subscriptions.models import Subscription, SubscriptionPlan


class PaymentSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="business.owner.email", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_features = serializers.JSONField(source="plan.features", read_only=True)
    plan_interval = serializers.CharField(source="plan.interval", read_only=True)
    plan_duration_count = serializers.IntegerField(
        source="plan.duration_count", read_only=True
    )
    approved_by_email = serializers.EmailField(source="approved_by.email", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "business",
            "business_name",
            "owner_name",
            "owner_email",
            "user",
            "user_email",
            "plan",
            "plan_name",
            "plan_features",
            "plan_interval",
            "plan_duration_count",
            "amount",
            "payment_method",
            "sender_number",
            "transaction_id",
            "screenshot",
            "status",
            "note",
            "rejection_reason",
            "approved_by",
            "approved_by_email",
            "paid_at",
            "approved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "business_name",
            "owner_name",
            "owner_email",
            "user",
            "user_email",
            "plan_name",
            "plan_features",
            "plan_interval",
            "plan_duration_count",
            "status",
            "rejection_reason",
            "approved_by",
            "approved_by_email",
            "approved_at",
            "created_at",
            "updated_at",
        ]

    def get_owner_name(self, obj):
        owner = obj.business.owner
        return owner.get_full_name() or owner.username


class PaymentCreateSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True)
    plan_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "business_id",
            "plan_id",
            "amount",
            "payment_method",
            "sender_number",
            "transaction_id",
            "screenshot",
            "note",
            "paid_at",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        business_id = attrs.get("business_id")
        plan_id = attrs.get("plan_id")
        amount = attrs.get("amount")
        transaction_id = attrs.get("transaction_id")
        paid_at = attrs.get("paid_at")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if amount is None or amount <= 0:
            raise serializers.ValidationError(
                {"amount": "Amount must be greater than 0."}
            )

        if not transaction_id:
            raise serializers.ValidationError(
                {"transaction_id": "Transaction ID is required."}
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

        if not business.is_active:
            raise serializers.ValidationError(
                {"business_id": "This business is inactive."}
            )

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            raise serializers.ValidationError(
                {"plan_id": "Invalid or inactive subscription plan."}
            )

        if Payment.objects.filter(transaction_id__iexact=transaction_id).exists():
            raise serializers.ValidationError(
                {"transaction_id": "This transaction ID has already been submitted."}
            )

        if paid_at and paid_at > timezone.now():
            raise serializers.ValidationError(
                {"paid_at": "Paid time cannot be in the future."}
            )

        attrs["business"] = business
        attrs["plan"] = plan

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        validated_data.pop("business_id")
        validated_data.pop("plan_id")

        payment = Payment.objects.create(
            user=request.user,
            business=validated_data.pop("business"),
            plan=validated_data.pop("plan"),
            status=PaymentStatus.PENDING,
            **validated_data,
        )

        return payment


class PaymentApproveSerializer(serializers.Serializer):
    # Optional legacy override; normally the selected plan controls duration.
    subscription_days = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs):
        payment = self.context.get("payment")

        if not payment:
            raise serializers.ValidationError("Payment context is required.")

        if payment.status != PaymentStatus.PENDING:
            raise serializers.ValidationError(
                "Only pending payments can be approved."
            )

        if not payment.business:
            raise serializers.ValidationError(
                "This payment has no business."
            )

        if not payment.plan:
            raise serializers.ValidationError(
                "This payment has no subscription plan."
            )

        if not payment.business.is_active:
            raise serializers.ValidationError(
                "This business is inactive. Activate the business before approving payment."
            )

        return attrs

    def save(self, **kwargs):
        request = self.context.get("request")
        payment = self.context.get("payment")
        subscription_days = self.validated_data.get("subscription_days")

        # Older databases may contain a business without the one-to-one
        # subscription row. Repair it during approval instead of leaving the
        # payment stuck or partially approved.
        subscription, _ = Subscription.objects.get_or_create(
            business=payment.business,
        )

        subscription.activate_subscription(
            plan=payment.plan,
            days=subscription_days,
            payment_id=payment.id,
            renew=True,
        )

        payment.status = PaymentStatus.APPROVED
        payment.approved_by = request.user
        payment.approved_at = timezone.now()

        if not payment.paid_at:
            payment.paid_at = timezone.now()

        payment.save(
            update_fields=[
                "status",
                "approved_by",
                "approved_at",
                "paid_at",
                "updated_at",
            ]
        )

        return payment


class PaymentRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(max_length=500)

    def validate(self, attrs):
        payment = self.context.get("payment")
        rejection_reason = attrs.get("rejection_reason")

        if not payment:
            raise serializers.ValidationError("Payment context is required.")

        if payment.status != PaymentStatus.PENDING:
            raise serializers.ValidationError(
                "Only pending payments can be rejected."
            )

        if not rejection_reason or not rejection_reason.strip():
            raise serializers.ValidationError(
                {"rejection_reason": "Rejection reason is required."}
            )

        return attrs

    def save(self, **kwargs):
        request = self.context.get("request")
        payment = self.context.get("payment")

        payment.status = PaymentStatus.REJECTED
        payment.approved_by = request.user
        payment.approved_at = timezone.now()
        payment.rejection_reason = self.validated_data["rejection_reason"].strip()
        payment.save()

        return payment
