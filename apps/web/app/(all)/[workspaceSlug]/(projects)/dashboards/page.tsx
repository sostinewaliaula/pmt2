/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { DashboardList } from "@/components/dashboard";

function DashboardsPage() {
  return <DashboardList />;
}

export default observer(DashboardsPage);
