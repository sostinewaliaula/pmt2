# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import JiraImporterDetailEndpoint, JiraImporterEndpoint, JiraImporterLoadEndpoint, JiraImporterRetryEndpoint, JiraProjectListEndpoint

urlpatterns = [
    # List Jira projects (credential check before creating an importer)
    path(
        "workspaces/<str:slug>/importers/jira/list-projects/",
        JiraProjectListEndpoint.as_view(),
        name="jira-list-projects",
    ),
    # List / create importers for a project
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/importers/jira/",
        JiraImporterEndpoint.as_view(),
        name="jira-importer",
    ),
    # Poll status / get dry-run summary
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/importers/jira/<uuid:importer_id>/",
        JiraImporterDetailEndpoint.as_view(),
        name="jira-importer-detail",
    ),
    # Trigger Phase 2 load
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/importers/jira/<uuid:importer_id>/load/",
        JiraImporterLoadEndpoint.as_view(),
        name="jira-importer-load",
    ),
    # Retry a stuck/failed fetch
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/importers/jira/<uuid:importer_id>/retry/",
        JiraImporterRetryEndpoint.as_view(),
        name="jira-importer-retry",
    ),
]
