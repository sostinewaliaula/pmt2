# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from django.conf import settings
from .project import ProjectBaseModel

class IssueWorklog(ProjectBaseModel):
    issue = models.ForeignKey(
        "db.Issue", on_delete=models.CASCADE, related_name="worklogs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="worklogs"
    )
    duration = models.IntegerField(default=0) # Duration in minutes
    date = models.DateField()
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Issue Worklog"
        verbose_name_plural = "Issue Worklogs"
        db_table = "issue_worklogs"
        ordering = ("-date", "-created_at")

    def __str__(self):
        return f"{self.user.email} logged {self.duration}m on {self.issue.name}"
