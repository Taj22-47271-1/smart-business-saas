from django.db import migrations, models


def migrate_employees_to_staff(apps, schema_editor):
    BusinessMember = apps.get_model("businesses", "BusinessMember")
    BusinessMember.objects.filter(role="EMPLOYEE").update(role="STAFF")


class Migration(migrations.Migration):
    dependencies = [("businesses", "0003_businessmember_added_by")]
    operations = [
        migrations.RunPython(migrate_employees_to_staff, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="businessmember",
            name="role",
            field=models.CharField(
                choices=[
                    ("OWNER", "Owner"),
                    ("MANAGER", "Manager"),
                    ("ACCOUNTANT", "Accountant"),
                    ("STAFF", "Staff"),
                    ("EMPLOYEE", "Employee (Legacy)"),
                ],
                max_length=20,
            ),
        ),
    ]
