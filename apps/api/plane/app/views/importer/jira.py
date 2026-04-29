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
        importers = Importer.objects.defer("imported_data").filter(
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
            # Defer imported_data — it can be hundreds of MB and is never
            # needed for the status poll; only the load task reads it.
            importer = Importer.objects.defer("imported_data").get(
                pk=importer_id,
                workspace__slug=slug,
                project_id=project_id,
                service="jira",
            )
        except Importer.DoesNotExist:
            return Response({"error": "Importer not found"}, status=status.HTTP_404_NOT_FOUND)

        data = ImporterSerializer(importer).data

        summary = importer.fetch_summary or {}
        data["summary"] = {
            "issues": summary.get("issues", 0),
            "sprints": summary.get("sprints", 0),
            "epics": summary.get("epics", 0),
            "users": summary.get("users", []),
        }
        data["fetch_progress"] = summary.get("_progress")
        data["error_message"] = importer.error_message

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


class JiraProjectListEndpoint(BaseAPIView):
    """
    POST /workspaces/{slug}/importers/jira/list-projects/
    Validates credentials and returns the list of Jira projects the user has access to.
    Body: { cloud_hostname, email, api_token }
    """

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        cloud_hostname = request.data.get("cloud_hostname", "").strip()
        email = request.data.get("email", "").strip()
        api_token = request.data.get("api_token", "").strip()

        if not all([cloud_hostname, email, api_token]):
            return Response(
                {"error": "cloud_hostname, email, and api_token are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client = JiraClient(cloud_hostname, email, api_token)
            projects = client.get_projects()
            return Response(
                [{"key": p["key"], "name": p["name"]} for p in projects],
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return Response(
                {"error": f"Could not connect to Jira: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
