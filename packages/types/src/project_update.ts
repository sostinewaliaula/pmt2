/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TUserLite } from "./issue";

export type TProjectUpdate = {
  id: string;
  created_at: string;
  updated_at: string;
  user: string;
  user_detail: TUserLite;
  content: string;
  status: "on-track" | "at-risk" | "off-track" | "completed";
  project: string;
  workspace: string;
};
