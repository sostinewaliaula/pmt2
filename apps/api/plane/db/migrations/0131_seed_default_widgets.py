# Seeds the default widget catalog so users can add widgets to dashboards.

from django.db import migrations
import uuid


DEFAULT_WIDGETS = [
    {
        "key": "overview_stats",
        "name": "Overview Stats",
        "description": "Quick overview of assigned, pending and completed issues.",
        "category": "summary",
    },
    {
        "key": "issues_by_state_groups",
        "name": "Issues by State Groups",
        "description": "Distribution of issues across different state groups.",
        "category": "chart",
    },
    {
        "key": "issues_by_priority",
        "name": "Issues by Priority",
        "description": "Distribution of issues across different priorities.",
        "category": "chart",
    },
]


def seed_widgets(apps, schema_editor):
    Widget = apps.get_model("db", "Widget")
    for data in DEFAULT_WIDGETS:
        Widget.objects.get_or_create(
            key=data["key"],
            defaults={
                "id": uuid.uuid4(),
                "name": data["name"],
                "description": data["description"],
                "category": data["category"],
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0130_create_missing_feature_tables"),
    ]

    operations = [
        migrations.RunPython(
            seed_widgets,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
