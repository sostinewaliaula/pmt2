/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import useSWR from "swr";
import { Clock, Download, Search } from "lucide-react";
// plane package imports
import { Button } from "@plane/propel/button";
// types
import type { TWorklog } from "@plane/types";
// hooks
import { useWorklog } from "@/hooks/store/use-worklog";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";

const csvEscape = (value: unknown): string => {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const formatDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const exportFilteredToCSV = (rows: TWorklog[]) => {
  const header = ["Date", "User", "Project", "Issue", "Duration (minutes)", "Description"];
  const lines = [header.map(csvEscape).join(",")];
  rows.forEach((w) => {
    const issueLabel = w.issue_detail?.project_detail?.identifier
      ? `${w.issue_detail.project_detail.identifier}-${w.issue_detail.sequence_id}: ${w.issue_detail.name ?? ""}`
      : (w.issue_detail?.name ?? "");
    lines.push(
      [
        w.date,
        w.user_detail?.display_name || w.user_detail?.email || "",
        w.issue_detail?.project_detail?.name || "",
        issueLabel,
        w.duration,
        w.description ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `worklogs-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const WorkspaceWorklogView = observer(function WorkspaceWorklogView() {
  const { workspaceSlug } = useParams();
  const { workspaceWorklogs, fetchWorkspaceWorklogs } = useWorklog();

  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (userFilter) p.user_id = userFilter;
    if (projectFilter) p.project_id = projectFilter;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [userFilter, projectFilter, dateFrom, dateTo]);

  const swrKey = workspaceSlug ? `WORKSPACE_WORKLOGS_${workspaceSlug}_${JSON.stringify(params)}` : null;

  const { isLoading } = useSWR(
    swrKey,
    workspaceSlug ? () => fetchWorkspaceWorklogs(workspaceSlug.toString(), params) : null
  );

  const worklogs = workspaceWorklogs[workspaceSlug.toString()];

  const userOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (worklogs ?? []).forEach((w) => {
      if (w.user && !seen.has(w.user)) {
        seen.set(w.user, w.user_detail?.display_name || w.user_detail?.email || "Unknown");
      }
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [worklogs]);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (worklogs ?? []).forEach((w) => {
      const projectId = w.project;
      const projectName = w.issue_detail?.project_detail?.name;
      if (projectId && !seen.has(projectId)) {
        seen.set(projectId, projectName || "Unknown project");
      }
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [worklogs]);

  const filteredWorklogs = (worklogs ?? []).filter((worklog) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      worklog.issue_detail?.name?.toLowerCase().includes(q) ||
      worklog.user_detail?.display_name?.toLowerCase().includes(q) ||
      worklog.description?.toLowerCase().includes(q)
    );
  });

  const totalDuration = filteredWorklogs.reduce((acc, curr) => acc + curr.duration, 0);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
      <div className="flex flex-col gap-3 border-b border-subtle px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-secondary" />
            <h1 className="text-xl font-semibold">Worklogs (Timesheets)</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="focus-within:border-accent-primary relative flex items-center gap-2 rounded-md border border-subtle bg-surface-2 px-3 py-1.5">
              <Search className="h-4 w-4 text-secondary" />
              <input
                type="text"
                placeholder="Search worklogs..."
                className="text-sm bg-transparent outline-none placeholder:text-tertiary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              prependIcon={<Download className="h-4 w-4" />}
              onClick={() => exportFilteredToCSV(filteredWorklogs)}
              disabled={filteredWorklogs.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="text-sm focus:border-accent-primary rounded-md border border-subtle bg-surface-2 px-2 py-1 text-primary outline-none"
          >
            <option value="">All users</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-sm focus:border-accent-primary rounded-md border border-subtle bg-surface-2 px-2 py-1 text-primary outline-none"
          >
            <option value="">All projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <label className="text-xs flex items-center gap-1 text-tertiary">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm focus:border-accent-primary rounded-md border border-subtle bg-surface-2 px-2 py-1 text-primary outline-none"
            />
          </label>
          <label className="text-xs flex items-center gap-1 text-tertiary">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm focus:border-accent-primary rounded-md border border-subtle bg-surface-2 px-2 py-1 text-primary outline-none"
            />
          </label>
          {(userFilter || projectFilter || dateFrom || dateTo) && (
            <button
              type="button"
              className="text-xs text-accent-primary underline-offset-2 hover:underline"
              onClick={() => {
                setUserFilter("");
                setProjectFilter("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-subtle bg-surface-2 px-5 py-2">
        <div className="text-sm flex items-center gap-1 font-medium text-secondary">
          <span className="text-tertiary">Total Time:</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
        <div className="bg-subtle h-4 w-[1px]" />
        <div className="text-sm flex items-center gap-1 font-medium text-secondary">
          <span className="text-tertiary">Entries:</span>
          <span>{filteredWorklogs.length}</span>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LogoSpinner />
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-subtle bg-surface-1">
              <tr className="text-xs tracking-wider text-tertiary uppercase">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Issue</th>
                <th className="px-5 py-3 font-semibold">Duration</th>
                <th className="px-5 py-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle bg-surface-2">
              {filteredWorklogs.map((worklog) => (
                <tr key={worklog.id} className="group transition-colors hover:bg-layer-1">
                  <td className="text-sm px-5 py-3 text-secondary">{new Date(worklog.date).toLocaleDateString()}</td>
                  <td className="text-sm px-5 py-3 font-medium text-primary">
                    {worklog.user_detail?.display_name || worklog.user_detail?.email}
                  </td>
                  <td className="text-sm px-5 py-3 text-primary">
                    <div className="flex flex-col">
                      <span className="font-medium transition-colors group-hover:text-accent-primary">
                        {worklog.issue_detail?.name}
                      </span>
                      <span className="text-xs text-tertiary uppercase">
                        {worklog.issue_detail?.project_detail?.identifier}-{worklog.issue_detail?.sequence_id}
                      </span>
                    </div>
                  </td>
                  <td className="text-sm px-5 py-3 font-medium text-secondary">{formatDuration(worklog.duration)}</td>
                  <td className="text-sm max-w-[200px] truncate px-5 py-3 text-tertiary">
                    {worklog.description || "-"}
                  </td>
                </tr>
              ))}
              {filteredWorklogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-secondary">
                    No worklogs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});
