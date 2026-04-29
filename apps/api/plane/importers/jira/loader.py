# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Phase 2 — Transform & Load.

Reads the JSON blob stored in Importer.imported_data and bulk-writes to
Postgres using direct ORM calls (not REST endpoints).

Load order (respects FK dependencies):
  States → Labels → Modules (epics) → Cycles (sprints)
  → Issues (first pass, no parent) → Issue parents (second pass)
  → IssueAssignees → IssueLabels → ModuleIssues → CycleIssues
  → IssueComments

Idempotency: every entity is written via update_or_create keyed on
  (project, external_source="jira", external_id=<jira_id>).

Important: Issue.save() acquires a per-project advisory lock and creates
an IssueSequence row, so issues and comments must be saved individually —
bulk_create would bypass this logic. Simple junction tables (IssueAssignee,
IssueLabel, etc.) use bulk_create(update_conflicts=True/ignore_conflicts=True).
"""

from __future__ import annotations

import logging
from datetime import datetime, date

from crum import impersonate
from django.utils.dateparse import parse_date, parse_datetime

from django.db.models.functions import Lower

from plane.db.models import (
    Cycle,
    CycleIssue,
    Importer,
    Issue,
    IssueAssignee,
    IssueComment,
    IssueLabel,
    Label,
    Module,
    ModuleIssue,
    Project,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.importers.jira.transformer import (
    adf_to_html,
    jira_priority_to_pmt,
    sprint_dates,
    status_category_to_state_group,
)

logger = logging.getLogger(__name__)

_JIRA = "jira"
# Colour palette for auto-created states/labels
_STATE_COLORS = {
    "backlog": "#60646C",
    "unstarted": "#60646C",
    "started": "#F59E0B",
    "completed": "#46A758",
    "cancelled": "#9AA4BC",
}
_LABEL_COLORS = [
    "#FF6B6B", "#FFA94D", "#FFD43B", "#A9E34B", "#63E6BE",
    "#4DABF7", "#748FFC", "#DA77F2", "#F783AC", "#ADB5BD",
]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _safe_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return parse_date(value[:10])
    except Exception:
        return None


def _safe_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return parse_datetime(value)
    except Exception:
        return None


def _pick_color(name: str, palette: list[str]) -> str:
    return palette[hash(name) % len(palette)]


# --------------------------------------------------------------------------- #
# Main entry point
# --------------------------------------------------------------------------- #

def load_jira_data(importer_id: str) -> None:
    """
    Entry point called from the Celery task after fetch completes.

    Runs the full transform+load pipeline.  Status transitions:
    fetched → loading → completed | failed.
    """
    importer = Importer.objects.select_related("project", "workspace", "initiated_by").get(pk=importer_id)
    blob: dict = importer.imported_data or {}
    project: Project = importer.project
    workspace: Workspace = importer.workspace
    actor: User = importer.initiated_by
    config: dict = importer.config

    logger.info("jira_load: starting load for project %s", project.id)

    # Rebuild the Jira client from stored credentials for attachment downloads
    meta = importer.metadata
    from plane.importers.jira.client import JiraClient
    jira_client = JiraClient(meta["cloud_hostname"], meta["email"], meta["api_token"])

    # Impersonate the initiating user so BaseModel.save() sets created_by/updated_by
    # correctly throughout all ORM writes (get_current_user() returns None in Celery).
    with impersonate(actor):
        _run_load(blob, project, workspace, actor, config, jira_client)


def _run_load(
    blob: dict,
    project: Project,
    workspace: Workspace,
    actor: User,
    config: dict,
    jira_client=None,
) -> None:
    epics_to_modules: bool = config.get("epics_to_modules", True)

    # ------------------------------------------------------------------ #
    # 1. States
    # ------------------------------------------------------------------ #
    state_map = _load_states(blob.get("statuses", []), project, workspace, actor)

    # ------------------------------------------------------------------ #
    # 2. Labels  (Jira labels + issue types as labels)
    # ------------------------------------------------------------------ #
    label_map = _load_labels(blob, project, workspace, actor)

    # ------------------------------------------------------------------ #
    # 3. Modules (Jira epics → PMT modules)
    # ------------------------------------------------------------------ #
    module_map: dict[str, Module] = {}
    if epics_to_modules:
        module_map = _load_modules(blob.get("epics", []), project, workspace, actor)

    # ------------------------------------------------------------------ #
    # 4. Cycles (Jira sprints → PMT cycles)
    # ------------------------------------------------------------------ #
    cycle_map = _load_cycles(blob.get("sprints", []), project, workspace, actor)

    # ------------------------------------------------------------------ #
    # 5. User map — Jira accountId → PMT User (matched by email)
    # ------------------------------------------------------------------ #
    user_map = _build_user_map(blob.get("users", []), workspace)

    # ------------------------------------------------------------------ #
    # 5a. Add matched users as project members (role: Member)
    # ------------------------------------------------------------------ #
    _add_project_members(user_map, project)

    # ------------------------------------------------------------------ #
    # 6. Issues — first pass (no parent)
    # ------------------------------------------------------------------ #
    issues = blob.get("issues", [])
    issue_map = _load_issues(
        issues, project, workspace, actor, state_map, user_map, label_map,
        module_map, cycle_map, epics_to_modules,
        raw_sprints=blob.get("sprints", []),
        jira_client=jira_client,
    )

    # ------------------------------------------------------------------ #
    # 7. Issue parents — second pass
    # ------------------------------------------------------------------ #
    _link_parents(issues, issue_map, project, workspace, actor)

    # ------------------------------------------------------------------ #
    # 8. Comments
    # ------------------------------------------------------------------ #
    _load_comments(issues, issue_map, project, workspace, actor, user_map)

    logger.info(
        "jira_load: done — %d issues, %d states, %d labels, %d modules, %d cycles",
        len(issue_map),
        len(state_map),
        len(label_map),
        len(module_map),
        len(cycle_map),
    )


# --------------------------------------------------------------------------- #
# States
# --------------------------------------------------------------------------- #

def _load_states(
    statuses: list[dict],
    project: Project,
    workspace: Workspace,
    actor: User,
) -> dict[str, State]:
    """Returns {jira_status_id: State}."""
    state_map: dict[str, State] = {}

    fallback_state = State.objects.filter(project=project, default=True).first()

    for status in statuses:
        sid = status["id"]
        name = status["name"]
        group = status_category_to_state_group(status.get("category", ""))
        color = _STATE_COLORS.get(group, "#60646C")

        # 1. Already tagged from a previous import run — find by external_id
        state = State.all_state_objects.filter(
            project=project, external_source=_JIRA, external_id=sid
        ).first()

        # 2. Default state with the same name already exists (e.g. "Done", "In Progress")
        if state is None:
            state = State.all_state_objects.filter(project=project, name=name).first()

        if state is not None:
            # Tag it so future re-runs find it by external_id, and align group/color
            State.all_state_objects.filter(pk=state.pk).update(
                external_source=_JIRA,
                external_id=sid,
                group=group,
                color=color,
            )
            state.external_source = _JIRA
            state.external_id = sid
        else:
            state = State.all_state_objects.create(
                project=project,
                workspace=workspace,
                name=name,
                group=group,
                color=color,
                external_source=_JIRA,
                external_id=sid,
                created_by=actor,
                updated_by=actor,
            )

        state_map[sid] = state

    if not state_map and fallback_state:
        state_map["__default__"] = fallback_state

    return state_map


# --------------------------------------------------------------------------- #
# Labels
# --------------------------------------------------------------------------- #

def _load_labels(
    blob: dict,
    project: Project,
    workspace: Workspace,
    actor: User,
) -> dict[str, Label]:
    """
    Returns {label_name: Label}.
    Sources: Jira text labels (from issues) + issue types.
    """
    label_names: set[str] = set()

    # Collect all unique label strings from issues
    for issue in blob.get("issues", []):
        for lbl in issue.get("fields", {}).get("labels", []):
            if lbl:
                label_names.add(lbl)

    # Also treat issue types as labels (for grouping by Bug/Story/Task)
    for it in blob.get("issue_types", []):
        if it.get("name"):
            label_names.add(it["name"])

    label_map: dict[str, Label] = {}
    for name in label_names:
        color = _pick_color(name, _LABEL_COLORS)

        label = Label.objects.filter(project=project, external_source=_JIRA, external_id=name).first()
        if label is None:
            label = Label.objects.filter(project=project, name=name).first()

        if label is not None:
            Label.objects.filter(pk=label.pk).update(
                external_source=_JIRA, external_id=name, color=color
            )
        else:
            label = Label.objects.create(
                workspace=workspace,
                project=project,
                name=name,
                color=color,
                external_source=_JIRA,
                external_id=name,
                created_by=actor,
                updated_by=actor,
            )
        label_map[name] = label

    return label_map


# --------------------------------------------------------------------------- #
# Modules (epics)
# --------------------------------------------------------------------------- #

def _load_modules(
    epics: list[dict],
    project: Project,
    workspace: Workspace,
    actor: User,
) -> dict[str, Module]:
    """Returns {jira_epic_key: Module}."""
    module_map: dict[str, Module] = {}

    for epic in epics:
        key = epic.get("key", "")
        fields = epic.get("fields", {})
        name = fields.get("summary") or key

        existing = Module.objects.filter(project=project, external_source=_JIRA, external_id=key).first()
        if existing is None:
            existing = Module.objects.filter(project=project, name=name).first()

        if existing:
            Module.objects.filter(pk=existing.pk).update(
                external_source=_JIRA, external_id=key, name=name
            )
            existing.external_source = _JIRA
            existing.external_id = key
            module_map[key] = existing
        else:
            module = Module(
                workspace=workspace,
                project=project,
                name=name,
                status="planned",
                external_source=_JIRA,
                external_id=key,
                created_by=actor,
                updated_by=actor,
            )
            module.save()
            module_map[key] = module

    return module_map


# --------------------------------------------------------------------------- #
# Cycles (sprints)
# --------------------------------------------------------------------------- #

def _load_cycles(
    sprints: list[dict],
    project: Project,
    workspace: Workspace,
    actor: User,
) -> dict[int, Cycle]:
    """Returns {jira_sprint_id: Cycle}."""
    cycle_map: dict[int, Cycle] = {}

    for sprint in sprints:
        sid = sprint.get("id")
        if sid is None:
            continue
        name = sprint.get("name") or f"Sprint {sid}"
        start_raw, end_raw = sprint_dates(sprint)

        existing = Cycle.objects.filter(project=project, external_source=_JIRA, external_id=str(sid)).first()
        if existing is None:
            existing = Cycle.objects.filter(project=project, name=name).first()

        if existing:
            Cycle.objects.filter(pk=existing.pk).update(
                external_source=_JIRA,
                external_id=str(sid),
                name=name,
                start_date=_safe_datetime(start_raw),
                end_date=_safe_datetime(end_raw),
            )
            existing.external_source = _JIRA
            existing.external_id = str(sid)
            cycle_map[sid] = existing
        else:
            cycle = Cycle(
                workspace=workspace,
                project=project,
                name=name,
                start_date=_safe_datetime(start_raw),
                end_date=_safe_datetime(end_raw),
                owned_by=actor,
                external_source=_JIRA,
                external_id=str(sid),
                created_by=actor,
                updated_by=actor,
            )
            cycle.save()
            cycle_map[sid] = cycle

    return cycle_map


# --------------------------------------------------------------------------- #
# User map
# --------------------------------------------------------------------------- #

def _build_user_map(users: list[dict], workspace: Workspace) -> dict[str, User]:
    """
    Returns {jira_accountId: PMT User} for workspace members whose email
    matches a Jira user email (case-insensitive).
    """
    # Build lowercase-email → accountId lookup
    email_to_account: dict[str, str] = {
        u["emailAddress"].lower(): u["accountId"]
        for u in users
        if u.get("emailAddress")
    }
    if not email_to_account:
        logger.warning("jira_load: no user emails available — assignees will not be mapped")
        return {}

    # Restrict to current workspace members only
    member_ids = WorkspaceMember.objects.filter(
        workspace=workspace, is_active=True
    ).values_list("member_id", flat=True)

    pmt_users = (
        User.objects.filter(id__in=member_ids)
        .annotate(email_lower=Lower("email"))
        .filter(email_lower__in=email_to_account.keys())
    )

    account_to_user: dict[str, User] = {}
    for user in pmt_users:
        account_id = email_to_account.get(user.email_lower)  # type: ignore[attr-defined]
        if account_id:
            account_to_user[account_id] = user

    unmatched = set(email_to_account.keys()) - {u.email_lower for u in pmt_users}  # type: ignore[attr-defined]
    if unmatched:
        logger.info(
            "jira_load: %d Jira user(s) have no matching workspace member: %s",
            len(unmatched),
            ", ".join(sorted(unmatched)[:10]),
        )

    logger.info("jira_load: matched %d/%d Jira users to PMT accounts", len(account_to_user), len(email_to_account))
    return account_to_user


def _add_project_members(user_map: dict[str, User], project: Project) -> int:
    """
    Ensures every matched Jira user is an active member of the target project.
    Existing members are left untouched (role preserved).
    Returns the number of newly added members.
    """
    if not user_map:
        return 0

    users = list(user_map.values())

    existing_member_ids = set(
        ProjectMember.objects.filter(
            project=project, member__in=users, deleted_at__isnull=True
        ).values_list("member_id", flat=True)
    )

    added = 0
    for user in users:
        if user.id in existing_member_ids:
            continue
        try:
            ProjectMember(
                project=project,
                member=user,
                role=15,  # Member
                is_active=True,
            ).save()
            added += 1
        except Exception as exc:
            logger.warning("jira_load: could not add %s as project member — %s", user.email, exc)

    logger.info(
        "jira_load: %d user(s) added as project members, %d already present",
        added,
        len(existing_member_ids),
    )
    return added


# --------------------------------------------------------------------------- #
# Issues
# --------------------------------------------------------------------------- #

def _get_epic_key(fields: dict) -> str | None:
    """Extract epic key from Jira next-gen or classic fields."""
    # next-gen: issue type "Epic" — key is in the issue itself
    # classic epic link: customfield_10014
    return fields.get("customfield_10014") or None


def _load_issues(
    issues: list[dict],
    project: Project,
    workspace: Workspace,
    actor: User,
    state_map: dict[str, State],
    user_map: dict[str, User],
    label_map: dict[str, Label],
    module_map: dict[str, Module],
    cycle_map: dict[int, Cycle],
    epics_to_modules: bool,
    raw_sprints: list[dict] | None = None,
    jira_client=None,
) -> dict[str, Issue]:
    """
    First pass: create/update Issue rows without parent links.
    Returns {jira_issue_key: Issue}.
    """
    issue_map: dict[str, Issue] = {}

    # Pre-build sprint membership lookup: issue_key → list of sprint ids
    sprint_issues: dict[str, list[int]] = {}
    for sprint in (raw_sprints or []):
        for ikey in sprint.get("issue_keys", []):
            sprint_issues.setdefault(ikey, []).append(sprint["id"])

    for jira_issue in issues:
        key = jira_issue.get("key", "")
        fields = jira_issue.get("fields", {})

        # State
        status = fields.get("status", {})
        status_id = status.get("id", "")
        state = state_map.get(status_id) or state_map.get("__default__")

        # Reporter / assignee
        reporter = _user(fields.get("reporter"), user_map)
        created_by = reporter or actor

        # Timestamps from Jira — preserved via queryset.update() after save
        jira_created = _safe_datetime(fields.get("created"))
        jira_updated = _safe_datetime(fields.get("updated"))

        # Description
        desc_html = adf_to_html(fields.get("description"))

        # Priority
        priority_name = (fields.get("priority") or {}).get("name")
        priority = jira_priority_to_pmt(priority_name)

        # Start date — Jira stores this in customfield_10015
        start_date = _safe_date(fields.get("customfield_10015"))

        existing = Issue.objects.filter(
            project=project,
            external_source=_JIRA,
            external_id=key,
        ).first()

        if existing:
            existing.name = fields.get("summary", key)[:255]
            existing.description_html = desc_html
            existing.state = state
            existing.priority = priority
            existing.start_date = start_date
            existing.target_date = _safe_date(fields.get("duedate"))
            existing.updated_by = created_by
            existing.save(
                update_fields=[
                    "name", "description_html", "description_stripped",
                    "state", "priority", "start_date", "target_date",
                    "updated_by", "updated_at",
                ],
                disable_auto_set_user=True,
            )
            if jira_updated:
                Issue.objects.filter(pk=existing.pk).update(updated_at=jira_updated)
            issue = existing
        else:
            issue = Issue(
                workspace=workspace,
                project=project,
                name=fields.get("summary", key)[:255],
                description_html=desc_html,
                state=state,
                priority=priority,
                start_date=start_date,
                target_date=_safe_date(fields.get("duedate")),
                external_source=_JIRA,
                external_id=key,
                created_by=created_by,
                updated_by=created_by,
            )
            # disable_auto_set_user=True so BaseModel.save() does not override
            # created_by/updated_by with the Celery actor (the admin who ran the import)
            issue.save(disable_auto_set_user=True)
            ts_update: dict = {}
            if jira_created:
                ts_update["created_at"] = jira_created
            if jira_updated:
                ts_update["updated_at"] = jira_updated
            if ts_update:
                Issue.objects.filter(pk=issue.pk).update(**ts_update)

        issue_map[key] = issue

        # Attachments (Phase 4)
        if jira_client is not None:
            try:
                from plane.importers.jira.attachment_uploader import upload_issue_attachments
                upload_issue_attachments(jira_issue, issue, project, workspace, actor, jira_client)
            except Exception as exc:
                logger.warning("jira_load: attachment upload failed for %s: %s", key, exc)

        # Assignees
        _upsert_assignees(issue, fields, user_map, project, workspace, actor)

        # Labels (text labels + issue type label)
        _upsert_labels(issue, fields, label_map, project, workspace, actor)

        # Module membership (epic link)
        if epics_to_modules:
            epic_key = _get_epic_key(fields)
            if epic_key and epic_key in module_map:
                _upsert_module_issue(module_map[epic_key], issue, project, workspace, actor)

        # Cycle membership (sprint)
        for sprint_id in sprint_issues.get(key, []):
            if sprint_id in cycle_map:
                _upsert_cycle_issue(cycle_map[sprint_id], issue, project, workspace, actor)

    return issue_map


def _user(jira_user: dict | None, user_map: dict[str, User]) -> User | None:
    if not jira_user:
        return None
    return user_map.get(jira_user.get("accountId", ""))


# --------------------------------------------------------------------------- #
# Parent linking (second pass)
# --------------------------------------------------------------------------- #

def _link_parents(
    issues: list[dict],
    issue_map: dict[str, Issue],
    project: Project,
    workspace: Workspace,
    actor: User,
) -> None:
    for jira_issue in issues:
        key = jira_issue.get("key", "")
        fields = jira_issue.get("fields", {})
        parent_field = fields.get("parent") or {}
        parent_key = parent_field.get("key")

        if not parent_key or key not in issue_map:
            continue
        parent_issue = issue_map.get(parent_key)
        if not parent_issue:
            continue

        issue = issue_map[key]
        if issue.parent_id != parent_issue.id:
            issue.parent = parent_issue
            issue.updated_by = actor
            issue.save(update_fields=["parent", "updated_by", "updated_at"])


# --------------------------------------------------------------------------- #
# Comments
# --------------------------------------------------------------------------- #

def _load_comments(
    issues: list[dict],
    issue_map: dict[str, Issue],
    project: Project,
    workspace: Workspace,
    actor: User,
    user_map: dict[str, User],
) -> None:
    for jira_issue in issues:
        key = jira_issue.get("key", "")
        pmt_issue = issue_map.get(key)
        if not pmt_issue:
            continue

        comments_block = jira_issue.get("fields", {}).get("comment", {})
        comments = comments_block.get("comments", []) if isinstance(comments_block, dict) else []

        for comment in comments:
            cid = comment.get("id", "")
            author = _user(comment.get("author"), user_map)
            comment_author = author or actor
            comment_html = adf_to_html(comment.get("body"))
            comment_created = _safe_datetime(comment.get("created"))
            comment_updated = _safe_datetime(comment.get("updated"))

            existing = IssueComment.objects.filter(
                issue=pmt_issue,
                external_source=_JIRA,
                external_id=cid,
            ).first()

            if existing:
                existing.comment_html = comment_html
                existing.updated_by = comment_author
                existing.save(
                    update_fields=["comment_html", "comment_stripped", "updated_by", "updated_at"],
                    disable_auto_set_user=True,
                )
                if comment_updated:
                    IssueComment.objects.filter(pk=existing.pk).update(updated_at=comment_updated)
            else:
                c = IssueComment(
                    workspace=workspace,
                    project=project,
                    issue=pmt_issue,
                    comment_html=comment_html,
                    actor=comment_author,
                    external_source=_JIRA,
                    external_id=cid,
                    created_by=comment_author,
                    updated_by=comment_author,
                )
                c.save(disable_auto_set_user=True)
                ts: dict = {}
                if comment_created:
                    ts["created_at"] = comment_created
                if comment_updated:
                    ts["updated_at"] = comment_updated
                if ts:
                    IssueComment.objects.filter(pk=c.pk).update(**ts)


# --------------------------------------------------------------------------- #
# Junction table helpers
# --------------------------------------------------------------------------- #

def _upsert_assignees(
    issue: Issue,
    fields: dict,
    user_map: dict[str, User],
    project: Project,
    workspace: Workspace,
    actor: User,
) -> None:
    assignee_field = fields.get("assignee")
    if not assignee_field:
        return
    user = _user(assignee_field, user_map)
    if not user:
        return
    IssueAssignee.objects.get_or_create(
        issue=issue,
        assignee=user,
        defaults={
            "workspace": workspace,
            "project": project,
            "created_by": actor,
            "updated_by": actor,
        },
    )


def _upsert_labels(
    issue: Issue,
    fields: dict,
    label_map: dict[str, Label],
    project: Project,
    workspace: Workspace,
    actor: User,
) -> None:
    names: list[str] = list(fields.get("labels", []))
    issue_type_name = (fields.get("issuetype") or {}).get("name")
    if issue_type_name and issue_type_name in label_map:
        names.append(issue_type_name)

    for name in names:
        label = label_map.get(name)
        if not label:
            continue
        IssueLabel.objects.get_or_create(
            issue=issue,
            label=label,
            defaults={
                "workspace": workspace,
                "project": project,
                "created_by": actor,
                "updated_by": actor,
            },
        )


def _upsert_module_issue(
    module: Module,
    issue: Issue,
    project: Project,
    workspace: Workspace,
    actor: User,
) -> None:
    ModuleIssue.objects.get_or_create(
        module=module,
        issue=issue,
        defaults={
            "workspace": workspace,
            "project": project,
            "created_by": actor,
            "updated_by": actor,
        },
    )


def _upsert_cycle_issue(
    cycle: Cycle,
    issue: Issue,
    project: Project,
    workspace: Workspace,
    actor: User,
) -> None:
    CycleIssue.objects.get_or_create(
        cycle=cycle,
        issue=issue,
        defaults={
            "workspace": workspace,
            "project": project,
            "created_by": actor,
            "updated_by": actor,
        },
    )
