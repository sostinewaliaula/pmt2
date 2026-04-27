# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from .user import UserLiteSerializer
from plane.db.models import IssueWorklog


class WorklogIssueDetailSerializer(serializers.Serializer):
    """Compact issue payload with project info for worklog rows."""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    sequence_id = serializers.IntegerField(read_only=True)
    project_id = serializers.UUIDField(read_only=True)
    project_detail = serializers.SerializerMethodField()

    def get_project_detail(self, obj):
        project = getattr(obj, "project", None)
        if not project:
            return None
        return {
            "id": str(project.id),
            "name": project.name,
            "identifier": project.identifier,
        }


class WorklogSerializer(BaseSerializer):
    user_detail = UserLiteSerializer(source="user", read_only=True)
    issue_detail = WorklogIssueDetailSerializer(source="issue", read_only=True)

    class Meta:
        model = IssueWorklog
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "issue",
            "user",
        ]


class WorklogCreateSerializer(BaseSerializer):
    class Meta:
        model = IssueWorklog
        fields = ["duration", "date", "description"]
