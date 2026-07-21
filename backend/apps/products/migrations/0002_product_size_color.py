from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="size",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="product",
            name="color",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AlterUniqueTogether(
            name="product",
            unique_together={("business", "name", "size", "color")},
        ),
    ]
