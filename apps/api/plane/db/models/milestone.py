# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from .project import ProjectBaseModel

class Milestone(ProjectBaseModel):
    STATUS_CHOICES = (
        ("planned", "Planned"),
        ("in-progress", "In Progress"),
        ("completed", "Completed"),
        ("on-hold", "On Hold"),
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planned")

    class Meta:
        verbose_name = "Milestone"
        verbose_name_plural = "Milestones"
        db_table = "milestones"
        ordering = ("target_date", "created_at")

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class MilestoneIssue(ProjectBaseModel):
    milestone = models.ForeignKey(
        Milestone, on_delete=models.CASCADE, related_name="milestone_issues"
    )
    issue = models.ForeignKey(
        "db.Issue", on_delete=models.CASCADE, related_name="milestone_issues"
    )

    class Meta:
        verbose_name = "Milestone Issue"
        verbose_name_plural = "Milestone Issues"
        db_table = "milestone_issues"
        unique_together = ("milestone", "issue")

    def __str__(self):
        return f"{self.issue.name} - {self.milestone.name}"
