/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { MilestoneList } from "@/components/milestones";
import type { Route } from "./+types/page";

function MilestonePage(_props: Route.ComponentProps) {
  return <MilestoneList />;
}

export default observer(MilestonePage);
