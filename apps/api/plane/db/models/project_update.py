# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from django.conf import settings
from .project import ProjectBaseModel

class ProjectUpdate(ProjectBaseModel):
    STATUS_CHOICES = (
        ("on-track", "On Track"),
        ("at-risk", "At Risk"),
        ("off-track", "Off Track"),
        ("completed", "Completed"),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_updates"
    )
    content = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="on-track")

    class Meta:
        verbose_name = "Project Update"
        verbose_name_plural = "Project Updates"
        db_table = "project_updates"
        ordering = ("-created_at",)

    def __str__(self):
        return f"Update for {self.project.name} by {self.user.email}"
