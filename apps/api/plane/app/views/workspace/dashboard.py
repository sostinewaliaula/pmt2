# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Count, F, Q
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import WorkSpaceBasePermission, WorkspaceEntityPermission
from plane.app.serializers import (
    DashboardSerializer,
    DashboardWidgetSerializer,
    WidgetSerializer,
    IssueStateSerializer,
)
from plane.app.views.base import BaseViewSet, BaseAPIView
from plane.db.models import Dashboard, Widget, DashboardWidget, Issue, Project, WorkspaceMember


class DashboardViewSet(BaseViewSet):
    permission_classes = [WorkspaceEntityPermission]
    model = Dashboard
    serializer_class = DashboardSerializer

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .select_related("workspace", "owned_by")
            .prefetch_related("dashboard_widgets", "dashboard_widgets__widget")
        )

    def perform_create(self, serializer):
        serializer.save(
            workspace_id=self.workspace_id,
            owned_by=self.request.user,
        )


class WidgetViewSet(BaseViewSet):
    permission_classes = [WorkSpaceBasePermission]
    model = Widget
    serializer_class = WidgetSerializer

    def get_queryset(self):
        return super().get_queryset()


class DashboardWidgetViewSet(BaseViewSet):
    permission_classes = [WorkspaceEntityPermission]
    model = DashboardWidget
    serializer_class = DashboardWidgetSerializer

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(
                workspace__slug=self.kwargs.get("slug"),
                dashboard_id=self.kwargs.get("dashboard_id"),
            )
            .select_related("widget")
        )

    def perform_create(self, serializer):
        serializer.save(
            workspace_id=self.workspace_id,
            dashboard_id=self.kwargs.get("dashboard_id"),
        )


class DashboardWidgetStatsEndpoint(BaseAPIView):
    permission_classes = [WorkspaceEntityPermission]

    def get(self, request, slug, dashboard_id, widget_id):
        widget_instance = DashboardWidget.objects.get(
            pk=widget_id, dashboard_id=dashboard_id, workspace__slug=slug
        )
        widget_key = widget_instance.widget.key
        filters = widget_instance.filters

        # Basic issue queryset for the workspace
        base_issues = Issue.issue_objects.filter(workspace__slug=slug)

        if widget_key == "overview_stats":
            assigned_issues_count = base_issues.filter(assignees__in=[request.user]).count()
            pending_issues_count = base_issues.filter(
                assignees__in=[request.user],
                state__group__in=["backlog", "unstarted", "started"],
            ).count()
            completed_issues_count = base_issues.filter(
                assignees__in=[request.user], state__group="completed"
            ).count()
            created_issues_count = base_issues.filter(created_by=request.user).count()

            return Response(
                {
                    "assigned_issues_count": assigned_issues_count,
                    "pending_issues_count": pending_issues_count,
                    "completed_issues_count": completed_issues_count,
                    "created_issues_count": created_issues_count,
                },
                status=status.HTTP_200_OK,
            )

        if widget_key == "issues_by_state_groups":
            stats = (
                base_issues.filter(assignees__in=[request.user])
                .values(state_group=F("state__group"))
                .annotate(count=Count("id"))
                .order_by("state_group")
            )
            return Response(stats, status=status.HTTP_200_OK)

        if widget_key == "issues_by_priority":
            stats = (
                base_issues.filter(assignees__in=[request.user])
                .values("priority")
                .annotate(count=Count("id"))
                .order_by("priority")
            )
            return Response(stats, status=status.HTTP_200_OK)

        # Fallback for unknown widget keys
        return Response(
            {"error": "Widget stats logic not implemented for this key"},
            status=status.HTTP_400_BAD_REQUEST,
        )
