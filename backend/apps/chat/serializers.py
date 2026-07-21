from rest_framework import serializers

from apps.businesses.models import (
    Business,
    BusinessMember,
    BusinessMemberRole,
    BusinessMemberStatus,
)
from apps.chat.models import SupportMessage, SupportThread, SupportThreadType
from apps.core.permissions import is_super_admin


class ChatParticipantSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    name = serializers.SerializerMethodField()
    business_id = serializers.IntegerField(source="business.id", read_only=True)
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = BusinessMember
        fields = ["user_id", "email", "name", "business_id", "business_name", "role"]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class SupportMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.SerializerMethodField()

    class Meta:
        model = SupportMessage
        fields = ["id", "thread", "sender", "sender_name", "sender_role", "body", "is_read", "created_at"]
        read_only_fields = fields

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username or obj.sender.email

    def get_sender_role(self, obj):
        return "SUPER_ADMIN" if is_super_admin(obj.sender) else "BUSINESS_MEMBER"


class SupportThreadSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    member_email = serializers.EmailField(source="member.email", read_only=True)
    member_name = serializers.SerializerMethodField()
    member_role = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = SupportThread
        fields = [
            "id", "thread_type", "business", "business_name", "member", "member_email",
            "member_name", "member_role", "owner", "owner_name", "owner_email",
            "last_message", "unread_count",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_member_name(self, obj):
        return obj.member.get_full_name() or obj.member.username

    def get_member_role(self, obj):
        membership = obj.member.business_memberships.filter(
            business=obj.business,
            status=BusinessMemberStatus.ACTIVE,
        ).first()
        return membership.role if membership else "INACTIVE"

    def get_owner_name(self, obj):
        if not obj.owner:
            return None
        return obj.owner.get_full_name() or obj.owner.username

    def get_last_message(self, obj):
        message = obj.messages.order_by("-created_at").first()
        if not message:
            return None
        return {
            "body": message.body,
            "sender_id": message.sender_id,
            "created_at": message.created_at,
        }

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()


class SupportThreadCreateSerializer(serializers.Serializer):
    business_id = serializers.IntegerField()
    member_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        request = self.context["request"]
        business_id = attrs["business_id"]
        member_id = attrs.get("member_id") if is_super_admin(request.user) else request.user.id

        business = Business.objects.filter(id=business_id, is_active=True).first()
        if not business:
            raise serializers.ValidationError("Active business was not found.")

        membership = BusinessMember.objects.filter(
            business_id=business_id,
            user_id=member_id,
            status=BusinessMemberStatus.ACTIVE,
        ).select_related("business", "user").first()

        # Backward compatibility for databases created before owner membership
        # rows were introduced. Owners must still be able to contact Super Admin.
        if not membership and business.owner_id == member_id:
            membership, _ = BusinessMember.objects.update_or_create(
                business=business,
                user_id=member_id,
                defaults={
                    "role": BusinessMemberRole.OWNER,
                    "status": BusinessMemberStatus.ACTIVE,
                },
            )
            membership = BusinessMember.objects.select_related(
                "business", "user"
            ).get(pk=membership.pk)

        if not membership:
            raise serializers.ValidationError("Active business membership was not found.")

        attrs["membership"] = membership
        return attrs

    def create(self, validated_data):
        membership = validated_data["membership"]
        thread, _ = SupportThread.objects.get_or_create(
            thread_type=SupportThreadType.PLATFORM,
            business=membership.business,
            member=membership.user,
            defaults={"created_by": self.context["request"].user},
        )
        return thread


class SupportMessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=4000, trim_whitespace=True)

    def validate_body(self, value):
        if not value:
            raise serializers.ValidationError("Message cannot be empty.")
        return value

    def create(self, validated_data):
        thread = self.context["thread"]
        message = SupportMessage.objects.create(
            thread=thread,
            sender=self.context["request"].user,
            body=validated_data["body"],
        )
        SupportThread.objects.filter(pk=thread.pk).update(updated_at=message.created_at)
        return message
