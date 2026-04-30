# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from .user import UserLiteSerializer
from plane.db.models import Dashboard, Widget, DashboardWidget


class WidgetSerializer(BaseSerializer):
    class Meta:
        model = Widget
        fields = "__all__"


class DashboardWidgetSerializer(BaseSerializer):
    widget_detail = WidgetSerializer(source="widget", read_only=True)

    class Meta:
        model = DashboardWidget
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "dashboard",
        ]
        # Suppress the auto-generated UniqueTogetherValidator for
        # (dashboard, widget, deleted_at) — "dashboard" is read-only and
        # not present in request data, which causes DRF to raise a spurious
        # "This field is required" error. The DB constraint still enforces
        # uniqueness where needed.
        validators = []


class DashboardSerializer(BaseSerializer):
    owned_by_detail = UserLiteSerializer(source="owned_by", read_only=True)
    widgets = DashboardWidgetSerializer(source="dashboard_widgets", many=True, read_only=True)

    class Meta:
        model = Dashboard
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "owned_by",
        ]


class DashboardLiteSerializer(BaseSerializer):
    class Meta:
        model = Dashboard
        fields = ["id", "name", "description", "is_public"]
        read_only_fields = fields
