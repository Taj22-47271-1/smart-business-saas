from django.urls import path

from apps.businesses.views import (
    BusinessCreateView, BusinessDetailView, BusinessMemberDetailView,
    BusinessMemberListCreateView, MyBusinessListView,
)


urlpatterns = [
    path("my-businesses/", MyBusinessListView.as_view(), name="my-businesses"),
    path("create/", BusinessCreateView.as_view(), name="business-create"),
    path("<int:business_id>/members/", BusinessMemberListCreateView.as_view(), name="business-members"),
    path("<int:business_id>/members/<int:pk>/", BusinessMemberDetailView.as_view(), name="business-member-detail"),
    path("<int:pk>/", BusinessDetailView.as_view(), name="business-detail"),
]
