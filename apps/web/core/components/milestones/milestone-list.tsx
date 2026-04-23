/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Target, Calendar, CheckCircle2 } from "lucide-react";
// plane package imports
import { useTranslation } from "@plane/i18n";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";

export const MilestoneList = observer(function MilestoneList() {
  const { workspaceSlug, projectId } = useParams();
  const { t } = useTranslation();
  const { projectMilestones, fetchMilestones } = useMilestone();

  const { isLoading } = useSWR(
    workspaceSlug && projectId ? `PROJECT_MILESTONES_${projectId}` : null,
    () => fetchMilestones(workspaceSlug.toString(), projectId.toString())
  );

  const milestones = projectMilestones[projectId?.toString()] || [];

  if (isLoading) return <LogoSpinner />;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">Milestones</h2>
      </div>

      {milestones.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-subtle py-12">
          <Target className="h-12 w-12 text-tertiary mb-4" />
          <p className="text-secondary">No milestones created yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="group relative rounded-lg border border-subtle bg-surface-2 p-5 hover:border-accent-primary transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-md ${milestone.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-accent-primary/10 text-accent-primary'}`}>
                    <Target className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-primary group-hover:text-accent-primary transition-colors">{milestone.name}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                  milestone.status === 'completed' ? 'border-green-500/20 bg-green-500/5 text-green-500' :
                  milestone.status === 'in-progress' ? 'border-blue-500/20 bg-blue-500/5 text-blue-500' :
                  'border-subtle bg-surface-1 text-secondary'
                }`}>
                  {milestone.status.replace('-', ' ')}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-tertiary">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{milestone.start_date || 'N/A'} - {milestone.target_date || 'N/A'}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-secondary">Progress</span>
                    <span className="text-primary font-medium">
                      {milestone.total_issues > 0 ? Math.round((milestone.completed_issues / milestone.total_issues) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-1 rounded-full overflow-hidden border border-subtle">
                    <div 
                      className="h-full bg-accent-primary transition-all duration-500" 
                      style={{ width: `${milestone.total_issues > 0 ? (milestone.completed_issues / milestone.total_issues) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-tertiary">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {milestone.completed_issues} Completed</span>
                    <span>{milestone.total_issues} Total Issues</span>
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
