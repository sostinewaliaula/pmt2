# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from .issue import IssueLiteSerializer
from plane.db.models import Milestone, MilestoneIssue


class MilestoneSerializer(BaseSerializer):
    total_issues = serializers.IntegerField(read_only=True)
    completed_issues = serializers.IntegerField(read_only=True)

    class Meta:
        model = Milestone
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
        ]


class MilestoneIssueSerializer(BaseSerializer):
    issue_detail = IssueLiteSerializer(source="issue", read_only=True)

    class Meta:
        model = MilestoneIssue
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
        ]
