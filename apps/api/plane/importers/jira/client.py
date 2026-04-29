# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import time
import threading
from typing import Any, Generator

import requests


class JiraRateLimiter:
    """Token-bucket limiter — Jira Cloud allows ~10 req/s per user."""

    def __init__(self, rate: float = 8.0):
        self._rate = rate  # tokens per second
        self._tokens = rate
        self._last = time.monotonic()
        self._lock = threading.Lock()

    def acquire(self) -> None:
        with self._lock:
            now = time.monotonic()
            self._tokens = min(self._rate, self._tokens + (now - self._last) * self._rate)
            self._last = now
            if self._tokens < 1:
                sleep_for = (1 - self._tokens) / self._rate
                time.sleep(sleep_for)
                self._tokens = 0
            else:
                self._tokens -= 1


class JiraClient:
    """
    Thin wrapper around Jira Cloud REST API v3 and Agile API v1.

    All methods are synchronous and safe to call from a Celery task.
    Auth uses Basic auth: base64(email:api_token) per Jira Cloud docs.
    """

    PAGE_SIZE = 50

    def __init__(self, cloud_hostname: str, email: str, api_token: str):
        # Normalise hostname — strip trailing slash and protocol if user included it
        hostname = cloud_hostname.rstrip("/")
        if not hostname.startswith("http"):
            hostname = f"https://{hostname}"
        self._base_v3 = f"{hostname}/rest/api/3"
        self._base_agile = f"{hostname}/rest/agile/1.0"

        credentials = base64.b64encode(f"{email}:{api_token}".encode()).decode()
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Basic {credentials}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
        )
        self._limiter = JiraRateLimiter()

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _get(self, url: str, params: dict | None = None) -> Any:
        self._limiter.acquire()
        resp = self._session.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def _post(self, url: str, body: dict) -> Any:
        self._limiter.acquire()
        resp = self._session.post(url, json=body, timeout=30)
        if not resp.ok:
            raise requests.HTTPError(
                f"{resp.status_code} Client Error: {resp.reason} for url: {url} — {resp.text[:500]}",
                response=resp,
            )
        return resp.json()

    def _search(
        self,
        jql: str,
        fields: list[str],
        next_page_token: str | None = None,
    ) -> dict:
        """POST /rest/api/3/search/jql — cursor-based pagination, replaces deprecated /search."""
        body: dict = {"jql": jql, "maxResults": self.PAGE_SIZE, "fields": fields}
        if next_page_token:
            body["nextPageToken"] = next_page_token
        return self._post(f"{self._base_v3}/search/jql", body)

    def _paginate(self, url: str, params: dict | None = None, result_key: str = "values") -> Generator:
        """Yield individual items from a paginated Jira endpoint."""
        start_at = 0
        while True:
            p = {**(params or {}), "startAt": start_at, "maxResults": self.PAGE_SIZE}
            data = self._get(url, params=p)

            items = data.get(result_key, data if isinstance(data, list) else [])
            yield from items

            total = data.get("total", len(items))
            start_at += len(items)
            if start_at >= total or not items:
                break

    # ------------------------------------------------------------------ #
    # Project
    # ------------------------------------------------------------------ #

    def get_project(self, project_key: str) -> dict:
        return self._get(f"{self._base_v3}/project/{project_key}")

    def get_projects(self) -> list[dict]:
        return list(self._paginate(f"{self._base_v3}/project/search", result_key="values"))

    # ------------------------------------------------------------------ #
    # Statuses & issue types
    # ------------------------------------------------------------------ #

    def get_statuses(self, project_key: str) -> list[dict]:
        """Returns all statuses for a project, grouped by issue type."""
        return self._get(f"{self._base_v3}/project/{project_key}/statuses")

    def get_issue_types(self, project_key: str) -> list[dict]:
        project = self.get_project(project_key)
        return project.get("issueTypes", [])

    # ------------------------------------------------------------------ #
    # Users
    # ------------------------------------------------------------------ #

    def get_assignable_users(self, project_key: str) -> list[dict]:
        """Returns all users assignable to the project.

        Jira's assignable-user search returns a raw JSON array (not the usual
        paginated object), so we can't use _paginate here.
        """
        all_users: list[dict] = []
        start_at = 0
        while True:
            self._limiter.acquire()
            resp = self._session.get(
                f"{self._base_v3}/user/assignable/search",
                params={"project": project_key, "startAt": start_at, "maxResults": self.PAGE_SIZE},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            batch: list[dict] = data if isinstance(data, list) else data.get("values", [])
            if not batch:
                break
            all_users.extend(batch)
            if len(batch) < self.PAGE_SIZE:
                break
            start_at += len(batch)
        return all_users

    # ------------------------------------------------------------------ #
    # Issues
    # ------------------------------------------------------------------ #

    _ISSUE_FIELDS = ",".join(
        [
            "summary",
            "description",
            "status",
            "assignee",
            "reporter",
            "labels",
            "priority",
            "issuetype",
            "parent",
            "subtasks",
            "comment",
            "attachment",
            "created",
            "updated",
            "duedate",
            "customfield_10014",  # Epic Link (classic)
            "customfield_10015",  # Start date
            "customfield_10016",  # Story Points
            "customfield_10020",  # Sprint (next-gen)
        ]
    )

    def get_issues(self, project_key: str) -> Generator[dict, None, None]:
        """Yield all issues for a project (includes inline comments + attachments)."""
        jql = f"project = {project_key} ORDER BY created ASC"
        next_page_token: str | None = None
        while True:
            data = self._search(jql, self._ISSUE_FIELDS.split(","), next_page_token=next_page_token)
            issues = data.get("issues", [])
            yield from issues
            next_page_token = data.get("nextPageToken")
            if not issues or not next_page_token:
                break

    # ------------------------------------------------------------------ #
    # Epics  (Jira next-gen: issues with type "Epic")
    # ------------------------------------------------------------------ #

    def get_epics(self, project_key: str) -> list[dict]:
        jql = f"project = {project_key} AND issuetype = Epic ORDER BY created ASC"
        results = []
        next_page_token: str | None = None
        while True:
            data = self._search(
                jql, ["summary", "description", "status", "assignee", "created", "updated"], next_page_token=next_page_token
            )
            batch = data.get("issues", [])
            results.extend(batch)
            next_page_token = data.get("nextPageToken")
            if not batch or not next_page_token:
                break
        return results

    # ------------------------------------------------------------------ #
    # Sprints (Agile API)
    # ------------------------------------------------------------------ #

    def get_boards(self, project_key: str) -> list[dict]:
        return list(
            self._paginate(
                f"{self._base_agile}/board",
                params={"projectKeyOrId": project_key},
                result_key="values",
            )
        )

    def get_sprints(self, board_id: int) -> list[dict]:
        return list(
            self._paginate(
                f"{self._base_agile}/board/{board_id}/sprint",
                result_key="values",
            )
        )

    def get_sprint_issues(self, board_id: int, sprint_id: int) -> list[str]:
        """Return list of issue keys in a sprint."""
        items = list(
            self._paginate(
                f"{self._base_agile}/sprint/{sprint_id}/issue",
                params={"fields": "key"},
                result_key="issues",
            )
        )
        return [i["key"] for i in items]

    # ------------------------------------------------------------------ #
    # Attachments
    # ------------------------------------------------------------------ #

    def download_attachment(self, url: str) -> bytes:
        """Stream-download an attachment, returning raw bytes."""
        self._limiter.acquire()
        resp = self._session.get(url, timeout=60, stream=True)
        resp.raise_for_status()
        return resp.content
