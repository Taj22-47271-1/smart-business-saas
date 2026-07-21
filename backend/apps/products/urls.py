from django.urls import path

from apps.products.views import (
    ProductCategoryCreateView,
    ProductCategoryDetailView,
    ProductCategoryListView,
    ProductCreateView,
    ProductDetailView,
    ProductListView,
)


urlpatterns = [
    path(
        "business/<int:business_id>/categories/",
        ProductCategoryListView.as_view(),
        name="product-category-list",
    ),
    path(
        "categories/create/",
        ProductCategoryCreateView.as_view(),
        name="product-category-create",
    ),
    path(
        "categories/<int:pk>/",
        ProductCategoryDetailView.as_view(),
        name="product-category-detail",
    ),
    path(
        "categories/<int:pk>/update/",
        ProductCategoryDetailView.as_view(),
        name="product-category-update",
    ),
    path(
        "categories/<int:pk>/delete/",
        ProductCategoryDetailView.as_view(),
        name="product-category-delete",
    ),

    path(
        "business/<int:business_id>/",
        ProductListView.as_view(),
        name="product-list",
    ),
    path(
        "create/",
        ProductCreateView.as_view(),
        name="product-create",
    ),
    path(
        "<int:pk>/",
        ProductDetailView.as_view(),
        name="product-detail",
    ),
    path(
        "<int:pk>/update/",
        ProductDetailView.as_view(),
        name="product-update",
    ),
    path(
        "<int:pk>/delete/",
        ProductDetailView.as_view(),
        name="product-delete",
    ),
]