from django.urls import path

from apps.reports.views import DashboardSummaryView


urlpatterns = [
    path(
        "business/<int:business_id>/dashboard/",
        DashboardSummaryView.as_view(),
        name="dashboard-summary",
    ),
]