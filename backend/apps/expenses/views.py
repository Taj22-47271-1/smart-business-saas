from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.core.permissions import (
    CanManageExpenses,
    HasActiveBusinessSubscription,
    HasBusinessAccess,
    get_user_business_queryset,
    is_business_employee,
)
from apps.expenses.models import Expense, ExpenseCategory
from apps.businesses.models import BusinessMemberRole, BusinessMemberStatus
from apps.expenses.serializers import (
    ExpenseCategoryCreateUpdateSerializer,
    ExpenseCategorySerializer,
    ExpenseCreateUpdateSerializer,
    ExpenseSerializer,
)


class ExpenseCategoryListView(generics.ListAPIView):
    serializer_class = ExpenseCategorySerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageExpenses,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        return ExpenseCategory.objects.filter(
            business_id=business_id,
            business__in=allowed_businesses,
        ).select_related("business")


class ExpenseCategoryCreateView(generics.CreateAPIView):
    serializer_class = ExpenseCategoryCreateUpdateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageExpenses,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]


class ExpenseCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageExpenses,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        allowed_businesses = get_user_business_queryset(self.request.user)

        return ExpenseCategory.objects.filter(
            business__in=allowed_businesses,
        ).select_related("business")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return ExpenseCategoryCreateUpdateSerializer

        return ExpenseCategorySerializer


class ExpenseListView(generics.ListAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageExpenses,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    search_fields = ["title", "payment_method", "note"]
    ordering_fields = ["expense_date", "amount", "created_at"]

    def get_queryset(self):
        business_id = self.kwargs.get("business_id")
        allowed_businesses = get_user_business_queryset(self.request.user)

        queryset = Expense.objects.filter(
            business_id=business_id,
            business__in=allowed_businesses,
        ).select_related("business", "category", "created_by")
        if is_business_employee(self.request.user, business_id):
            queryset = queryset.filter(created_by=self.request.user)
        return queryset


class ExpenseCreateView(generics.CreateAPIView):
    serializer_class = ExpenseCreateUpdateSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageExpenses,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanManageExpenses,
        HasBusinessAccess,
        HasActiveBusinessSubscription,
    ]

    def get_queryset(self):
        allowed_businesses = get_user_business_queryset(self.request.user)

        queryset = Expense.objects.filter(
            business__in=allowed_businesses,
        ).select_related("business", "category", "created_by")
        finance_business_ids = self.request.user.business_memberships.filter(
            role__in=[
                BusinessMemberRole.OWNER,
                BusinessMemberRole.MANAGER,
                BusinessMemberRole.ACCOUNTANT,
            ],
            status=BusinessMemberStatus.ACTIVE,
        ).values_list("business_id", flat=True)
        queryset = queryset.filter(
            Q(business_id__in=finance_business_ids) | Q(created_by=self.request.user)
        )
        return queryset

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return ExpenseCreateUpdateSerializer

        return ExpenseSerializer

    def destroy(self, request, *args, **kwargs):
        expense = self.get_object()

        self.check_object_permissions(request, expense)

        expense.is_active = False
        expense.save(update_fields=["is_active", "updated_at"])

        return Response(
            {
                "detail": "Expense deactivated successfully.",
                "id": expense.id,
                "is_active": expense.is_active,
            },
            status=status.HTTP_200_OK,
        )
