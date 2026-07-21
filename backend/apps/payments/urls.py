from django.urls import path

from apps.payments.views import (
    AdminPaymentDetailView,
    AdminPaymentListView,
    BusinessPaymentListView,
    MyPaymentListView,
    PaymentApproveView,
    PaymentCreateView,
    PaymentDetailView,
    PaymentRejectView,
)


urlpatterns = [
    path("my-payments/", MyPaymentListView.as_view(), name="my-payments"),
    path("create/", PaymentCreateView.as_view(), name="payment-create"),
    path("<int:pk>/", PaymentDetailView.as_view(), name="payment-detail"),
    path(
        "business/<int:business_id>/",
        BusinessPaymentListView.as_view(),
        name="business-payments",
    ),

    path("admin/all/", AdminPaymentListView.as_view(), name="admin-payment-list"),
    path("admin/<int:pk>/", AdminPaymentDetailView.as_view(), name="admin-payment-detail"),
    path("admin/<int:pk>/approve/", PaymentApproveView.as_view(), name="payment-approve"),
    path("admin/<int:pk>/reject/", PaymentRejectView.as_view(), name="payment-reject"),
]