/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Clock, Download, Filter, Search } from "lucide-react";
// plane package imports
import { Button } from "@plane/propel/button";
import { useTranslation } from "@plane/i18n";
// hooks
import { useWorklog } from "@/hooks/store/use-worklog";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { WorklogService } from "@/services/worklog.service";

const worklogService = new WorklogService();

export const WorkspaceWorklogView = observer(function WorkspaceWorklogView() {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { workspaceWorklogs, fetchWorkspaceWorklogs } = useWorklog();

  const [searchQuery, setSearchQuery] = useState("");

  const { isLoading } = useSWR(
    workspaceSlug ? `WORKSPACE_WORKLOGS_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchWorkspaceWorklogs(workspaceSlug.toString()) : null
  );

  const worklogs = workspaceWorklogs[workspaceSlug.toString()] || [];

  const filteredWorklogs = worklogs.filter((worklog) =>
    worklog.issue_detail?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    worklog.user_detail?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    worklog.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDuration = filteredWorklogs.reduce((acc, curr) => acc + curr.duration, 0);

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
      <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-secondary" />
          <h1 className="text-xl font-semibold">Worklogs (Timesheets)</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center gap-2 rounded-md border border-subtle bg-surface-2 px-3 py-1.5 focus-within:border-accent-primary">
            <Search className="h-4 w-4 text-secondary" />
            <input
              type="text"
              placeholder="Search worklogs..."
              className="bg-transparent text-sm outline-none placeholder:text-tertiary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="secondary" size="sm" prependIcon={<Download className="h-4 w-4" />}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-subtle bg-surface-2 px-5 py-2">
        <div className="flex items-center gap-1 text-sm text-secondary font-medium">
          <span className="text-tertiary">Total Time:</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
        <div className="h-4 w-[1px] bg-subtle" />
        <div className="flex items-center gap-1 text-sm text-secondary font-medium">
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
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-1 border-b border-subtle">
              <tr className="text-xs uppercase tracking-wider text-tertiary">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Issue</th>
                <th className="px-5 py-3 font-semibold">Duration</th>
                <th className="px-5 py-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle bg-surface-2">
              {filteredWorklogs.map((worklog) => (
                <tr key={worklog.id} className="hover:bg-layer-1 transition-colors group">
                  <td className="px-5 py-3 text-sm text-secondary">{new Date(worklog.date).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-sm text-primary font-medium">{worklog.user_detail?.display_name || worklog.user_detail?.email}</td>
                  <td className="px-5 py-3 text-sm text-primary">
                    <div className="flex flex-col">
                      <span className="font-medium group-hover:text-accent-primary transition-colors">{worklog.issue_detail?.name}</span>
                      <span className="text-xs text-tertiary uppercase">{worklog.issue_detail?.project_detail?.identifier}-{worklog.issue_detail?.sequence_id}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-secondary font-medium">{formatDuration(worklog.duration)}</td>
                  <td className="px-5 py-3 text-sm text-tertiary truncate max-w-[200px]">{worklog.description || "-"}</td>
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
