/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "react-router";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { cn } from "@plane/utils";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { JiraImportGuide } from "@/components/importers/jira/guide";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { ImportsWorkspaceSettingsHeader } from "./header";

function ImportsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();

  const canImport = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  if (workspaceUserInfo && !canImport) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<ImportsWorkspaceSettingsHeader />} hugging>
      <PageHead title={currentWorkspace?.name ? `${currentWorkspace.name} - Import` : undefined} />
      <div className={cn("flex w-full flex-col gap-y-6", { "opacity-60": !canImport })}>
        <SettingsHeading
          title="Import from Jira"
          description="Migrate your Jira project — issues, sprints, epics, and comments — into this workspace."
        />
        {workspaceSlug && <JiraImportGuide workspaceSlug={workspaceSlug} />}
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(ImportsPage);
