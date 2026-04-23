/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TIssue } from "./issues";
import { IUserLite } from "./users";

export type TWorklog = {
  id: string;
  created_at: string;
  updated_at: string;
  user: string;
  user_detail: IUserLite;
  issue: string;
  project: string;
  workspace: string;
  duration: number;
  date: string;
  comment: string;
  issue_detail: TIssue;
};
