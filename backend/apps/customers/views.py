from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.core.permissions import (
    CanManageCustomers,
    HasActiveBusinessSubscription,
    HasBusinessAccess,
    get_user_business_queryset,
)
from apps.customers.models import Customer, CustomerPayment
from apps.customers.serializers import (
    CustomerCreateUpdateSerializer,
    CustomerPaymentCreateSerializer,
    CustomerPaymentSerializer,
    CustomerSerializer,
)


class CustomerListView(generics.ListAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageCustomers,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    search_fields = ["name", "phone", "email"]
    ordering_fields = ["name", "current_due", "created_at"]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        return Customer.objects.filter(
            business_id=business_id,
            business__in=allowed_businesses,
        ).select_related("business")


class CustomerCreateView(generics.CreateAPIView):
    serializer_class = CustomerCreateUpdateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageCustomers,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]


class CustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageCustomers,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        allowed_businesses = get_user_business_queryset(self.request.user)

        return Customer.objects.filter(
            business__in=allowed_businesses,
        ).select_related("business")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CustomerCreateUpdateSerializer

        return CustomerSerializer

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()

        self.check_object_permissions(request, customer)

        customer.is_active = False
        customer.save(update_fields=["is_active", "updated_at"])

        return Response(
            {
                "detail": "Customer deactivated successfully.",
                "id": customer.id,
                "is_active": customer.is_active,
            },
            status=status.HTTP_200_OK,
        )


class CustomerPaymentListView(generics.ListAPIView):
    serializer_class = CustomerPaymentSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageCustomers,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        return CustomerPayment.objects.filter(
            business_id=business_id,
            business__in=allowed_businesses,
        ).select_related("business", "customer")


class CustomerPaymentCreateView(generics.CreateAPIView):
    serializer_class = CustomerPaymentCreateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageCustomers,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]


class CustomerPaymentDetailView(generics.RetrieveAPIView):
    serializer_class = CustomerPaymentSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageCustomers,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        allowed_businesses = get_user_business_queryset(self.request.user)

        return CustomerPayment.objects.filter(
            business__in=allowed_businesses,
        ).select_related("business", "customer")