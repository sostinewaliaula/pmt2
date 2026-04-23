/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TIssue } from "./issues";

export type TMilestone = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  start_date: string | null;
  target_date: string | null;
  status: "planned" | "in-progress" | "completed" | "on-hold";
  project: string;
  workspace: string;
  total_issues: number;
  completed_issues: number;
};

export type TMilestoneIssue = {
  id: string;
  milestone: string;
  issue: string;
  issue_detail: TIssue;
};
