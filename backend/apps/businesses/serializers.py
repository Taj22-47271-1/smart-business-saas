from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.accounts.models import User, UserRole
from apps.businesses.models import (
    Business,
    BusinessMember,
    BusinessMemberRole,
    BusinessMemberStatus,
)
from apps.subscriptions.models import Subscription


class BusinessSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    subscription_status = serializers.SerializerMethodField()
    trial_end_date = serializers.SerializerMethodField()
    has_access = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = [
            "id",
            "owner",
            "owner_email",
            "name",
            "slug",
            "phone",
            "email",
            "address",
            "logo",
            "banner",
            "currency",
            "status",
            "is_active",
            "subscription_status",
            "trial_end_date",
            "has_access",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "owner",
            "owner_email",
            "status",
            "is_active",
            "subscription_status",
            "trial_end_date",
            "has_access",
            "created_at",
            "updated_at",
        ]

    def get_subscription_status(self, obj):
        if hasattr(obj, "subscription"):
            return obj.subscription.status
        return None

    def get_trial_end_date(self, obj):
        if hasattr(obj, "subscription"):
            return obj.subscription.trial_end_date
        return None

    def get_has_access(self, obj):
        if hasattr(obj, "subscription"):
            return obj.subscription.has_access
        return False


class BusinessCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = [
            "id",
            "name",
            "slug",
            "phone",
            "email",
            "address",
            "logo",
            "banner",
            "currency",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_slug(self, value):
        if Business.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This business slug is already taken.")
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["owner"] = request.user

        business = Business.objects.create(**validated_data)

        # Business permissions are membership-based; creators always become owners.
        BusinessMember.objects.create(
            business=business,
            user=request.user,
            role=BusinessMemberRole.OWNER,
        )

        # Keep the original platform-level owner label in sync as well. Actual
        # business permissions still come from BusinessMember so one user can
        # safely belong to multiple businesses.
        if request.user.role == UserRole.USER:
            request.user.role = UserRole.BUSINESS_OWNER
            request.user.save(update_fields=["role"])

        Subscription.objects.create(
            business=business,
        )

        return business


class BusinessMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    name = serializers.SerializerMethodField()
    must_change_password = serializers.BooleanField(source="user.must_change_password", read_only=True)
    added_by_email = serializers.EmailField(source="added_by.email", read_only=True)

    class Meta:
        model = BusinessMember
        fields = [
            "id", "business", "user", "email", "name", "must_change_password",
            "added_by", "added_by_email", "role", "status",
            "joined_at", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "business", "user", "email", "name", "must_change_password",
            "added_by", "added_by_email", "joined_at",
            "created_at", "updated_at",
        ]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def validate_role(self, value):
        if value in {BusinessMemberRole.OWNER, BusinessMemberRole.EMPLOYEE}:
            raise serializers.ValidationError("Choose Manager, Accountant, or Staff.")
        return value


class BusinessMemberCreateSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    temporary_password = serializers.CharField(write_only=True, min_length=8, required=False)
    role = serializers.ChoiceField(
        choices=[
            BusinessMemberRole.MANAGER,
            BusinessMemberRole.ACCOUNTANT,
            BusinessMemberRole.STAFF,
        ],
        default=BusinessMemberRole.STAFF,
    )

    def validate_email(self, value):
        user = User.objects.filter(email__iexact=value).first()
        if user and user.role == UserRole.SUPER_ADMIN:
            raise serializers.ValidationError("Platform administrators cannot join businesses.")
        self.context["member_user"] = user
        return value.lower()

    def validate(self, attrs):
        business = self.context["business"]
        user = self.context["member_user"]
        if user and BusinessMember.objects.filter(business=business, user=user).exists():
            raise serializers.ValidationError({"email": "This user is already a member."})
        if not user:
            password = attrs.get("temporary_password")
            if not password:
                raise serializers.ValidationError(
                    {"temporary_password": "A temporary password is required for a new employee."}
                )
            validate_password(password)
        return attrs

    def create(self, validated_data):
        user = self.context["member_user"]
        if not user:
            email = validated_data["email"]
            base_username = (email.split("@", 1)[0] or "employee")[:120]
            username = base_username
            suffix = 1
            while User.objects.filter(username=username).exists():
                suffix += 1
                username = f"{base_username}-{suffix}"
            user = User.objects.create_user(
                email=email,
                username=username,
                password=validated_data["temporary_password"],
                first_name=validated_data.get("first_name", ""),
                last_name=validated_data.get("last_name", ""),
                role=UserRole.USER,
                must_change_password=True,
            )
        membership = BusinessMember.objects.create(
            business=self.context["business"],
            user=user,
            added_by=self.context["request"].user,
            role=validated_data.get("role", BusinessMemberRole.STAFF),
            status=BusinessMemberStatus.ACTIVE,
        )
        # Every employee gets a private thread with the owner who added them.
        from apps.chat.models import SupportThread, SupportThreadType
        SupportThread.objects.get_or_create(
            thread_type=SupportThreadType.OWNER_EMPLOYEE,
            business=membership.business,
            owner=membership.added_by,
            member=membership.user,
            defaults={"created_by": membership.added_by},
        )
        return membership
