from django.urls import path

from apps.inventory.views import (
    StockTransactionCreateView,
    StockTransactionDetailView,
    StockTransactionListView,
    StockTransactionReverseView,
)


urlpatterns = [
    path(
        "business/<int:business_id>/",
        StockTransactionListView.as_view(),
        name="stock-transaction-list",
    ),
    path(
        "create/",
        StockTransactionCreateView.as_view(),
        name="stock-transaction-create",
    ),
    path(
        "<int:pk>/",
        StockTransactionDetailView.as_view(),
        name="stock-transaction-detail",
    ),
    path(
        "<int:pk>/reverse/",
        StockTransactionReverseView.as_view(),
        name="stock-transaction-reverse",
    ),
]