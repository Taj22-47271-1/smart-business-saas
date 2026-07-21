from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.businesses.models import Business, BusinessMember, BusinessMemberRole, BusinessMemberStatus
from apps.businesses.serializers import BusinessMemberCreateSerializer, BusinessMemberSerializer
from apps.core.permissions import IsBusinessOwner, get_user_business_queryset, user_has_business_role
from apps.businesses.serializers import BusinessCreateSerializer, BusinessSerializer


class MyBusinessListView(generics.ListAPIView):
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # Platform admins never receive private business operational access.
        if user.role == UserRole.SUPER_ADMIN:
            return Business.objects.none()

        return get_user_business_queryset(user).filter(is_active=True)


class BusinessCreateView(generics.CreateAPIView):
    serializer_class = BusinessCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user

        if user.role == UserRole.SUPER_ADMIN:
            raise PermissionDenied("Platform administrators cannot create private businesses.")

        serializer.save(owner=user)


class BusinessDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        return Business.objects.filter(
            memberships__user=user,
            memberships__role=BusinessMemberRole.OWNER,
            memberships__status=BusinessMemberStatus.ACTIVE,
        ).distinct()

    def perform_update(self, serializer):
        business = self.get_object()
        user = self.request.user

        if not user_has_business_role(user, business, BusinessMemberRole.OWNER):
            raise PermissionDenied("You do not have permission to update this business.")

        serializer.save()


class BusinessMemberListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsBusinessOwner]

    def get_business(self):
        return Business.objects.get(pk=self.kwargs["business_id"])

    def get_queryset(self):
        return BusinessMember.objects.filter(
            business_id=self.kwargs["business_id"],
        ).select_related("business", "user")

    def get_serializer_class(self):
        return BusinessMemberCreateSerializer if self.request.method == "POST" else BusinessMemberSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["business"] = self.get_business()
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.save()
        member = BusinessMember.objects.select_related("user", "business").get(pk=member.pk)
        return Response(
            BusinessMemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )


class BusinessMemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BusinessMemberSerializer
    permission_classes = [permissions.IsAuthenticated, IsBusinessOwner]

    def get_queryset(self):
        return BusinessMember.objects.filter(
            business_id=self.kwargs["business_id"],
        ).exclude(role=BusinessMemberRole.OWNER).select_related("business", "user")

    def perform_destroy(self, instance):
        # Keep the user account for possible memberships in other businesses.
        from apps.chat.models import SupportThread
        SupportThread.objects.filter(
            business=instance.business,
            member=instance.user,
        ).delete()
        instance.delete()
