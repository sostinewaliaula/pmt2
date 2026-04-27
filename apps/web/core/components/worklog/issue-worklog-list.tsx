/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
import { Trash2 } from "lucide-react";
// plane package imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// hooks
import { useWorklog } from "@/hooks/store/use-worklog";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

export const IssueWorklogList = observer(function IssueWorklogList({ workspaceSlug, projectId, issueId }: Props) {
  const { issueWorklogs, fetchIssueWorklogs, deleteWorklog } = useWorklog();

  const { isLoading } = useSWR(
    workspaceSlug && projectId && issueId ? `ISSUE_WORKLOGS_${issueId}` : null,
    workspaceSlug && projectId && issueId ? () => fetchIssueWorklogs(workspaceSlug, projectId, issueId) : null
  );

  const worklogs = issueWorklogs[issueId] || [];

  const handleDelete = async (worklogId: string) => {
    if (!window.confirm("Are you sure you want to delete this worklog?")) return;
    try {
      await deleteWorklog(workspaceSlug, projectId, issueId, worklogId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Worklog deleted successfully.",
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to delete worklog. Please try again.",
      });
    }
  };

  if (isLoading) {
    return <LogoSpinner />;
  }

  return (
    <div className="space-y-4">
      {worklogs.length === 0 ? (
        <div className="text-sm text-tertiary">No time logged yet.</div>
      ) : (
        <div className="divide-y divide-subtle rounded-md border border-subtle bg-surface-2">
          {worklogs.map((worklog) => (
            <div key={worklog.id} className="flex items-center justify-between p-3 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-primary">{worklog.duration}m</span>
                  <span className="text-tertiary">on</span>
                  <span className="text-secondary">{new Date(worklog.date).toLocaleDateString()}</span>
                  <span className="text-tertiary">by</span>
                  <span className="text-secondary">{worklog.user_detail?.display_name || worklog.user_detail?.email}</span>
                </div>
                {worklog.description && <p className="text-tertiary italic">{worklog.description}</p>}
              </div>
              <button
                onClick={() => handleDelete(worklog.id)}
                className="text-tertiary hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
