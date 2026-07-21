from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.businesses.models import BusinessMember, BusinessMemberStatus
from apps.chat.models import SupportMessage, SupportThread, SupportThreadType
from apps.chat.serializers import (
    ChatParticipantSerializer,
    SupportMessageCreateSerializer,
    SupportMessageSerializer,
    SupportThreadCreateSerializer,
    SupportThreadSerializer,
)
from apps.core.permissions import IsSuperAdmin, is_super_admin


def thread_queryset_for(user):
    queryset = SupportThread.objects.select_related("business", "member", "owner", "created_by")
    if is_super_admin(user):
        # Platform admins never see private owner-employee conversations.
        return queryset.filter(thread_type=SupportThreadType.PLATFORM)
    return queryset.filter(
        Q(business__owner=user)
        | Q(
            business__memberships__user=user,
            business__memberships__status=BusinessMemberStatus.ACTIVE,
        )
    ).filter(
        Q(thread_type=SupportThreadType.PLATFORM, member=user)
        | Q(thread_type=SupportThreadType.OWNER_EMPLOYEE, member=user)
        | Q(thread_type=SupportThreadType.OWNER_EMPLOYEE, owner=user)
    ).distinct()


class ChatParticipantListView(generics.ListAPIView):
    serializer_class = ChatParticipantSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        return BusinessMember.objects.filter(
            status=BusinessMemberStatus.ACTIVE,
        ).select_related("business", "user").order_by("business__name", "role", "user__email")


class SupportThreadListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return thread_queryset_for(self.request.user).prefetch_related("messages")

    def get_serializer_class(self):
        return SupportThreadCreateSerializer if self.request.method == "POST" else SupportThreadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        thread = serializer.save()
        return Response(
            SupportThreadSerializer(thread, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class SupportMessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_thread(self):
        return get_object_or_404(
            thread_queryset_for(self.request.user),
            pk=self.kwargs["thread_id"],
        )

    def get_queryset(self):
        return SupportMessage.objects.filter(thread=self.get_thread()).select_related("sender", "thread")

    def get_serializer_class(self):
        return SupportMessageCreateSerializer if self.request.method == "POST" else SupportMessageSerializer

    def list(self, request, *args, **kwargs):
        thread = self.get_thread()
        thread.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        thread = self.get_thread()
        serializer = self.get_serializer(data=request.data, context={"request": request, "thread": thread})
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        return Response(
            SupportMessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
