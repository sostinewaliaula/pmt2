# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Jira → Caava PMT data transformations.

Converts Jira-native formats (ADF rich text, status categories, priorities)
to the shapes expected by PMT's Django models.
"""

from __future__ import annotations

import html
from typing import Any

# --------------------------------------------------------------------------- #
# Jira ADF → HTML
# --------------------------------------------------------------------------- #

# ADF mark type → HTML tag pair
_MARK_TAGS: dict[str, tuple[str, str]] = {
    "strong": ("<strong>", "</strong>"),
    "em": ("<em>", "</em>"),
    "code": ("<code>", "</code>"),
    "underline": ("<u>", "</u>"),
    "strike": ("<s>", "</s>"),
    "subscript": ("<sub>", "</sub>"),
    "superscript": ("<sup>", "</sup>"),
}


def _text_node(node: dict) -> str:
    text = html.escape(node.get("text", ""))
    for mark in node.get("marks", []):
        mark_type = mark.get("type", "")
        if mark_type in _MARK_TAGS:
            open_tag, close_tag = _MARK_TAGS[mark_type]
            text = f"{open_tag}{text}{close_tag}"
        elif mark_type == "link":
            href = html.escape(mark.get("attrs", {}).get("href", "#"))
            text = f'<a href="{href}">{text}</a>'
        elif mark_type == "textColor":
            color = html.escape(mark.get("attrs", {}).get("color", ""))
            text = f'<span style="color:{color}">{text}</span>'
    return text


def _inline_children(nodes: list[dict]) -> str:
    parts = []
    for node in nodes:
        t = node.get("type", "")
        if t == "text":
            parts.append(_text_node(node))
        elif t == "hardBreak":
            parts.append("<br/>")
        elif t == "mention":
            name = html.escape(node.get("attrs", {}).get("text", "@mention"))
            parts.append(f"<strong>{name}</strong>")
        elif t == "emoji":
            parts.append(node.get("attrs", {}).get("text", ""))
        elif t == "inlineCard":
            url = html.escape(node.get("attrs", {}).get("url", ""))
            parts.append(f'<a href="{url}">{url}</a>')
        else:
            # Unknown inline — render children if any
            parts.append(_inline_children(node.get("content", [])))
    return "".join(parts)


def _block_node(node: dict) -> str:
    t = node.get("type", "")
    children = node.get("content", [])

    if t == "paragraph":
        inner = _inline_children(children)
        return f"<p>{inner}</p>" if inner else "<p></p>"

    if t in ("heading",):
        level = node.get("attrs", {}).get("level", 1)
        level = max(1, min(6, int(level)))
        inner = _inline_children(children)
        return f"<h{level}>{inner}</h{level}>"

    if t == "bulletList":
        items = "".join(f"<li>{_inline_children(li.get('content', []))}</li>" for li in children)
        # listItem wraps paragraph nodes — flatten one level
        items = "".join(
            f"<li>{_inline_children(_flatten_list_item(li))}</li>" for li in children
        )
        return f"<ul>{items}</ul>"

    if t == "orderedList":
        items = "".join(
            f"<li>{_inline_children(_flatten_list_item(li))}</li>" for li in children
        )
        return f"<ol>{items}</ol>"

    if t == "blockquote":
        inner = "".join(_block_node(c) for c in children)
        return f"<blockquote>{inner}</blockquote>"

    if t == "codeBlock":
        lang = html.escape(node.get("attrs", {}).get("language", "") or "")
        code = html.escape("".join(c.get("text", "") for c in children if c.get("type") == "text"))
        lang_attr = f' class="language-{lang}"' if lang else ""
        return f"<pre><code{lang_attr}>{code}</code></pre>"

    if t == "rule":
        return "<hr/>"

    if t == "mediaSingle":
        # Attachments render as a placeholder — the real asset is uploaded separately
        for child in children:
            if child.get("type") == "media":
                alt = html.escape(child.get("attrs", {}).get("alt", "attachment"))
                return f"<p>[attachment: {alt}]</p>"
        return ""

    if t == "table":
        rows = "".join(_table_row(r) for r in children)
        return f"<table>{rows}</table>"

    if t == "expand":
        title = html.escape(node.get("attrs", {}).get("title", ""))
        inner = "".join(_block_node(c) for c in children)
        return f"<details><summary>{title}</summary>{inner}</details>"

    # Unknown block — try to render children
    return "".join(_block_node(c) for c in children)


def _flatten_list_item(li: dict) -> list[dict]:
    """Pull inline content out of a listItem's paragraph wrapper."""
    result = []
    for child in li.get("content", []):
        if child.get("type") == "paragraph":
            result.extend(child.get("content", []))
        else:
            result.append(child)
    return result


def _table_row(row: dict) -> str:
    cells = []
    for cell in row.get("content", []):
        tag = "th" if cell.get("type") == "tableHeader" else "td"
        inner = "".join(_block_node(c) for c in cell.get("content", []))
        cells.append(f"<{tag}>{inner}</{tag}>")
    return f"<tr>{''.join(cells)}</tr>"


def adf_to_html(adf: Any) -> str:
    """Convert an Atlassian Document Format dict to HTML string."""
    if not adf:
        return "<p></p>"
    if isinstance(adf, str):
        # Already plain text or HTML — wrap it
        return f"<p>{html.escape(adf)}</p>"
    if not isinstance(adf, dict):
        return "<p></p>"

    content = adf.get("content", [])
    if not content:
        return "<p></p>"

    return "".join(_block_node(node) for node in content) or "<p></p>"


# --------------------------------------------------------------------------- #
# Status category → State group
# --------------------------------------------------------------------------- #

# Jira statusCategory.key values → PMT StateGroup values
_STATUS_CATEGORY_MAP = {
    "new": "backlog",
    "undefined": "backlog",
    "indeterminate": "started",
    "done": "completed",
}


def status_category_to_state_group(category_key: str) -> str:
    return _STATUS_CATEGORY_MAP.get(category_key, "unstarted")


# --------------------------------------------------------------------------- #
# Priority mapping
# --------------------------------------------------------------------------- #

_PRIORITY_MAP = {
    "blocker": "urgent",
    "highest": "urgent",
    "high": "high",
    "medium": "medium",
    "low": "low",
    "lowest": "low",
}


def jira_priority_to_pmt(priority_name: str | None) -> str:
    if not priority_name:
        return "none"
    return _PRIORITY_MAP.get(priority_name.lower(), "none")


# --------------------------------------------------------------------------- #
# Sprint state → Cycle status (informational only — Cycle has no status field)
# --------------------------------------------------------------------------- #

def sprint_dates(sprint: dict) -> tuple[str | None, str | None]:
    """Return (start_date, end_date) ISO strings or None."""
    start = sprint.get("startDate") or sprint.get("start_date")
    end = sprint.get("endDate") or sprint.get("end_date") or sprint.get("completeDate")
    return start, end
