# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models
from django.conf import settings

# Module imports
from .workspace import WorkspaceBaseModel
from .base import BaseModel


class Dashboard(WorkspaceBaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_public = models.BooleanField(default=False)
    owned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dashboards",
    )

    class Meta:
        verbose_name = "Dashboard"
        verbose_name_plural = "Dashboards"
        db_table = "dashboards"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.name} <{self.workspace.name}>"


class Widget(BaseModel):
    key = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=255, default="custom")

    class Meta:
        verbose_name = "Widget"
        verbose_name_plural = "Widgets"
        db_table = "widgets"
        ordering = ("-created_at",)

    def __str__(self):
        return self.name


class DashboardWidget(WorkspaceBaseModel):
    dashboard = models.ForeignKey(
        Dashboard,
        on_delete=models.CASCADE,
        related_name="dashboard_widgets",
    )
    widget = models.ForeignKey(
        Widget,
        on_delete=models.CASCADE,
        related_name="dashboard_widgets",
    )
    pos_x = models.IntegerField(default=0)
    pos_y = models.IntegerField(default=0)
    width = models.IntegerField(default=4)
    height = models.IntegerField(default=4)
    sort_order = models.FloatField(default=65535)
    filters = models.JSONField(default=dict)
    config = models.JSONField(default=dict)

    class Meta:
        verbose_name = "Dashboard Widget"
        verbose_name_plural = "Dashboard Widgets"
        db_table = "dashboard_widgets"
        ordering = ("sort_order", "-created_at")
        unique_together = ["dashboard", "widget", "deleted_at"]

    def __str__(self):
        return f"{self.dashboard.name} - {self.widget.name}"
