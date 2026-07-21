from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import (
    CanManageStock,
    HasActiveBusinessSubscription,
    HasBusinessAccess,
    get_user_business_queryset,
)
from apps.inventory.models import StockTransaction, StockTransactionType
from apps.inventory.serializers import (
    StockTransactionCreateSerializer,
    StockTransactionSerializer,
)


class StockTransactionListView(generics.ListAPIView):
    serializer_class = StockTransactionSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageStock,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    search_fields = ["product__name", "transaction_type", "note"]
    ordering_fields = ["created_at", "quantity", "total_cost"]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        return StockTransaction.objects.select_related(
            "business",
            "product",
            "created_by",
            "reversed_transaction",
        ).filter(
            business_id=business_id,
            business__in=allowed_businesses,
        )


class StockTransactionCreateView(generics.CreateAPIView):
    serializer_class = StockTransactionCreateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageStock,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]


class StockTransactionDetailView(generics.RetrieveAPIView):
    serializer_class = StockTransactionSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageStock,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        allowed_businesses = get_user_business_queryset(self.request.user)

        return StockTransaction.objects.select_related(
            "business",
            "product",
            "created_by",
            "reversed_transaction",
        ).filter(
            business__in=allowed_businesses,
        )


class StockTransactionReverseView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageStock,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def post(self, request, pk):
        allowed_businesses = get_user_business_queryset(request.user)

        try:
            stock_transaction = StockTransaction.objects.select_related(
                "business",
                "product",
                "created_by",
            ).get(
                id=pk,
                business__in=allowed_businesses,
            )
        except StockTransaction.DoesNotExist:
            return Response(
                {"detail": "Stock transaction not found or permission denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        self.check_object_permissions(request, stock_transaction)

        if stock_transaction.is_reversal:
            return Response(
                {"detail": "A reversal transaction cannot be reversed again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if stock_transaction.is_reversed:
            return Response(
                {"detail": "This stock transaction has already been reversed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reverse_type = self.get_reverse_transaction_type(stock_transaction)
        reverse_quantity = stock_transaction.quantity

        if stock_transaction.transaction_type == StockTransactionType.ADJUSTMENT:
            reverse_quantity = stock_transaction.previous_quantity

        if reverse_type in [
            StockTransactionType.STOCK_OUT,
            StockTransactionType.DAMAGED,
        ]:
            if stock_transaction.product.stock_quantity < reverse_quantity:
                return Response(
                    {
                        "quantity": (
                            "Not enough current stock to reverse this transaction. "
                            f"Current stock is {stock_transaction.product.stock_quantity}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        note = request.data.get("note")

        if not note:
            note = f"Reversal of stock transaction #{stock_transaction.id}"

        with transaction.atomic():
            reversal_transaction = StockTransaction.objects.create(
                business=stock_transaction.business,
                product=stock_transaction.product,
                transaction_type=reverse_type,
                quantity=reverse_quantity,
                unit_cost=stock_transaction.unit_cost,
                note=note,
                created_by=request.user,
                is_reversal=True,
                reversed_transaction=stock_transaction,
            )

            stock_transaction.is_reversed = True
            stock_transaction.save(update_fields=["is_reversed", "updated_at"])

        serializer = StockTransactionSerializer(reversal_transaction)

        return Response(
            {
                "detail": "Stock transaction reversed successfully.",
                "original_transaction_id": stock_transaction.id,
                "reversal_transaction": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def get_reverse_transaction_type(self, stock_transaction):
        if stock_transaction.transaction_type == StockTransactionType.STOCK_IN:
            return StockTransactionType.STOCK_OUT

        if stock_transaction.transaction_type == StockTransactionType.RETURNED:
            return StockTransactionType.STOCK_OUT

        if stock_transaction.transaction_type == StockTransactionType.STOCK_OUT:
            return StockTransactionType.STOCK_IN

        if stock_transaction.transaction_type == StockTransactionType.DAMAGED:
            return StockTransactionType.STOCK_IN

        if stock_transaction.transaction_type == StockTransactionType.ADJUSTMENT:
            return StockTransactionType.ADJUSTMENT

        return StockTransactionType.ADJUSTMENT