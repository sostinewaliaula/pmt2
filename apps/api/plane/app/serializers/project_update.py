# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from .user import UserLiteSerializer
from plane.db.models import ProjectUpdate


class ProjectUpdateSerializer(BaseSerializer):
    user_detail = UserLiteSerializer(source="user", read_only=True)

    class Meta:
        model = ProjectUpdate
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "user",
        ]
