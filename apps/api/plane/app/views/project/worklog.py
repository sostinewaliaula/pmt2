# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import csv
from django.http import HttpResponse

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action

# Module imports
from plane.app.views.base import BaseViewSet
from plane.db.models import IssueWorklog
from plane.app.serializers import WorklogSerializer, WorklogCreateSerializer
from plane.app.permissions import ProjectMemberPermission, ROLE, allow_permission


class WorklogViewSet(BaseViewSet):
    model = IssueWorklog
    permission_classes = [ProjectMemberPermission]
    
    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return WorklogCreateSerializer
        return WorklogSerializer

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
            )
            .select_related("issue", "user", "project", "workspace")
        )
        
        issue_id = self.kwargs.get("issue_id")
        if issue_id:
            queryset = queryset.filter(issue_id=issue_id)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(
            workspace_id=self.get_workspace_id(),
            project_id=self.kwargs.get("project_id"),
            issue_id=self.kwargs.get("issue_id"),
            user=self.request.user,
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request, slug, project_id):
        worklogs = self.get_queryset()
        
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="worklogs-{project_id}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(["Date", "Issue", "User", "Duration (minutes)", "Description"])
        
        for worklog in worklogs:
            writer.writerow([
                worklog.date,
                worklog.issue.name,
                worklog.user.email,
                worklog.duration,
                worklog.description
            ])
            
        return response

class WorkspaceWorklogViewSet(BaseViewSet):
    model = IssueWorklog
    serializer_class = WorklogSerializer
    
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def list(self, request, slug):
        queryset = (
            IssueWorklog.objects.filter(workspace__slug=slug)
            .select_related("issue", "user", "project", "workspace")
            .order_by("-date", "-created_at")
        )
        
        # Simple filtering
        user_id = request.GET.get("user_id")
        if user_id:
            queryset = queryset.filter(user_id=user_id)
            
        project_id = request.GET.get("project_id")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
            
        serializer = WorklogSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
