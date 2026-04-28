# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Phase 4 — Attachment streaming.

For each Jira attachment on an issue:
  1. Download raw bytes directly from Jira (authenticated URL) via JiraClient.
  2. Compute an S3 key matching the FileAsset upload convention.
  3. Create a FileAsset row (is_uploaded=False).
  4. Stream-upload to S3/MinIO via S3Storage.upload_file().
  5. Mark is_uploaded=True.

Idempotent: skips any attachment whose (workspace, project, external_source,
external_id) row already exists.

S3Storage(request=None) safely falls back to the AWS_S3_ENDPOINT_URL /
MINIO_ENDPOINT_URL env var — no HTTP request needed inside Celery.
"""

from __future__ import annotations

import io
import logging
import mimetypes
import uuid

from django.conf import settings

from plane.db.models import FileAsset, Issue, Project, User, Workspace
from plane.importers.jira.client import JiraClient

logger = logging.getLogger(__name__)

_JIRA = "jira"


def upload_issue_attachments(
    jira_issue: dict,
    pmt_issue: Issue,
    project: Project,
    workspace: Workspace,
    actor: User,
    client: JiraClient,
) -> None:
    """
    Upload all attachments for a single Jira issue.
    Silently skips on individual download/upload failures so one bad
    attachment does not abort the rest of the import.
    """
    attachments = jira_issue.get("fields", {}).get("attachment", [])
    if not attachments:
        return

    # Import here to avoid module-level side effects in test environments
    from plane.settings.storage import S3Storage

    storage = S3Storage(request=None)

    for att in attachments:
        att_id = str(att.get("id", ""))
        filename = att.get("filename") or f"attachment-{att_id}"
        content_url = att.get("content", "")
        mime_type = (
            att.get("mimeType")
            or mimetypes.guess_type(filename)[0]
            or "application/octet-stream"
        )
        att_size = att.get("size", 0)

        if not content_url or not att_id:
            continue

        # Idempotency check
        if FileAsset.objects.filter(
            workspace=workspace,
            project=project,
            external_source=_JIRA,
            external_id=att_id,
        ).exists():
            continue

        # Honour the configured file size limit
        if att_size > settings.FILE_SIZE_LIMIT:
            logger.warning(
                "jira_attachments: skipping %s for issue %s — %d bytes exceeds limit",
                filename,
                pmt_issue.id,
                att_size,
            )
            continue

        # Download from Jira
        try:
            raw = client.download_attachment(content_url)
        except Exception as exc:
            logger.warning(
                "jira_attachments: download failed for %s on issue %s: %s",
                filename,
                pmt_issue.id,
                exc,
            )
            continue

        # S3 key — same convention as FileAsset.get_upload_path
        asset_key = f"{workspace.id}/{uuid.uuid4().hex}-{filename}"

        # Persist the row before the upload so we don't orphan bytes on failure
        asset = FileAsset.objects.create(
            asset=asset_key,
            attributes={"name": filename, "type": mime_type, "size": len(raw)},
            size=len(raw),
            workspace=workspace,
            project=project,
            issue=pmt_issue,
            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            entity_identifier=str(pmt_issue.id),
            external_source=_JIRA,
            external_id=att_id,
            created_by=actor,
            updated_by=actor,
        )

        # Stream upload — no bytes pass through the API server's memory after this point
        success = storage.upload_file(
            file_obj=io.BytesIO(raw),
            object_name=asset_key,
            content_type=mime_type,
        )

        if success:
            asset.is_uploaded = True
            asset.save(update_fields=["is_uploaded"])
            logger.debug("jira_attachments: uploaded %s → %s", filename, asset_key)
        else:
            # Remove the orphan row; the next run will retry
            asset.delete()
            logger.warning(
                "jira_attachments: S3 upload failed for %s on issue %s — row removed",
                filename,
                pmt_issue.id,
            )
