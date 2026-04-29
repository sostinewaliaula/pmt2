# Generated 2026-04-29
# Creates feature tables (dashboards, widgets, worklogs, milestones, project_updates)
# on deployments where migrations 0122-0125 were already recorded as applied but
# never actually created the tables (they had empty database_operations).

from django.db import migrations


def create_missing_feature_tables(apps, schema_editor):
    from django.db import connection

    existing_tables = set(connection.introspection.table_names())

    # Order matters: dependencies before dependents
    models_to_create = [
        ("widgets", "db", "Widget"),
        ("dashboards", "db", "Dashboard"),
        ("dashboard_widgets", "db", "DashboardWidget"),
        ("issue_worklogs", "db", "IssueWorklog"),
        ("milestones", "db", "Milestone"),
        ("milestone_issues", "db", "MilestoneIssue"),
        ("project_updates", "db", "ProjectUpdate"),
    ]

    for table_name, app_label, model_name in models_to_create:
        if table_name not in existing_tables:
            model = apps.get_model(app_label, model_name)
            schema_editor.create_model(model)


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0129_importer_fetch_summary"),
    ]

    operations = [
        migrations.RunPython(
            create_missing_feature_tables,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
