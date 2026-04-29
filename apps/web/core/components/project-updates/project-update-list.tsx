/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "react-router";
import useSWR from "swr";
import { MessageSquare, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
// hooks
import { useProjectUpdate } from "@/hooks/store/use-project-update";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";

const STATUS_ICONS = {
  "on-track": <CheckCircle2 className="text-green-500 h-4 w-4" />,
  "at-risk": <AlertTriangle className="text-orange-500 h-4 w-4" />,
  "off-track": <AlertCircle className="text-red-500 h-4 w-4" />,
  completed: <CheckCircle2 className="text-blue-500 h-4 w-4" />,
};

export const ProjectUpdateList = observer(function ProjectUpdateList() {
  const { workspaceSlug, projectId } = useParams();
  const { projectUpdates, fetchProjectUpdates } = useProjectUpdate();

  const { isLoading } = useSWR(workspaceSlug && projectId ? `PROJECT_UPDATES_${projectId}` : null, () =>
    fetchProjectUpdates(workspaceSlug.toString(), projectId.toString())
  );

  const updates = projectUpdates[projectId?.toString()] || [];

  if (isLoading) return <LogoSpinner />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">Progress Updates</h2>
      </div>

      {updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-subtle py-12">
          <MessageSquare className="mb-4 h-12 w-12 text-tertiary" />
          <p className="text-secondary">No updates posted yet.</p>
        </div>
      ) : (
        <div className="before:from-subtle before:via-subtle relative space-y-8 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:to-transparent">
          {updates.map((update) => (
            <div key={update.id} className="group relative flex items-start gap-6">
              <div className="border-surface-2 shadow-sm absolute left-0 z-10 mt-1 flex h-10 w-10 items-center justify-center rounded-full border-4 bg-surface-1 transition-transform group-hover:scale-110">
                <ButtonAvatars userIds={update.user} size="sm" />
              </div>

              <div className="ml-12 flex-grow">
                <div className="shadow-sm hover:shadow-md group-hover:border-accent-primary flex flex-col rounded-lg border border-subtle bg-surface-2 p-5 transition-all">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary">
                        {update.user_detail?.display_name || update.user_detail?.email}
                      </span>
                      <span className="text-xs text-tertiary">•</span>
                      <span className="text-xs text-tertiary">{new Date(update.created_at).toLocaleDateString()}</span>
                    </div>
                    <div
                      className={`text-xs flex items-center gap-1.5 rounded-full border px-2 py-1 font-medium capitalize ${
                        update.status === "on-track"
                          ? "border-green-500/20 text-green-500"
                          : update.status === "at-risk"
                            ? "border-orange-500/20 text-orange-500"
                            : update.status === "off-track"
                              ? "border-red-500/20 text-red-500"
                              : "border-blue-500/20 text-blue-500"
                      }`}
                    >
                      {STATUS_ICONS[update.status]}
                      {update.status.replace("-", " ")}
                    </div>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-secondary">{update.content}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
