# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Count, Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.views.base import BaseViewSet
from plane.db.models import Milestone, MilestoneIssue
from plane.app.serializers import MilestoneSerializer, MilestoneIssueSerializer
from plane.app.permissions import ProjectMemberPermission


class MilestoneViewSet(BaseViewSet):
    model = Milestone
    serializer_class = MilestoneSerializer
    permission_classes = [ProjectMemberPermission]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
            )
            .annotate(
                total_issues=Count("milestone_issues", filter=Q(milestone_issues__deleted_at__isnull=True)),
                completed_issues=Count(
                    "milestone_issues",
                    filter=Q(
                        milestone_issues__issue__state__group="completed",
                        milestone_issues__deleted_at__isnull=True,
                    ),
                ),
            )
            .select_related("project", "workspace")
        )

    def perform_create(self, serializer):
        serializer.save(
            workspace_id=self.get_workspace_id(),
            project_id=self.kwargs.get("project_id"),
        )


class MilestoneIssueViewSet(BaseViewSet):
    model = MilestoneIssue
    serializer_class = MilestoneIssueSerializer
    permission_classes = [ProjectMemberPermission]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
                milestone_id=self.kwargs.get("milestone_id"),
            )
            .select_related("issue", "milestone", "project", "workspace")
        )

    def perform_create(self, serializer):
        serializer.save(
            workspace_id=self.get_workspace_id(),
            project_id=self.kwargs.get("project_id"),
            milestone_id=self.kwargs.get("milestone_id"),
        )
