from django.contrib import admin

from apps.expenses.models import Expense, ExpenseCategory


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "name",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("business__name", "name")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business",
        "category",
        "title",
        "amount",
        "expense_date",
        "payment_method",
        "created_by",
    )
    list_filter = ("payment_method", "expense_date", "created_at")
    search_fields = ("business__name", "title")