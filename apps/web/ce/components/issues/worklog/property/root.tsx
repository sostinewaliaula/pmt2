/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Clock } from "lucide-react";
import useSWR from "swr";
// components
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { LogTimeModal } from "@/components/worklog/log-time-modal";
// hooks
import { useWorklog } from "@/hooks/store/use-worklog";

type TIssueWorklogProperty = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

export const IssueWorklogProperty = observer(function IssueWorklogProperty({
  workspaceSlug,
  projectId,
  issueId,
  disabled,
}: TIssueWorklogProperty) {
  const [isOpen, setIsOpen] = useState(false);
  const { issueWorklogs, fetchIssueWorklogs } = useWorklog();

  useSWR(
    workspaceSlug && projectId && issueId ? `ISSUE_WORKLOGS_${issueId}` : null,
    () => fetchIssueWorklogs(workspaceSlug, projectId, issueId)
  );

  const worklogs = issueWorklogs[issueId] || [];
  const totalDuration = worklogs.reduce((acc, curr) => acc + curr.duration, 0);

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <>
      <SidebarPropertyListItem
        icon={Clock}
        label="Time Spent"
      >
        <div 
          onClick={() => !disabled && setIsOpen(true)}
          className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors w-full group ${!disabled ? "cursor-pointer hover:bg-surface-2" : ""}`}
        >
          <span className="text-body-xs-regular text-primary">{formatDuration(totalDuration)}</span>
          {!disabled && (
             <span className="text-[10px] text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity">Log Time</span>
          )}
        </div>
      </SidebarPropertyListItem>
      <LogTimeModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
      />
    </>
  );
});
