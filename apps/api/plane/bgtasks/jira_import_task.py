# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging

from celery import shared_task

from plane.db.models import Importer
from plane.utils.exception_logger import log_exception

logger = logging.getLogger(__name__)


@shared_task
def jira_fetch_task(importer_id: str) -> None:
    """
    Phase 1 — pull all data from Jira and store in Importer.imported_data.

    Status transitions: queued → processing → (fetched | failed).
    The "fetched" status signals that Phase 2 (load) can begin; the UI
    can trigger jira_load_task once it shows the dry-run summary to the user.
    """
    try:
        importer = Importer.objects.get(pk=importer_id)
        importer.status = "processing"
        importer.save(update_fields=["status"])
    except Importer.DoesNotExist:
        logger.error("jira_fetch_task: importer %s not found", importer_id)
        return

    try:
        from plane.importers.jira.fetcher import fetch_jira_data

        fetch_jira_data(importer_id)

        importer.refresh_from_db()
        importer.status = "fetched"
        importer.save(update_fields=["status"])
        logger.info("jira_fetch_task: importer %s fetch complete", importer_id)

    except Exception as exc:
        log_exception(exc)
        try:
            importer.refresh_from_db()
            importer.status = "failed"
            importer.error_message = str(exc)
            importer.save(update_fields=["status", "error_message"])
        except Exception:
            pass


@shared_task
def jira_load_task(importer_id: str) -> None:
    """
    Phase 2 — transform the fetched JSON blob and write to Postgres.

    Status transitions: fetched → loading → completed | failed.
    Must only be called after jira_fetch_task has set status="fetched".
    """
    try:
        importer = Importer.objects.get(pk=importer_id)
        importer.status = "loading"
        importer.save(update_fields=["status"])
    except Importer.DoesNotExist:
        logger.error("jira_load_task: importer %s not found", importer_id)
        return

    try:
        from plane.importers.jira.loader import load_jira_data

        load_jira_data(importer_id)

        importer.refresh_from_db()
        importer.status = "completed"
        importer.save(update_fields=["status"])
        logger.info("jira_load_task: importer %s load complete", importer_id)

    except Exception as exc:
        log_exception(exc)
        try:
            importer.refresh_from_db()
            importer.status = "failed"
            importer.error_message = str(exc)
            importer.save(update_fields=["status", "error_message"])
        except Exception:
            pass
