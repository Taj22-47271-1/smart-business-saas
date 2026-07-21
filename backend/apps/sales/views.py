from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import (
    CanManageSales,
    HasActiveBusinessSubscription,
    HasBusinessAccess,
    get_user_business_queryset,
)
from apps.sales.models import DiscountVoucher, Sale, SalePayment, SaleStatus
from apps.sales.serializers import (
    DiscountVoucherSerializer,
    SaleCancelSerializer,
    SaleCreateSerializer,
    SalePaymentCreateSerializer,
    SalePaymentSerializer,
    SaleSerializer,
)


class DiscountVoucherListCreateView(generics.ListCreateAPIView):
    serializer_class = DiscountVoucherSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageSales,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        queryset = DiscountVoucher.objects.filter(
            business_id=self.kwargs["business_id"],
            business__in=get_user_business_queryset(self.request.user),
        )
        if self.request.method == "GET" and not self.request.user.business_memberships.filter(
            business_id=self.kwargs["business_id"], role="OWNER", status="ACTIVE"
        ).exists():
            queryset = queryset.filter(is_active=True)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        return context

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["business_id"] = self.kwargs["business_id"]
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DiscountVoucherDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DiscountVoucherSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageSales,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        return DiscountVoucher.objects.filter(
            business__in=get_user_business_queryset(self.request.user)
        )


class SaleListView(generics.ListAPIView):
    serializer_class = SaleSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageSales,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    search_fields = ["invoice_number", "customer__name", "customer__phone"]
    ordering_fields = ["created_at", "total_amount", "paid_amount", "due_amount"]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        return Sale.objects.select_related(
            "business",
            "customer",
            "sold_by",
            "cancelled_by",
        ).prefetch_related("items__product", "payments__received_by").filter(
            business_id=business_id,
            business__in=allowed_businesses,
        )


class SaleCreateView(generics.CreateAPIView):
    serializer_class = SaleCreateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageSales,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]


class SaleDetailView(generics.RetrieveAPIView):
    serializer_class = SaleSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageSales,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        allowed_businesses = get_user_business_queryset(self.request.user)

        return Sale.objects.select_related(
            "business",
            "customer",
            "sold_by",
            "cancelled_by",
        ).prefetch_related("items__product", "payments__received_by").filter(
            business__in=allowed_businesses,
        )


class SalePaymentListCreateView(generics.ListCreateAPIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageSales,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        business_id = self.kwargs["business_id"]
        sale_id = self.kwargs["sale_id"]
        allowed_businesses = get_user_business_queryset(self.request.user)
        return SalePayment.objects.select_related("sale", "received_by").filter(
            sale_id=sale_id,
            sale__business_id=business_id,
            sale__business__in=allowed_businesses,
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return SalePaymentCreateSerializer
        return SalePaymentSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "business_id": self.kwargs["business_id"],
                "sale_id": self.kwargs["sale_id"],
            }
        )
        return context


class SaleCancelView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageSales,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def post(self, request, pk):
        serializer = SaleCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        allowed_businesses = get_user_business_queryset(request.user)

        try:
            sale = Sale.objects.select_related(
                "business",
                "customer",
                "sold_by",
                "cancelled_by",
            ).prefetch_related("items__product").get(
                id=pk,
                business__in=allowed_businesses,
            )
        except Sale.DoesNotExist:
            return Response(
                {"detail": "Sale not found or permission denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        self.check_object_permissions(request, sale)

        if sale.status == SaleStatus.CANCELLED:
            return Response(
                {"detail": "This sale has already been cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = serializer.validated_data.get("reason")

        if not reason:
            reason = "Sale cancelled by user."

        try:
            with transaction.atomic():
                sale.cancel_sale(user=request.user, reason=reason)
        except ValueError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sale.refresh_from_db()

        return Response(
            {
                "detail": "Sale cancelled successfully.",
                "sale": SaleSerializer(sale).data,
            },
            status=status.HTTP_200_OK,
        )
