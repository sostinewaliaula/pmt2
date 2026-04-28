/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { observer } from "mobx-react";
// local imports
import { JiraCredentialsForm } from "./credentials-form";
import { JiraImportStatus } from "./import-status";

type Props = {
  workspaceSlug: string;
};

type ActiveImport = {
  importerId: string;
  projectId: string;
};

export const JiraImportGuide = observer(function JiraImportGuide({ workspaceSlug }: Props) {
  const [activeImport, setActiveImport] = useState<ActiveImport | null>(null);

  if (activeImport) {
    return (
      <JiraImportStatus
        workspaceSlug={workspaceSlug}
        projectId={activeImport.projectId}
        importerId={activeImport.importerId}
        onReset={() => setActiveImport(null)}
      />
    );
  }

  return (
    <JiraCredentialsForm
      workspaceSlug={workspaceSlug}
      onImporterCreated={(importerId, projectId) => setActiveImport({ importerId, projectId })}
    />
  );
});
