from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from apps.businesses.models import Business
from apps.core.permissions import (
    HasBusinessAccess,
    IsBusinessOwner,
    IsSuperAdmin,
    is_business_employee,
)
from apps.payments.models import Payment
from apps.payments.serializers import PaymentCreateSerializer, PaymentSerializer
from apps.subscriptions.models import Subscription, SubscriptionPlan
from apps.subscriptions.serializers import (
    AdminSubscriptionPlanUpdateSerializer,
    SubscriptionPlanSerializer,
    SubscriptionSerializer,
)


class SubscriptionPlanListView(generics.ListAPIView):
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return SubscriptionPlan.objects.filter(is_active=True)


class BusinessSubscriptionDetailView(generics.RetrieveAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated, HasBusinessAccess]

    def get_object(self):
        business_id = self.kwargs.get("business_id")

        try:
            business = Business.objects.get(id=business_id)
        except Business.DoesNotExist:
            raise PermissionDenied("You do not have permission to access this business.")

        return business.subscription

    def retrieve(self, request, *args, **kwargs):
        subscription = self.get_object()
        if is_business_employee(request.user, subscription.business):
            # Employees only receive the access flag required by operational pages.
            return Response({"has_access": subscription.has_access})
        return Response(self.get_serializer(subscription).data)


class AdminSubscriptionPlanListCreateView(generics.ListCreateAPIView):
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = SubscriptionPlan.objects.all()


class AdminSubscriptionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = SubscriptionPlan.objects.all()


class AdminSubscriptionListView(generics.ListAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        return Subscription.objects.select_related(
            "business",
            "business__owner",
            "plan",
        ).prefetch_related("business__payments").all()


class AdminSoldSubscriptionDetailView(generics.RetrieveAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        return Subscription.objects.select_related(
            "business", "business__owner", "plan"
        ).prefetch_related("business__payments").all()


class AdminSubscriptionUpdateView(generics.UpdateAPIView):
    serializer_class = AdminSubscriptionPlanUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    http_method_names = ["patch", "options"]

    def get_queryset(self):
        return Subscription.objects.select_related("business", "plan").all()

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        subscription = self.get_object()
        return Response(SubscriptionSerializer(subscription, context={"request": request}).data)


class AdminSubscriptionPlanStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk, active):
        try:
            plan = SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({"detail": "Subscription plan not found."}, status=status.HTTP_404_NOT_FOUND)
        plan.is_active = active
        plan.save(update_fields=["is_active", "updated_at"])
        return Response(SubscriptionPlanSerializer(plan).data)


class BusinessSubscriptionPaymentListView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, HasBusinessAccess, IsBusinessOwner]

    def get_queryset(self):
        return Payment.objects.select_related(
            "business", "business__owner", "user", "plan", "approved_by"
        ).filter(business_id=self.kwargs["business_id"])


class BusinessSubscriptionRenewView(APIView):
    """Owner-only renewal checkout alias; activation still requires admin approval."""

    permission_classes = [permissions.IsAuthenticated, HasBusinessAccess, IsBusinessOwner]

    def post(self, request, business_id):
        data = request.data.copy()
        data["business_id"] = business_id
        serializer = PaymentCreateSerializer(
            data=data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        return Response(
            PaymentSerializer(payment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
