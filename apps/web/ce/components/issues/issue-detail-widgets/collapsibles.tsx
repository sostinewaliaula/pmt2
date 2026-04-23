/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Clock, ChevronRight } from "lucide-react";
import { Disclosure } from "@headlessui/react";
// plane types
import type { TIssueServiceType, TWorkItemWidgets } from "@plane/types";
// components
import { IssueWorklogList } from "@/components/worklog";
// hooks
import { useProject } from "@/hooks/store/use-project";

export type TWorkItemAdditionalWidgetCollapsiblesProps = {
  disabled: boolean;
  hideWidgets: TWorkItemWidgets[];
  issueServiceType: TIssueServiceType;
  projectId: string;
  workItemId: string;
  workspaceSlug: string;
};

export const WorkItemAdditionalWidgetCollapsibles = observer(function WorkItemAdditionalWidgetCollapsibles(props: TWorkItemAdditionalWidgetCollapsiblesProps) {
  const { workspaceSlug, projectId, workItemId, hideWidgets } = props;
  const { getProjectById } = useProject();

  const project = getProjectById(projectId);
  
  if (hideWidgets?.includes("worklogs" as any) || !project?.is_time_tracking_enabled) return null;

  return (
    <div className="border-t border-subtle">
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex w-full items-center justify-between py-3 px-1 text-left text-sm font-medium text-secondary hover:bg-surface-2 rounded-md transition-colors outline-none">
              <div className="flex items-center gap-2">
                <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
                <Clock className="h-4 w-4 text-tertiary" />
                <span>Worklogs</span>
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="px-4 pb-4">
              <IssueWorklogList
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                issueId={workItemId}
              />
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </div>
  );
});
