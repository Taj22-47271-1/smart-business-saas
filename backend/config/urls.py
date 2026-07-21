from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


urlpatterns = [
    path("admin/", admin.site.urls),

    # API schema and documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    # App API routes
    path("api/accounts/", include("apps.accounts.urls")),
    path("api/businesses/", include("apps.businesses.urls")),
    path("api/subscriptions/", include("apps.subscriptions.urls")),
    path("api/payments/", include("apps.payments.urls")),
    path("api/products/", include("apps.products.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/customers/", include("apps.customers.urls")),
    path("api/sales/", include("apps.sales.urls")),
    path("api/expenses/", include("apps.expenses.urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/chat/", include("apps.chat.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
