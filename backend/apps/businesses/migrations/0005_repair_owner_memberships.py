from django.db import migrations


def repair_owner_memberships(apps, schema_editor):
    Business = apps.get_model("businesses", "Business")
    BusinessMember = apps.get_model("businesses", "BusinessMember")
    User = apps.get_model("accounts", "User")

    owner_ids = set()

    for business in Business.objects.all().iterator():
        owner_ids.add(business.owner_id)
        BusinessMember.objects.update_or_create(
            business_id=business.id,
            user_id=business.owner_id,
            defaults={
                "role": "OWNER",
                "status": "ACTIVE",
            },
        )

    if owner_ids:
        User.objects.filter(
            id__in=owner_ids,
            role="USER",
            is_superuser=False,
        ).update(role="BUSINESS_OWNER")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_sync_super_admin_role"),
        ("businesses", "0004_business_member_roles"),
    ]

    operations = [
        migrations.RunPython(repair_owner_memberships, migrations.RunPython.noop),
    ]
