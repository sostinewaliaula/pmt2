# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand
from plane.db.models import Widget

class Command(BaseCommand):
    help = 'Seeds the default widgets for dashboards'

    def handle(self, *args, **options):
        widgets = [
            {
                "key": "overview_stats",
                "name": "Overview Stats",
                "description": "Quick overview of assigned, pending and completed issues.",
                "category": "summary"
            },
            {
                "key": "issues_by_state_groups",
                "name": "Issues by State Groups",
                "description": "Distribution of issues across different state groups.",
                "category": "chart"
            },
            {
                "key": "issues_by_priority",
                "name": "Issues by Priority",
                "description": "Distribution of issues across different priorities.",
                "category": "chart"
            },
            {
                "key": "assigned_issues",
                "name": "Assigned Issues",
                "description": "List of issues assigned to you.",
                "category": "list"
            },
            {
                "key": "recent_activity",
                "name": "Recent Activity",
                "description": "Recent activity across your projects.",
                "category": "list"
            }
        ]

        for widget_data in widgets:
            widget, created = Widget.objects.get_or_create(
                key=widget_data["key"],
                defaults={
                    "name": widget_data["name"],
                    "description": widget_data["description"],
                    "category": widget_data["category"]
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created widget: {widget.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Widget already exists: {widget.name}'))
