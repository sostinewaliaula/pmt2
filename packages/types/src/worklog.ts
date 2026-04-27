/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { IUserLite } from "./users";

export type TWorklogIssueDetail = {
  id: string;
  name: string;
  sequence_id: number;
  project_id: string;
  project_detail?: {
    id: string;
    name: string;
    identifier: string;
  } | null;
};

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
  description: string;
  issue_detail: TWorklogIssueDetail;
};

export type TWorklogCreate = {
  duration: number;
  date: string;
  description: string;
};
