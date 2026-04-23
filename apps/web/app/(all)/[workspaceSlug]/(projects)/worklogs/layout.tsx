/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import React from "react";
// layouts
import { WorkspaceAuthWrapper } from "@/layouts/auth-layout/workspace-wrapper";

type Props = {
  children: React.ReactNode;
};

const WorkspaceWorklogLayout: React.FC<Props> = ({ children }) => (
  <WorkspaceAuthWrapper>
    <div className="flex h-full w-full overflow-hidden">{children}</div>
  </WorkspaceAuthWrapper>
);

export default WorkspaceWorklogLayout;
