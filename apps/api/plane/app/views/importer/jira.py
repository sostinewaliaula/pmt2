# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import ImporterSerializer
from plane.app.views.base import BaseAPIView
from plane.bgtasks.jira_import_task import jira_fetch_task, jira_load_task
from plane.db.models import Importer, Project, Workspace
from plane.importers.jira.client import JiraClient


class JiraImporterEndpoint(BaseAPIView):
    """
    GET  /workspaces/{slug}/projects/{project_id}/importers/jira/
         List existing Jira importers for this project (most recent first).

    POST /workspaces/{slug}/projects/{project_id}/importers/jira/
         Create a new Importer, validate Jira credentials, and fire the fetch task.
         Body: { metadata: {cloud_hostname, email, api_token, project_key},
                 config: {epics_to_modules} }
    """

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")
    def get(self, request, slug, project_id):
        importers = Importer.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            service="jira",
        ).order_by("-created_at")
        serializer = ImporterSerializer(importers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")
    def post(self, request, slug, project_id):
        workspace = Workspace.objects.get(slug=slug)
        project = Project.objects.get(pk=project_id, workspace=workspace)

        metadata = request.data.get("metadata", {})
        config = request.data.get("config", {"epics_to_modules": True})

        # Validate required credential fields
        required = ["cloud_hostname", "email", "api_token", "project_key"]
        missing = [f for f in required if not metadata.get(f)]
        if missing:
            return Response(
                {"error": f"Missing required fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Quick credential check — try fetching the project before persisting anything
        try:
            client = JiraClient(metadata["cloud_hostname"], metadata["email"], metadata["api_token"])
            client.get_project(metadata["project_key"])
        except Exception as exc:
            return Response(
                {"error": f"Could not connect to Jira: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from plane.db.models import APIToken
        token = APIToken.objects.filter(user=request.user, workspace=workspace).first()
        if not token:
            token = APIToken.objects.create(user=request.user, workspace=workspace, label="Jira Importer")

        importer = Importer.objects.create(
            service="jira",
            status="queued",
            project=project,
            workspace=workspace,
            initiated_by=request.user,
            metadata=metadata,
            config=config,
            token=token,
        )

        jira_fetch_task.delay(str(importer.id))

        return Response(ImporterSerializer(importer).data, status=status.HTTP_201_CREATED)


class JiraImporterDetailEndpoint(BaseAPIView):
    """
    GET  /workspaces/{slug}/projects/{project_id}/importers/jira/{importer_id}/
         Return current status + imported_data summary (for dry-run display).

    POST /workspaces/{slug}/projects/{project_id}/importers/jira/{importer_id}/load/
         Trigger Phase 2 load.  Only valid when status=="fetched".
    """

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")
    def get(self, request, slug, project_id, importer_id):
        try:
            importer = Importer.objects.get(
                pk=importer_id,
                workspace__slug=slug,
                project_id=project_id,
                service="jira",
            )
        except Importer.DoesNotExist:
            return Response({"error": "Importer not found"}, status=status.HTTP_404_NOT_FOUND)

        data = ImporterSerializer(importer).data

        # Attach a lightweight summary of the fetched blob for the dry-run UI
        blob = importer.imported_data or {}
        data["summary"] = {
            "issues": len(blob.get("issues", [])),
            "sprints": len(blob.get("sprints", [])),
            "epics": len(blob.get("epics", [])),
            "users": blob.get("users", []),
        }

        return Response(data, status=status.HTTP_200_OK)


class JiraImporterLoadEndpoint(BaseAPIView):
    """
    POST /workspaces/{slug}/projects/{project_id}/importers/jira/{importer_id}/load/
    Triggers the Phase 2 load task.  Only callable when status=="fetched".
    """

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")
    def post(self, request, slug, project_id, importer_id):
        try:
            importer = Importer.objects.get(
                pk=importer_id,
                workspace__slug=slug,
                project_id=project_id,
                service="jira",
            )
        except Importer.DoesNotExist:
            return Response({"error": "Importer not found"}, status=status.HTTP_404_NOT_FOUND)

        if importer.status != "fetched":
            return Response(
                {"error": f"Cannot load: importer is in status '{importer.status}', expected 'fetched'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        jira_load_task.delay(str(importer.id))

        return Response({"message": "Load started"}, status=status.HTTP_200_OK)
