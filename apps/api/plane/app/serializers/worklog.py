# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from .user import UserLiteSerializer
from .issue import IssueLiteSerializer
from plane.db.models import IssueWorklog


class WorklogSerializer(BaseSerializer):
    user_detail = UserLiteSerializer(source="user", read_only=True)
    issue_detail = IssueLiteSerializer(source="issue", read_only=True)

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
