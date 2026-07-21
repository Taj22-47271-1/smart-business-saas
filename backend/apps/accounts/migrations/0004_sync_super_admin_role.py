from django.db import migrations


def sync_super_admin_roles(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(is_superuser=True).exclude(role="SUPER_ADMIN").update(role="SUPER_ADMIN")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_user_must_change_password_alter_user_role")]
    operations = [migrations.RunPython(sync_super_admin_roles, migrations.RunPython.noop)]
