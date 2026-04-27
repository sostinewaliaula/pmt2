/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { MessageSquare, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
// hooks
import { useProjectUpdate } from "@/hooks/store/use-project-update";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";

const STATUS_ICONS = {
  "on-track": <CheckCircle2 className="h-4 w-4 text-green-500" />,
  "at-risk": <AlertTriangle className="h-4 w-4 text-orange-500" />,
  "off-track": <AlertCircle className="h-4 w-4 text-red-500" />,
  "completed": <CheckCircle2 className="h-4 w-4 text-blue-500" />,
};

export const ProjectUpdateList = observer(function ProjectUpdateList() {
  const { workspaceSlug, projectId } = useParams();
  const { projectUpdates, fetchProjectUpdates } = useProjectUpdate();

  const { isLoading } = useSWR(
    workspaceSlug && projectId ? `PROJECT_UPDATES_${projectId}` : null,
    () => fetchProjectUpdates(workspaceSlug.toString(), projectId.toString())
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
          <MessageSquare className="h-12 w-12 text-tertiary mb-4" />
          <p className="text-secondary">No updates posted yet.</p>
        </div>
      ) : (
        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-subtle before:via-subtle before:to-transparent">
          {updates.map((update) => (
            <div key={update.id} className="relative flex items-start gap-6 group">
              <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-surface-1 border-4 border-surface-2 shadow-sm z-10 transition-transform group-hover:scale-110">
                <ButtonAvatars userIds={update.user} size="sm" />
              </div>
              
              <div className="flex-grow ml-12">
                <div className="flex flex-col rounded-lg border border-subtle bg-surface-2 p-5 shadow-sm hover:shadow-md transition-all group-hover:border-accent-primary">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary">{update.user_detail?.display_name || update.user_detail?.email}</span>
                      <span className="text-tertiary text-xs">•</span>
                      <span className="text-xs text-tertiary">{new Date(update.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border capitalize ${
                      update.status === 'on-track' ? 'border-green-500/20 text-green-500' :
                      update.status === 'at-risk' ? 'border-orange-500/20 text-orange-500' :
                      update.status === 'off-track' ? 'border-red-500/20 text-red-500' :
                      'border-blue-500/20 text-blue-500'
                    }`}>
                      {STATUS_ICONS[update.status]}
                      {update.status.replace('-', ' ')}
                    </div>
                  </div>
                  <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                    {update.content}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
