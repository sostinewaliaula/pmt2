/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction } from "mobx";
// types
import type { TWorklog, TWorklogCreate } from "@plane/types";
// services
import { WorklogService } from "@/services/worklog.service";
// plane web store
import type { CoreRootStore } from "./root.store";

export interface IWorklogStore {
  // observables
  issueWorklogs: { [issueId: string]: TWorklog[] };
  workspaceWorklogs: { [workspaceSlug: string]: TWorklog[] };
  
  // actions
  createWorklog: (workspaceSlug: string, projectId: string, issueId: string, data: TWorklogCreate) => Promise<TWorklog>;
  fetchIssueWorklogs: (workspaceSlug: string, projectId: string, issueId: string) => Promise<TWorklog[]>;
  deleteWorklog: (workspaceSlug: string, projectId: string, issueId: string, worklogId: string) => Promise<void>;
  fetchWorkspaceWorklogs: (workspaceSlug: string, params?: any) => Promise<TWorklog[]>;
}

export class WorklogStore implements IWorklogStore {
  issueWorklogs: { [issueId: string]: TWorklog[] } = {};
  workspaceWorklogs: { [workspaceSlug: string]: TWorklog[] } = {};
  
  // services
  worklogService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      issueWorklogs: observable,
      workspaceWorklogs: observable,
      createWorklog: action,
      fetchIssueWorklogs: action,
      deleteWorklog: action,
      fetchWorkspaceWorklogs: action,
    });

    this.worklogService = new WorklogService();
  }

  createWorklog = async (workspaceSlug: string, projectId: string, issueId: string, data: TWorklogCreate) => {
    try {
      const response = await this.worklogService.createIssueWorklog(workspaceSlug, projectId, issueId, data);
      runInAction(() => {
        if (!this.issueWorklogs[issueId]) this.issueWorklogs[issueId] = [];
        this.issueWorklogs[issueId].unshift(response);
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  fetchIssueWorklogs = async (workspaceSlug: string, projectId: string, issueId: string) => {
    try {
      const response = await this.worklogService.getIssueWorklogs(workspaceSlug, projectId, issueId);
      runInAction(() => {
        this.issueWorklogs[issueId] = response;
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  deleteWorklog = async (workspaceSlug: string, projectId: string, issueId: string, worklogId: string) => {
    try {
      await this.worklogService.deleteIssueWorklog(workspaceSlug, projectId, issueId, worklogId);
      runInAction(() => {
        if (this.issueWorklogs[issueId]) {
          this.issueWorklogs[issueId] = this.issueWorklogs[issueId].filter((w) => w.id !== worklogId);
        }
      });
    } catch (error) {
      throw error;
    }
  };

  fetchWorkspaceWorklogs = async (workspaceSlug: string, params?: any) => {
    try {
      const response = await this.worklogService.getWorkspaceWorklogs(workspaceSlug, params);
      runInAction(() => {
        this.workspaceWorklogs[workspaceSlug] = response;
      });
      return response;
    } catch (error) {
      throw error;
    }
  };
}
