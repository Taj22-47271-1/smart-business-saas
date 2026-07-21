import random

from django.contrib.auth.password_validation import validate_password
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import PasswordResetOTP, User


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    business_memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone",
            "role",
            "is_email_verified",
            "is_phone_verified",
            "must_change_password",
            "created_at",
            "business_memberships",
        ]
        read_only_fields = [
            "id",
            "role",
            "is_email_verified",
            "is_phone_verified",
            "must_change_password",
            "created_at",
            "business_memberships",
        ]

    def get_role(self, obj):
        # A Django superuser is always a platform Super Admin, even when an old
        # database still contains USER in the custom role column.
        return "SUPER_ADMIN" if obj.is_superuser else obj.role

    def get_business_memberships(self, obj):
        """Return active business roles and keep old owner records compatible.

        Some older databases contain a Business.owner relationship without the
        matching BusinessMember row. The frontend uses this list for sidebar and
        route permissions, so include the owner relationship as an OWNER role
        until the repair migration creates the missing membership.
        """
        memberships = []
        included_business_ids = set()

        for membership in obj.business_memberships.select_related("business").all():
            memberships.append(
                {
                    "business_id": membership.business_id,
                    "business_name": membership.business.name,
                    "role": membership.role,
                    "status": membership.status,
                }
            )
            included_business_ids.add(membership.business_id)

        for business in obj.owned_businesses.filter(is_active=True):
            if business.id in included_business_ids:
                continue
            memberships.append(
                {
                    "business_id": business.id,
                    "business_name": business.name,
                    "role": "OWNER",
                    "status": "ACTIVE",
                }
            )

        return memberships


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone",
            "password",
            "confirm_password",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        password = attrs.get("password")
        confirm_password = attrs.get("confirm_password")

        if password != confirm_password:
            raise serializers.ValidationError(
                {"confirm_password": "Password and confirm password do not match."}
            )

        validate_password(password)
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")

        return value

    def validate(self, attrs):
        user = self.context["request"].user
        new_password = attrs["new_password"]

        if new_password != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "New password and confirmation do not match."}
            )

        if user.check_password(new_password):
            raise serializers.ValidationError(
                {"new_password": "New password must be different from the current password."}
            )

        validate_password(new_password, user=user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return user


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("No account found with this email.")
        return value

    def save(self, **kwargs):
        email = self.validated_data["email"]
        user = User.objects.get(email=email)

        PasswordResetOTP.objects.filter(
            user=user,
            is_used=False,
        ).update(is_used=True)

        otp = str(random.randint(100000, 999999))

        PasswordResetOTP.objects.create(
            user=user,
            email=email,
            otp=otp,
        )

        send_mail(
            subject="Your Smart Business SaaS Password Reset OTP",
            message=f"Your password reset OTP is: {otp}. This OTP will expire in 10 minutes.",
            from_email=None,
            recipient_list=[email],
            fail_silently=False,
        )

        return {
            "message": "Password reset OTP sent successfully. Check your email or console.",
        }


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        email = attrs.get("email")
        otp = attrs.get("otp")
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError(
                {"confirm_password": "New password and confirm password do not match."}
            )

        validate_password(new_password)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "Invalid email address."})

        otp_obj = (
            PasswordResetOTP.objects.filter(
                user=user,
                email=email,
                otp=otp,
                is_used=False,
            )
            .order_by("-created_at")
            .first()
        )

        if not otp_obj:
            raise serializers.ValidationError({"otp": "Invalid OTP."})

        if otp_obj.is_expired:
            raise serializers.ValidationError({"otp": "OTP has expired."})

        attrs["user"] = user
        attrs["otp_obj"] = otp_obj

        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        otp_obj = self.validated_data["otp_obj"]
        new_password = self.validated_data["new_password"]

        user.set_password(new_password)
        user.save()

        otp_obj.is_used = True
        otp_obj.save()

        PasswordResetOTP.objects.filter(
            user=user,
            is_used=False,
            created_at__lt=timezone.now(),
        ).update(is_used=True)

        return {
            "message": "Password reset successfully. You can login with your new password.",
        }
