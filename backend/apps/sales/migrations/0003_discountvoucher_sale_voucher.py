from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("businesses", "0003_businessmember_added_by"),
        ("sales", "0002_sale_cancel_reason_sale_cancelled_at_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="DiscountVoucher",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=50)),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                ("discount_type", models.CharField(choices=[("FIXED", "Fixed amount"), ("PERCENT", "Percentage")], default="FIXED", max_length=10)),
                ("value", models.DecimalField(decimal_places=2, max_digits=12)),
                ("minimum_purchase", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("maximum_discount", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("valid_from", models.DateTimeField(blank=True, null=True)),
                ("valid_until", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="discount_vouchers", to="businesses.business")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddField(
            model_name="sale",
            name="voucher",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sales", to="sales.discountvoucher"),
        ),
        migrations.AddConstraint(
            model_name="discountvoucher",
            constraint=models.UniqueConstraint(fields=("business", "code"), name="unique_business_voucher_code"),
        ),
    ]
