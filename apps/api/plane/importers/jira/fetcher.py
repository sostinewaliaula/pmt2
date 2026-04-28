# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Phase 1 — Fetch.

Pulls everything from Jira REST API and stores a normalised JSON blob in
Importer.imported_data.  The load phase reads this blob; the two phases are
intentionally decoupled so that a failed load can retry without re-hitting
Jira's rate limits.

Blob schema:
{
  "project": { ...jira project object... },
  "statuses": [ { "name": str, "category": str, "id": str }, ... ],
  "issue_types": [ { "id": str, "name": str }, ... ],
  "users": [ { "accountId": str, "emailAddress": str, "displayName": str }, ... ],
  "epics": [ ...jira issue objects with type=Epic... ],
  "issues": [ ...jira issue objects (comments + attachments inline)... ],
  "boards": [ ...agile board objects... ],
  "sprints": [ { "id": int, "name": str, "state": str, "startDate": str,
                  "endDate": str, "issue_keys": [...] }, ... ],
}
"""

import logging

from plane.db.models import Importer
from plane.importers.jira.client import JiraClient

logger = logging.getLogger(__name__)


def _normalise_statuses(raw_statuses: list[dict]) -> list[dict]:
    """Flatten the per-issue-type status list into unique statuses."""
    seen = {}
    for issue_type_block in raw_statuses:
        for status in issue_type_block.get("statuses", []):
            sid = status["id"]
            if sid not in seen:
                seen[sid] = {
                    "id": sid,
                    "name": status["name"],
                    "category": status.get("statusCategory", {}).get("key", "undefined"),
                }
    return list(seen.values())


def _normalise_users(users: list[dict]) -> list[dict]:
    """Keep only fields relevant for identity matching."""
    return [
        {
            "accountId": u.get("accountId", ""),
            "emailAddress": u.get("emailAddress", ""),
            "displayName": u.get("displayName", ""),
            "avatarUrl": u.get("avatarUrls", {}).get("48x48", ""),
        }
        for u in users
        if u.get("accountType") == "atlassian"  # skip bots/service accounts
    ]


def fetch_jira_data(importer_id: str) -> None:
    """
    Entry point called from the Celery task.

    Reads credentials from Importer.metadata, fetches all Jira data, and
    persists the blob to Importer.imported_data with atomic status updates.
    Raises on any unrecoverable error so the task can mark status="failed".
    """
    importer = Importer.objects.get(pk=importer_id)
    meta = importer.metadata  # {cloud_hostname, email, api_token, project_key}
    config = importer.config  # {epics_to_modules: bool}

    cloud_hostname = meta["cloud_hostname"]
    email = meta["email"]
    api_token = meta["api_token"]
    project_key = meta["project_key"]
    epics_to_modules = config.get("epics_to_modules", True)

    client = JiraClient(cloud_hostname, email, api_token)

    # ------------------------------------------------------------------ #
    # 1. Project metadata
    # ------------------------------------------------------------------ #
    logger.info("jira_fetch: fetching project %s", project_key)
    project = client.get_project(project_key)

    # ------------------------------------------------------------------ #
    # 2. Statuses
    # ------------------------------------------------------------------ #
    logger.info("jira_fetch: fetching statuses")
    raw_statuses = client.get_statuses(project_key)
    statuses = _normalise_statuses(raw_statuses)

    # ------------------------------------------------------------------ #
    # 3. Issue types
    # ------------------------------------------------------------------ #
    logger.info("jira_fetch: fetching issue types")
    issue_types = [
        {"id": it["id"], "name": it["name"]}
        for it in client.get_issue_types(project_key)
    ]

    # ------------------------------------------------------------------ #
    # 4. Users
    # ------------------------------------------------------------------ #
    logger.info("jira_fetch: fetching assignable users")
    try:
        raw_users = client.get_assignable_users(project_key)
        users = _normalise_users(raw_users)
    except Exception:
        # Jira sometimes returns 403 for user listing — treat as empty
        logger.warning("jira_fetch: could not fetch users, continuing without them")
        users = []

    # ------------------------------------------------------------------ #
    # 5. Epics (only when mapping epics → modules)
    # ------------------------------------------------------------------ #
    epics = []
    if epics_to_modules:
        logger.info("jira_fetch: fetching epics")
        epics = client.get_epics(project_key)

    # ------------------------------------------------------------------ #
    # 6. Issues (includes comments + attachments inline from Jira)
    # ------------------------------------------------------------------ #
    logger.info("jira_fetch: fetching issues for project %s", project_key)
    issues = list(client.get_issues(project_key))
    logger.info("jira_fetch: fetched %d issues", len(issues))

    # Persist a running count so the UI can show progress
    importer.imported_data = {"_fetch_progress": {"issues_fetched": len(issues)}}
    importer.save(update_fields=["imported_data"])

    # ------------------------------------------------------------------ #
    # 7. Sprints via Agile API
    # ------------------------------------------------------------------ #
    sprints: list[dict] = []
    try:
        boards = client.get_boards(project_key)
        for board in boards:
            board_id = board["id"]
            for sprint in client.get_sprints(board_id):
                sprint_copy = dict(sprint)
                sprint_copy["issue_keys"] = client.get_sprint_issues(board_id, sprint["id"])
                sprints.append(sprint_copy)
        logger.info("jira_fetch: fetched %d sprints across %d boards", len(sprints), len(boards))
    except Exception:
        # Agile API absent on some Jira Software plans — not fatal
        logger.warning("jira_fetch: could not fetch sprints/boards, continuing without them")
        boards = []

    # ------------------------------------------------------------------ #
    # 8. Persist final blob
    # ------------------------------------------------------------------ #
    blob = {
        "project": project,
        "statuses": statuses,
        "issue_types": issue_types,
        "users": users,
        "epics": epics,
        "issues": issues,
        "boards": boards,
        "sprints": sprints,
    }

    importer.imported_data = blob
    importer.save(update_fields=["imported_data"])
    logger.info(
        "jira_fetch: complete — %d issues, %d users, %d sprints",
        len(issues),
        len(users),
        len(sprints),
    )
