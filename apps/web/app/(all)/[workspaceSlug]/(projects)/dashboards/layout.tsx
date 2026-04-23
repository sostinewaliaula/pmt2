/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ReactNode } from "react";

export default function DashboardsLayout({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full flex-col overflow-hidden">{children}</div>;
}
