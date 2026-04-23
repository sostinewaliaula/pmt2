# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.app.views.base import BaseViewSet
from plane.db.models import ProjectUpdate
from plane.app.serializers import ProjectUpdateSerializer
from plane.app.permissions import ProjectMemberPermission


class ProjectUpdateViewSet(BaseViewSet):
    model = ProjectUpdate
    serializer_class = ProjectUpdateSerializer
    permission_classes = [ProjectMemberPermission]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
            )
            .select_related("user", "project", "workspace")
        )

    def perform_create(self, serializer):
        serializer.save(
            workspace_id=self.get_workspace_id(),
            project_id=self.kwargs.get("project_id"),
            user=self.request.user,
        )
