from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.businesses.models import Business
from apps.core.permissions import is_business_employee, user_can_access_business
from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import (
    DiscountType,
    DiscountVoucher,
    Sale,
    SaleItem,
    SalePayment,
    SalePaymentStatus,
    SaleStatus,
)


class DiscountVoucherSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(write_only=True, required=False)
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = DiscountVoucher
        fields = [
            "id", "business_id", "business_name", "code", "description",
            "discount_type", "value", "minimum_purchase", "maximum_discount",
            "valid_from", "valid_until", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "business_name", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context["request"]
        business_id = attrs.pop("business_id", None)
        business = self.instance.business if self.instance else None
        if not business:
            try:
                business = Business.objects.get(pk=business_id)
            except Business.DoesNotExist:
                raise serializers.ValidationError({"business_id": "Invalid business."})
        if not user_can_access_business(request.user, business):
            raise serializers.ValidationError({"business_id": "Permission denied."})
        value = attrs.get("value", self.instance.value if self.instance else 0)
        discount_type = attrs.get(
            "discount_type", self.instance.discount_type if self.instance else DiscountType.FIXED
        )
        if value <= 0:
            raise serializers.ValidationError({"value": "Discount value must be greater than zero."})
        if discount_type == DiscountType.PERCENT and value > 100:
            raise serializers.ValidationError({"value": "Percentage cannot exceed 100."})
        valid_from = attrs.get("valid_from", getattr(self.instance, "valid_from", None))
        valid_until = attrs.get("valid_until", getattr(self.instance, "valid_until", None))
        if valid_from and valid_until and valid_until <= valid_from:
            raise serializers.ValidationError({"valid_until": "End time must be after start time."})
        code = attrs.get("code", self.instance.code if self.instance else "").strip().upper()
        duplicate = DiscountVoucher.objects.filter(business=business, code__iexact=code)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError({"code": "This voucher code already exists."})
        attrs["code"] = code
        attrs["business"] = business
        return attrs


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_size = serializers.CharField(source="product.size", read_only=True)
    product_color = serializers.CharField(source="product.color", read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and is_business_employee(request.user, instance.sale.business):
            data.pop("purchase_price", None)
            data.pop("profit", None)
        return data

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "product",
            "product_name",
            "product_size",
            "product_color",
            "quantity",
            "purchase_price",
            "selling_price",
            "line_total",
            "profit",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "product_name",
            "product_size",
            "product_color",
            "purchase_price",
            "line_total",
            "profit",
            "created_at",
        ]


class SalePaymentSerializer(serializers.ModelSerializer):
    received_by_email = serializers.EmailField(source="received_by.email", read_only=True)

    class Meta:
        model = SalePayment
        fields = [
            "id",
            "sale",
            "amount",
            "payment_method",
            "note",
            "received_by",
            "received_by_email",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "sale",
            "received_by",
            "received_by_email",
            "created_at",
        ]


class SaleSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    sold_by_email = serializers.EmailField(source="sold_by.email", read_only=True)
    cancelled_by_email = serializers.EmailField(
        source="cancelled_by.email",
        read_only=True,
    )
    items = SaleItemSerializer(many=True, read_only=True)
    payment_history = SalePaymentSerializer(source="payments", many=True, read_only=True)
    voucher_code = serializers.CharField(source="voucher.code", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "business",
            "business_name",
            "customer",
            "customer_name",
            "customer_phone",
            "voucher_code",
            "invoice_number",
            "subtotal",
            "discount",
            "tax",
            "total_amount",
            "paid_amount",
            "due_amount",
            "payment_method",
            "payment_status",
            "status",
            "note",
            "sold_by",
            "sold_by_email",
            "cancel_reason",
            "cancelled_by",
            "cancelled_by_email",
            "cancelled_at",
            "items",
            "payment_history",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "business_name",
            "customer_name",
            "customer_phone",
            "invoice_number",
            "subtotal",
            "total_amount",
            "due_amount",
            "payment_status",
            "status",
            "sold_by",
            "sold_by_email",
            "cancel_reason",
            "cancelled_by",
            "cancelled_by_email",
            "cancelled_at",
            "items",
            "payment_history",
            "created_at",
            "updated_at",
        ]


class SaleItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    selling_price = serializers.DecimalField(max_digits=12, decimal_places=2)

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0.")

        return value

    def validate_selling_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Selling price cannot be negative.")

        return value


class SaleCreateSerializer(serializers.Serializer):
    business_id = serializers.IntegerField()
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = serializers.CharField(max_length=50, default="Cash")
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    voucher_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    items = SaleItemCreateSerializer(many=True)

    def to_representation(self, instance):
        return SaleSerializer(instance, context=self.context).data

    def validate(self, attrs):
        request = self.context.get("request")
        business_id = attrs.get("business_id")
        customer_id = attrs.get("customer_id")
        items = attrs.get("items")
        discount = attrs.get("discount", 0)
        tax = attrs.get("tax", 0)
        paid_amount = attrs.get("paid_amount", 0)
        voucher_code = (attrs.get("voucher_code") or "").strip()

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if not items:
            raise serializers.ValidationError({"items": "At least one item is required."})

        if discount < 0:
            raise serializers.ValidationError(
                {"discount": "Discount cannot be negative."}
            )

        if tax < 0:
            raise serializers.ValidationError({"tax": "Tax cannot be negative."})

        if paid_amount < 0:
            raise serializers.ValidationError(
                {"paid_amount": "Paid amount cannot be negative."}
            )

        try:
            business = Business.objects.get(id=business_id)
        except Business.DoesNotExist:
            raise serializers.ValidationError(
                {"business_id": "Invalid business."}
            )

        if not user_can_access_business(request.user, business):
            raise serializers.ValidationError(
                {"business_id": "Permission denied for this business."}
            )

        employee = is_business_employee(request.user, business)
        if employee and discount:
            raise serializers.ValidationError(
                {"discount": "Employees cannot apply a manual discount."}
            )

        if not business.is_available:
            raise serializers.ValidationError(
                {"business_id": "This business is not active."}
            )

        customer = None

        if customer_id:
            try:
                customer = Customer.objects.get(
                    id=customer_id,
                    business=business,
                    is_active=True,
                )
            except Customer.DoesNotExist:
                raise serializers.ValidationError(
                    {"customer_id": "Invalid or inactive customer for this business."}
                )

        product_ids = [item["product_id"] for item in items]

        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError(
                {"items": "Duplicate products are not allowed in the same invoice."}
            )

        products = Product.objects.filter(
            id__in=product_ids,
            business=business,
            is_active=True,
        )
        product_map = {product.id: product for product in products}

        subtotal = 0

        for item in items:
            product_id = item["product_id"]
            quantity = item["quantity"]
            selling_price = item["selling_price"]

            product = product_map.get(product_id)

            if not product:
                raise serializers.ValidationError(
                    {"items": f"Invalid or inactive product id: {product_id}"}
                )

            if employee and selling_price != product.selling_price:
                raise serializers.ValidationError(
                    {"items": f"Employees must use the listed selling price for {product.name}."}
                )

            if product.stock_quantity < quantity:
                raise serializers.ValidationError(
                    {
                        "items": (
                            f"Not enough stock for {product.name}. "
                            f"Current stock is {product.stock_quantity}."
                        )
                    }
                )

            subtotal += quantity * selling_price
            item["product"] = product

        total_amount = subtotal - discount + tax

        voucher = None
        if voucher_code:
            if discount:
                raise serializers.ValidationError(
                    {"discount": "Manual discount and voucher cannot be used together."}
                )
            now = timezone.now()
            try:
                voucher = DiscountVoucher.objects.get(
                    business=business,
                    code__iexact=voucher_code,
                    is_active=True,
                )
            except DiscountVoucher.DoesNotExist:
                raise serializers.ValidationError({"voucher_code": "Invalid voucher code."})
            if voucher.valid_from and voucher.valid_from > now:
                raise serializers.ValidationError({"voucher_code": "This voucher is not active yet."})
            if voucher.valid_until and voucher.valid_until < now:
                raise serializers.ValidationError({"voucher_code": "This voucher has expired."})
            if subtotal < voucher.minimum_purchase:
                raise serializers.ValidationError(
                    {"voucher_code": f"Minimum purchase is {voucher.minimum_purchase}."}
                )
            if voucher.discount_type == DiscountType.PERCENT:
                discount = subtotal * voucher.value / 100
                if voucher.maximum_discount is not None:
                    discount = min(discount, voucher.maximum_discount)
            else:
                discount = voucher.value
            discount = min(discount, subtotal + tax)
            attrs["discount"] = discount
            total_amount = subtotal - discount + tax

        if total_amount < 0:
            raise serializers.ValidationError(
                {"discount": "Discount cannot be greater than subtotal plus tax."}
            )

        if paid_amount > total_amount:
            raise serializers.ValidationError(
                {"paid_amount": "Paid amount cannot be greater than total amount."}
            )

        attrs["business"] = business
        attrs["customer"] = customer
        attrs["voucher"] = voucher

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")

        business = validated_data["business"]
        customer = validated_data.get("customer")
        voucher = validated_data.get("voucher")
        items_data = validated_data["items"]

        # Validation and creation are separate steps. Lock and re-check products
        # here so two simultaneous invoices cannot sell the same remaining stock.
        product_ids = [item["product_id"] for item in items_data]
        locked_products = Product.objects.select_for_update().filter(
            id__in=product_ids,
            business=business,
            is_active=True,
        )
        product_map = {product.id: product for product in locked_products}

        for item_data in items_data:
            product = product_map.get(item_data["product_id"])
            if not product:
                raise serializers.ValidationError(
                    {"items": "A selected product is no longer available."}
                )
            if product.stock_quantity < item_data["quantity"]:
                raise serializers.ValidationError(
                    {
                        "items": (
                            f"Not enough stock for {product.name}. "
                            f"Current stock is {product.stock_quantity}."
                        )
                    }
                )
            item_data["product"] = product

        if customer:
            customer = Customer.objects.select_for_update().get(pk=customer.pk)

        latest_sale_id = Sale.objects.count() + 1
        invoice_number = f"INV-{business.id}-{latest_sale_id:06d}"

        while Sale.objects.filter(invoice_number=invoice_number).exists():
            latest_sale_id += 1
            invoice_number = f"INV-{business.id}-{latest_sale_id:06d}"

        sale = Sale.objects.create(
            business=business,
            customer=customer,
            voucher=voucher,
            invoice_number=invoice_number,
            discount=validated_data.get("discount", 0),
            tax=validated_data.get("tax", 0),
            paid_amount=validated_data.get("paid_amount", 0),
            payment_method=validated_data.get("payment_method", "Cash"),
            note=validated_data.get("note"),
            sold_by=request.user,
            status=SaleStatus.ACTIVE,
        )

        for item_data in items_data:
            product = item_data["product"]

            SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=item_data["quantity"],
                selling_price=item_data["selling_price"],
            )

        sale.calculate_totals()
        sale.update_customer_due()

        return sale


class SalePaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_method = serializers.CharField(max_length=50, default="Cash")
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        sale_id = self.context.get("sale_id")
        business_id = self.context.get("business_id")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        try:
            sale = Sale.objects.select_related("business", "customer").get(
                id=sale_id,
                business_id=business_id,
            )
        except Sale.DoesNotExist:
            raise serializers.ValidationError({"sale": "Invoice not found."})

        if not user_can_access_business(request.user, sale.business):
            raise serializers.ValidationError({"sale": "Permission denied for this invoice."})

        if sale.status == SaleStatus.CANCELLED:
            raise serializers.ValidationError({"sale": "Cancelled invoices cannot receive payments."})

        if sale.due_amount <= 0:
            raise serializers.ValidationError({"amount": "This invoice is already fully paid."})

        if attrs["amount"] > sale.due_amount:
            raise serializers.ValidationError(
                {"amount": f"Payment cannot exceed the remaining due of {sale.due_amount}."}
            )

        attrs["sale"] = sale
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        sale_reference = validated_data.pop("sale")
        amount = validated_data["amount"]

        sale = Sale.objects.select_for_update().select_related("customer").get(
            pk=sale_reference.pk
        )

        if sale.status == SaleStatus.CANCELLED:
            raise serializers.ValidationError({"sale": "Cancelled invoices cannot receive payments."})
        if sale.due_amount <= 0:
            raise serializers.ValidationError({"amount": "This invoice is already fully paid."})
        if amount > sale.due_amount:
            raise serializers.ValidationError(
                {"amount": f"Payment cannot exceed the remaining due of {sale.due_amount}."}
            )

        previous_paid = sale.paid_amount
        payment_method = validated_data.get("payment_method", "Cash")
        payment = SalePayment.objects.create(
            sale=sale,
            amount=amount,
            payment_method=payment_method,
            note=validated_data.get("note"),
            received_by=request.user,
        )

        sale.paid_amount = previous_paid + amount
        sale.due_amount = sale.total_amount - sale.paid_amount

        if sale.due_amount <= 0:
            sale.due_amount = 0
            sale.payment_status = SalePaymentStatus.PAID
        elif sale.paid_amount > 0:
            sale.payment_status = SalePaymentStatus.PARTIAL
        else:
            sale.payment_status = SalePaymentStatus.DUE

        if previous_paid <= 0:
            sale.payment_method = payment_method
        elif sale.payment_method != payment_method and sale.payment_method != "Multiple":
            sale.payment_method = "Multiple"

        sale.save(
            update_fields=[
                "paid_amount",
                "due_amount",
                "payment_status",
                "payment_method",
                "updated_at",
            ]
        )

        if sale.customer:
            customer = Customer.objects.select_for_update().get(pk=sale.customer_id)
            customer.current_due = max(customer.current_due - amount, 0)
            customer.save(update_fields=["current_due", "updated_at"])

        return payment

    def to_representation(self, instance):
        return SalePaymentSerializer(instance, context=self.context).data


class SaleCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=1000,
    )
