from django.urls import path

from apps.expenses.views import (
    ExpenseCategoryCreateView,
    ExpenseCategoryDetailView,
    ExpenseCategoryListView,
    ExpenseCreateView,
    ExpenseDetailView,
    ExpenseListView,
)


urlpatterns = [
    path(
        "business/<int:business_id>/categories/",
        ExpenseCategoryListView.as_view(),
        name="expense-category-list",
    ),
    path(
        "categories/create/",
        ExpenseCategoryCreateView.as_view(),
        name="expense-category-create",
    ),
    path(
        "categories/<int:pk>/",
        ExpenseCategoryDetailView.as_view(),
        name="expense-category-detail",
    ),
    path(
        "categories/<int:pk>/update/",
        ExpenseCategoryDetailView.as_view(),
        name="expense-category-update",
    ),
    path(
        "categories/<int:pk>/delete/",
        ExpenseCategoryDetailView.as_view(),
        name="expense-category-delete",
    ),

    path(
        "business/<int:business_id>/",
        ExpenseListView.as_view(),
        name="expense-list",
    ),
    path(
        "create/",
        ExpenseCreateView.as_view(),
        name="expense-create",
    ),
    path(
        "<int:pk>/",
        ExpenseDetailView.as_view(),
        name="expense-detail",
    ),
    path(
        "<int:pk>/update/",
        ExpenseDetailView.as_view(),
        name="expense-update",
    ),
    path(
        "<int:pk>/delete/",
        ExpenseDetailView.as_view(),
        name="expense-delete",
    ),
]