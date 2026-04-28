# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0126_project_feature_views"),
    ]

    operations = [
        migrations.AlterField(
            model_name="importer",
            name="status",
            field=models.CharField(
                choices=[
                    ("queued", "Queued"),
                    ("processing", "Processing"),
                    ("fetched", "Fetched"),
                    ("loading", "Loading"),
                    ("completed", "Completed"),
                    ("failed", "Failed"),
                ],
                default="queued",
                max_length=50,
            ),
        ),
    ]
