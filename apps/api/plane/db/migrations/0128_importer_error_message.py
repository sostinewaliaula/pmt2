from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0127_importer_jira_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="importer",
            name="error_message",
            field=models.TextField(blank=True, null=True),
        ),
    ]
