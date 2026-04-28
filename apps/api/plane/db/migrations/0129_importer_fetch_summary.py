from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0128_importer_error_message"),
    ]

    operations = [
        migrations.AddField(
            model_name="importer",
            name="fetch_summary",
            field=models.JSONField(null=True),
        ),
    ]
