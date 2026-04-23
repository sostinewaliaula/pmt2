/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import React from "react";
import { useParams } from "next/navigation";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";

type Props = {
  children: React.ReactNode;
};

const ProjectUpdateLayout: React.FC<Props> = ({ children }) => {
  const { workspaceSlug, projectId } = useParams();

  return (
    <ProjectAuthWrapper
      workspaceSlug={workspaceSlug?.toString() ?? ""}
      projectId={projectId?.toString() ?? ""}
    >
      <div className="flex h-full w-full overflow-hidden">{children}</div>
    </ProjectAuthWrapper>
  );
};

export default ProjectUpdateLayout;
