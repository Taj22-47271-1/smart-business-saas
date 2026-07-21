from django.urls import path

from apps.sales.views import (
    DiscountVoucherDetailView,
    DiscountVoucherListCreateView,
    SaleCancelView,
    SaleCreateView,
    SaleDetailView,
    SaleListView,
    SalePaymentListCreateView,
)


urlpatterns = [
    path("business/<int:business_id>/vouchers/", DiscountVoucherListCreateView.as_view(), name="discount-voucher-list-create"),
    path("vouchers/<int:pk>/", DiscountVoucherDetailView.as_view(), name="discount-voucher-detail"),
    path(
        "business/<int:business_id>/",
        SaleListView.as_view(),
        name="sale-list",
    ),
    path(
        "create/",
        SaleCreateView.as_view(),
        name="sale-create",
    ),
    path(
        "<int:pk>/",
        SaleDetailView.as_view(),
        name="sale-detail",
    ),
    path(
        "business/<int:business_id>/<int:sale_id>/payments/",
        SalePaymentListCreateView.as_view(),
        name="sale-payment-list-create",
    ),
    path(
        "<int:pk>/cancel/",
        SaleCancelView.as_view(),
        name="sale-cancel",
    ),
]
