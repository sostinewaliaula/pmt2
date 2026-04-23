/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import React from "react";
// components
import { ProjectAuthWrapper } from "@/components/auth-screens";

type Props = {
  children: React.ReactNode;
};

const ProjectUpdateLayout: React.FC<Props> = ({ children }) => (
  <ProjectAuthWrapper>
    <div className="flex h-full w-full overflow-hidden">{children}</div>
  </ProjectAuthWrapper>
);

export default ProjectUpdateLayout;
