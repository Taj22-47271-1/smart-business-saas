from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0002_subscriptionplan_duration_count_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="features",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
