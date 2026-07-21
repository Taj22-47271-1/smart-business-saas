from rest_framework import serializers


class BusinessSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class RecentSaleSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    invoice_number = serializers.CharField()
    customer_name = serializers.CharField()
    total_amount = serializers.CharField()
    paid_amount = serializers.CharField()
    due_amount = serializers.CharField()
    payment_status = serializers.CharField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()


class RecentExpenseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    category_name = serializers.CharField()
    amount = serializers.CharField()
    expense_date = serializers.DateField()
    payment_method = serializers.CharField()
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class LowStockProductSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    sku = serializers.CharField(allow_null=True, required=False)
    category_name = serializers.CharField()
    stock_quantity = serializers.CharField()
    low_stock_limit = serializers.CharField()
    unit = serializers.CharField()
    purchase_price = serializers.CharField()
    selling_price = serializers.CharField()
    stock_value = serializers.CharField()


class DashboardSummarySerializer(serializers.Serializer):
    business = BusinessSummarySerializer()

    total_products = serializers.IntegerField()
    total_customers = serializers.IntegerField()
    low_stock_products_count = serializers.IntegerField()
    total_stock_value = serializers.DecimalField(max_digits=12, decimal_places=2)

    today_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    today_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    today_profit = serializers.DecimalField(max_digits=12, decimal_places=2)

    monthly_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    monthly_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    monthly_profit = serializers.DecimalField(max_digits=12, decimal_places=2)

    total_sales_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_due_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expenses_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_profit = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_customer_due = serializers.DecimalField(max_digits=12, decimal_places=2)

    total_sales_count = serializers.IntegerField()
    cancelled_sales_count = serializers.IntegerField()
    total_expenses_count = serializers.IntegerField()
    inactive_expenses_count = serializers.IntegerField()

    recent_sales = RecentSaleSerializer(many=True)
    recent_expenses = RecentExpenseSerializer(many=True)
    low_stock_products = LowStockProductSerializer(many=True)