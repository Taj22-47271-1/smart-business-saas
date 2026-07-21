from django.urls import path

from apps.customers.views import (
    CustomerCreateView,
    CustomerDetailView,
    CustomerListView,
    CustomerPaymentCreateView,
    CustomerPaymentDetailView,
    CustomerPaymentListView,
)


urlpatterns = [
    path(
        "business/<int:business_id>/",
        CustomerListView.as_view(),
        name="customer-list",
    ),
    path(
        "create/",
        CustomerCreateView.as_view(),
        name="customer-create",
    ),
    path(
        "<int:pk>/",
        CustomerDetailView.as_view(),
        name="customer-detail",
    ),
    path(
        "<int:pk>/update/",
        CustomerDetailView.as_view(),
        name="customer-update",
    ),
    path(
        "<int:pk>/delete/",
        CustomerDetailView.as_view(),
        name="customer-delete",
    ),

    path(
        "business/<int:business_id>/payments/",
        CustomerPaymentListView.as_view(),
        name="customer-payment-list",
    ),
    path(
        "payments/create/",
        CustomerPaymentCreateView.as_view(),
        name="customer-payment-create",
    ),
    path(
        "payments/<int:pk>/",
        CustomerPaymentDetailView.as_view(),
        name="customer-payment-detail",
    ),
]