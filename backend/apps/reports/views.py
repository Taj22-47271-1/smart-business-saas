from decimal import Decimal

from django.db.models import F, Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.businesses.models import Business
from apps.core.permissions import CanViewReports, HasBusinessAccess, user_can_access_business
from apps.customers.models import Customer
from apps.expenses.models import Expense
from apps.products.models import Product
from apps.sales.models import Sale, SaleItem, SaleStatus


def safe_decimal(value):
    return value if value is not None else Decimal("0.00")


def decimal_to_string(value):
    return str(safe_decimal(value))


class DashboardSummaryView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
        CanViewReports,
        HasBusinessAccess,
    ]

    def get(self, request, business_id):
        try:
            business = Business.objects.get(id=business_id)
        except Business.DoesNotExist:
            return Response(
                {"detail": "Invalid business."},
                status=404,
            )

        if not user_can_access_business(request.user, business):
            return Response(
                {"detail": "You do not have permission to access this business report."},
                status=403,
            )

        today = timezone.localdate()
        month_start = today.replace(day=1)

        products = Product.objects.filter(
            business=business,
            is_active=True,
        )

        customers = Customer.objects.filter(
            business=business,
            is_active=True,
        )

        active_sales = Sale.objects.filter(
            business=business,
            status=SaleStatus.ACTIVE,
        )

        cancelled_sales = Sale.objects.filter(
            business=business,
            status=SaleStatus.CANCELLED,
        )

        active_expenses = Expense.objects.filter(
            business=business,
            is_active=True,
        )

        inactive_expenses = Expense.objects.filter(
            business=business,
            is_active=False,
        )

        low_stock_queryset = products.filter(
            stock_quantity__lte=F("low_stock_limit")
        )

        total_products = products.count()
        total_customers = customers.count()
        low_stock_products_count = low_stock_queryset.count()

        total_stock_value = Decimal("0.00")
        for product in products:
            total_stock_value += product.stock_value

        today_sales = safe_decimal(
            active_sales.filter(created_at__date=today).aggregate(
                total=Sum("total_amount")
            )["total"]
        )

        today_expenses = safe_decimal(
            active_expenses.filter(expense_date=today).aggregate(
                total=Sum("amount")
            )["total"]
        )

        today_profit_from_items = safe_decimal(
            SaleItem.objects.filter(
                sale__business=business,
                sale__status=SaleStatus.ACTIVE,
                sale__created_at__date=today,
            ).aggregate(total=Sum("profit"))["total"]
        )

        today_profit = today_profit_from_items - today_expenses

        monthly_sales = safe_decimal(
            active_sales.filter(created_at__date__gte=month_start).aggregate(
                total=Sum("total_amount")
            )["total"]
        )

        monthly_expenses = safe_decimal(
            active_expenses.filter(expense_date__gte=month_start).aggregate(
                total=Sum("amount")
            )["total"]
        )

        monthly_profit_from_items = safe_decimal(
            SaleItem.objects.filter(
                sale__business=business,
                sale__status=SaleStatus.ACTIVE,
                sale__created_at__date__gte=month_start,
            ).aggregate(total=Sum("profit"))["total"]
        )

        monthly_profit = monthly_profit_from_items - monthly_expenses

        total_customer_due = safe_decimal(
            customers.aggregate(total=Sum("current_due"))["total"]
        )

        total_paid_amount = safe_decimal(
            active_sales.aggregate(total=Sum("paid_amount"))["total"]
        )

        total_due_amount = safe_decimal(
            active_sales.aggregate(total=Sum("due_amount"))["total"]
        )

        total_sales_amount = safe_decimal(
            active_sales.aggregate(total=Sum("total_amount"))["total"]
        )

        total_expenses_amount = safe_decimal(
            active_expenses.aggregate(total=Sum("amount"))["total"]
        )

        total_profit_from_items = safe_decimal(
            SaleItem.objects.filter(
                sale__business=business,
                sale__status=SaleStatus.ACTIVE,
            ).aggregate(total=Sum("profit"))["total"]
        )

        total_profit = total_profit_from_items - total_expenses_amount

        recent_sales = [
            {
                "id": sale.id,
                "invoice_number": sale.invoice_number,
                "customer_name": sale.customer.name if sale.customer else "Walk-in Customer",
                "total_amount": decimal_to_string(sale.total_amount),
                "paid_amount": decimal_to_string(sale.paid_amount),
                "due_amount": decimal_to_string(sale.due_amount),
                "payment_status": sale.payment_status,
                "status": sale.status,
                "created_at": sale.created_at,
            }
            for sale in active_sales.select_related("customer").order_by("-created_at")[:10]
        ]

        recent_expenses = [
            {
                "id": expense.id,
                "title": expense.title,
                "category_name": expense.category.name if expense.category else "Uncategorized",
                "amount": decimal_to_string(expense.amount),
                "expense_date": expense.expense_date,
                "payment_method": expense.payment_method,
                "is_active": expense.is_active,
                "created_at": expense.created_at,
            }
            for expense in active_expenses.select_related("category").order_by(
                "-expense_date",
                "-created_at",
            )[:10]
        ]

        low_stock_products = [
            {
                "id": product.id,
                "name": product.name,
                "sku": product.sku,
                "category_name": product.category.name if product.category else "Uncategorized",
                "stock_quantity": decimal_to_string(product.stock_quantity),
                "low_stock_limit": decimal_to_string(product.low_stock_limit),
                "unit": product.unit,
                "purchase_price": decimal_to_string(product.purchase_price),
                "selling_price": decimal_to_string(product.selling_price),
                "stock_value": decimal_to_string(product.stock_value),
            }
            for product in low_stock_queryset.select_related("category").order_by(
                "stock_quantity",
                "name",
            )[:20]
        ]

        data = {
            "business": {
                "id": business.id,
                "name": business.name,
            },

            "total_products": total_products,
            "total_customers": total_customers,
            "low_stock_products_count": low_stock_products_count,
            "total_stock_value": total_stock_value,

            "today_sales": today_sales,
            "today_expenses": today_expenses,
            "today_profit": today_profit,

            "monthly_sales": monthly_sales,
            "monthly_expenses": monthly_expenses,
            "monthly_profit": monthly_profit,

            "total_sales_amount": total_sales_amount,
            "total_paid_amount": total_paid_amount,
            "total_due_amount": total_due_amount,
            "total_expenses_amount": total_expenses_amount,
            "total_profit": total_profit,
            "total_customer_due": total_customer_due,

            "total_sales_count": active_sales.count(),
            "cancelled_sales_count": cancelled_sales.count(),
            "total_expenses_count": active_expenses.count(),
            "inactive_expenses_count": inactive_expenses.count(),

            "recent_sales": recent_sales,
            "recent_expenses": recent_expenses,
            "low_stock_products": low_stock_products,
        }

        return Response(data)