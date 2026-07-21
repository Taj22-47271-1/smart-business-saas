from rest_framework import serializers

from apps.subscriptions.models import Subscription, SubscriptionPlan


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "name",
            "description",
            "price",
            "interval",
            "duration_count",
            "max_products",
            "max_staff",
            "has_reports",
            "has_online_shop",
            "has_pdf_invoice",
            "features",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value

    def validate_name(self, value):
        queryset = SubscriptionPlan.objects.filter(name__iexact=value.strip())
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A subscription plan with this name already exists.")
        return value.strip()

    def validate_duration_count(self, value):
        if value < 1:
            raise serializers.ValidationError("Duration must be at least 1.")
        return value

    def validate_features(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Features must be a list.")

        cleaned = []
        for feature in value:
            if not isinstance(feature, str):
                raise serializers.ValidationError("Each feature must be text.")
            feature = feature.strip()
            if feature and feature not in cleaned:
                cleaned.append(feature)
        return cleaned

    def validate(self, attrs):
        interval = attrs.get("interval", self.instance.interval if self.instance else "MONTHLY")
        if interval == "LIFETIME":
            attrs["duration_count"] = 1
        return attrs


class SubscriptionSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    owner_id = serializers.IntegerField(source="business.owner_id", read_only=True)
    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="business.owner.email", read_only=True)
    owner_phone = serializers.CharField(source="business.owner.phone", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_description = serializers.CharField(source="plan.description", read_only=True)
    plan_features = serializers.JSONField(source="plan.features", read_only=True)
    plan_price = serializers.DecimalField(
        source="plan.price", max_digits=10, decimal_places=2, read_only=True
    )
    plan_interval = serializers.CharField(source="plan.interval", read_only=True)
    plan_duration_count = serializers.IntegerField(
        source="plan.duration_count", read_only=True
    )
    plan_max_products = serializers.IntegerField(
        source="plan.max_products", read_only=True
    )
    plan_max_staff = serializers.IntegerField(source="plan.max_staff", read_only=True)
    plan_has_reports = serializers.BooleanField(
        source="plan.has_reports", read_only=True
    )
    plan_has_online_shop = serializers.BooleanField(
        source="plan.has_online_shop", read_only=True
    )
    plan_has_pdf_invoice = serializers.BooleanField(
        source="plan.has_pdf_invoice", read_only=True
    )
    has_access = serializers.BooleanField(read_only=True)
    is_trial_valid = serializers.BooleanField(read_only=True)
    is_subscription_valid = serializers.BooleanField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True, allow_null=True)
    expiry_status = serializers.SerializerMethodField()
    latest_payment_status = serializers.SerializerMethodField()
    latest_payment_amount = serializers.SerializerMethodField()
    latest_payment_proof = serializers.SerializerMethodField()
    payment_history = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = [
            "id",
            "business",
            "business_name",
            "owner_id",
            "owner_name",
            "owner_email",
            "owner_phone",
            "plan",
            "plan_name",
            "plan_description",
            "plan_features",
            "plan_price",
            "plan_interval",
            "plan_duration_count",
            "plan_max_products",
            "plan_max_staff",
            "plan_has_reports",
            "plan_has_online_shop",
            "plan_has_pdf_invoice",
            "status",
            "trial_start_date",
            "trial_end_date",
            "subscription_start_date",
            "subscription_end_date",
            "last_payment_id",
            "is_locked",
            "is_trial_valid",
            "is_subscription_valid",
            "has_access",
            "days_remaining",
            "expiry_status",
            "latest_payment_status",
            "latest_payment_amount",
            "latest_payment_proof",
            "payment_history",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_owner_name(self, obj):
        owner = obj.business.owner
        return owner.get_full_name() or owner.username

    def _latest_payment(self, obj):
        if not hasattr(obj, "_latest_payment_cache"):
            obj._latest_payment_cache = obj.business.payments.order_by("-created_at").first()
        return obj._latest_payment_cache

    def get_latest_payment_status(self, obj):
        payment = self._latest_payment(obj)
        return payment.status if payment else None

    def get_expiry_status(self, obj):
        if obj.status in ("ACTIVE", "TRIAL") and not obj.has_access:
            return "EXPIRED"
        return obj.status

    def get_latest_payment_amount(self, obj):
        payment = self._latest_payment(obj)
        return str(payment.amount) if payment else None

    def get_latest_payment_proof(self, obj):
        payment = self._latest_payment(obj)
        if not payment or not payment.screenshot:
            return None
        request = self.context.get("request")
        url = payment.screenshot.url
        return request.build_absolute_uri(url) if request else url

    def get_payment_history(self, obj):
        from apps.payments.serializers import PaymentSerializer

        payments = obj.business.payments.select_related(
            "business", "business__owner", "user", "plan", "approved_by"
        ).order_by("-created_at")
        return PaymentSerializer(payments, many=True, context=self.context).data


class AdminSubscriptionPlanUpdateSerializer(serializers.Serializer):
    plan_id = serializers.PrimaryKeyRelatedField(
        source="plan",
        queryset=SubscriptionPlan.objects.all(),
    )

    def update(self, instance, validated_data):
        instance.activate_subscription(plan=validated_data["plan"])
        return instance

    def create(self, validated_data):
        raise NotImplementedError
