/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TIssueLite, TUserLite } from "./issue";

export type TWorklog = {
  id: string;
  created_at: string;
  updated_at: string;
  duration: number;
  date: string;
  description: string;
  issue: string;
  user: string;
  workspace: string;
  project: string;
  user_detail: TUserLite;
  issue_detail: TIssueLite;
};

export type TWorklogCreate = {
  duration: number;
  date: string;
  description: string;
};
