from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0003_subscriptionplan_features"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
    ]
