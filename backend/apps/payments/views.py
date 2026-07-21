from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import (
    HasBusinessAccess,
    IsBusinessOwner,
    IsSuperAdmin,
    get_user_business_queryset,
)
from apps.payments.models import Payment
from apps.businesses.models import BusinessMemberRole, BusinessMemberStatus
from apps.payments.serializers import (
    PaymentApproveSerializer,
    PaymentCreateSerializer,
    PaymentRejectSerializer,
    PaymentSerializer,
)


class MyPaymentListView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        return Payment.objects.select_related(
            "business",
            "user",
            "plan",
            "approved_by",
        ).filter(
            user=user,
            business__memberships__user=user,
            business__memberships__role=BusinessMemberRole.OWNER,
            business__memberships__status=BusinessMemberStatus.ACTIVE,
        ).distinct()


class BusinessPaymentListView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasBusinessAccess,
        IsBusinessOwner,
    ]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        return Payment.objects.select_related(
            "business",
            "user",
            "plan",
            "approved_by",
        ).filter(
            business_id=business_id,
            business__in=allowed_businesses,
        )


class PaymentCreateView(generics.CreateAPIView):
    serializer_class = PaymentCreateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasBusinessAccess,
        IsBusinessOwner,
    ]


class PaymentDetailView(generics.RetrieveAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasBusinessAccess,
        IsBusinessOwner,
    ]

    def get_queryset(self):
        user = self.request.user

        allowed_businesses = get_user_business_queryset(user)

        return Payment.objects.select_related(
            "business",
            "user",
            "plan",
            "approved_by",
        ).filter(
            business__in=allowed_businesses,
        )


class AdminPaymentListView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        return Payment.objects.select_related(
            "business",
            "user",
            "plan",
            "approved_by",
        ).all()


class AdminPaymentDetailView(generics.RetrieveAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        return Payment.objects.select_related(
            "business",
            "user",
            "plan",
            "approved_by",
        ).all()


class PaymentApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                payment = Payment.objects.select_for_update().select_related(
                    "business",
                    "user",
                    "plan",
                    "approved_by",
                ).get(pk=pk)
            except Payment.DoesNotExist:
                return Response(
                    {"detail": "Payment not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            serializer = PaymentApproveSerializer(
                data=request.data,
                context={
                    "request": request,
                    "payment": payment,
                },
            )

            serializer.is_valid(raise_exception=True)
            payment = serializer.save()

        return Response(
            {
                "message": "Payment approved and subscription activated successfully.",
                "payment": PaymentSerializer(payment, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class PaymentRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                payment = Payment.objects.select_for_update().select_related(
                    "business",
                    "user",
                    "plan",
                    "approved_by",
                ).get(pk=pk)
            except Payment.DoesNotExist:
                return Response(
                    {"detail": "Payment not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            serializer = PaymentRejectSerializer(
                data=request.data,
                context={
                    "request": request,
                    "payment": payment,
                },
            )

            serializer.is_valid(raise_exception=True)
            payment = serializer.save()

        return Response(
            {
                "message": "Payment rejected successfully.",
                "payment": PaymentSerializer(payment, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )
