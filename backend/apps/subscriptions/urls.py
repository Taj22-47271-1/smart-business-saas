from django.urls import path

from apps.subscriptions.views import (
    AdminSubscriptionListView,
    AdminSoldSubscriptionDetailView,
    AdminSubscriptionPlanStatusView,
    AdminSubscriptionUpdateView,
    AdminSubscriptionPlanDetailView,
    AdminSubscriptionPlanListCreateView,
    BusinessSubscriptionDetailView,
    BusinessSubscriptionPaymentListView,
    BusinessSubscriptionRenewView,
    SubscriptionPlanListView,
)


urlpatterns = [
    path("plans/", SubscriptionPlanListView.as_view(), name="subscription-plans"),
    path("plans/admin/", AdminSubscriptionPlanListCreateView.as_view(), name="admin-subscription-plans"),
    path("plans/admin/<int:pk>/", AdminSubscriptionPlanDetailView.as_view(), name="admin-subscription-plan-detail"),
    path("admin/plans/", AdminSubscriptionPlanListCreateView.as_view(), name="admin-plan-list-create"),
    path("admin/plans/create/", AdminSubscriptionPlanListCreateView.as_view(), name="admin-plan-create"),
    path("admin/plans/<int:pk>/", AdminSubscriptionPlanDetailView.as_view(), name="admin-plan-detail"),
    path("admin/plans/<int:pk>/update/", AdminSubscriptionPlanDetailView.as_view(), name="admin-plan-update"),
    path("admin/plans/<int:pk>/activate/", AdminSubscriptionPlanStatusView.as_view(), {"active": True}, name="admin-plan-activate"),
    path("admin/plans/<int:pk>/deactivate/", AdminSubscriptionPlanStatusView.as_view(), {"active": False}, name="admin-plan-deactivate"),
    path("admin/sold/", AdminSubscriptionListView.as_view(), name="admin-sold-subscriptions"),
    path("admin/sold/<int:pk>/", AdminSoldSubscriptionDetailView.as_view(), name="admin-sold-subscription-detail"),
    path("admin/", AdminSubscriptionListView.as_view(), name="admin-subscriptions"),
    path("admin/<int:pk>/", AdminSubscriptionUpdateView.as_view(), name="admin-subscription-update"),
    path(
        "business/<int:business_id>/",
        BusinessSubscriptionDetailView.as_view(),
        name="business-subscription-detail",
    ),
    path("business/<int:business_id>/payments/", BusinessSubscriptionPaymentListView.as_view(), name="business-subscription-payments"),
    path("business/<int:business_id>/renew/", BusinessSubscriptionRenewView.as_view(), name="business-subscription-renew"),
]
