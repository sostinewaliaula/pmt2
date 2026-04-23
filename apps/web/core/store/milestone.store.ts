/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction } from "mobx";
// types
import type { TMilestone, TMilestoneIssue } from "@plane/types";
// services
import { MilestoneService } from "@/services/milestone.service";
// plane web store
import type { CoreRootStore } from "./root.store";

export interface IMilestoneStore {
  // observables
  projectMilestones: { [projectId: string]: TMilestone[] };
  milestoneIssues: { [milestoneId: string]: TMilestoneIssue[] };
  
  // actions
  fetchMilestones: (workspaceSlug: string, projectId: string) => Promise<TMilestone[]>;
  createMilestone: (workspaceSlug: string, projectId: string, data: Partial<TMilestone>) => Promise<TMilestone>;
  updateMilestone: (workspaceSlug: string, projectId: string, milestoneId: string, data: Partial<TMilestone>) => Promise<TMilestone>;
  deleteMilestone: (workspaceSlug: string, projectId: string, milestoneId: string) => Promise<void>;
  fetchMilestoneIssues: (workspaceSlug: string, projectId: string, milestoneId: string) => Promise<TMilestoneIssue[]>;
  addIssueToMilestone: (workspaceSlug: string, projectId: string, milestoneId: string, issueId: string) => Promise<TMilestoneIssue>;
}

export class MilestoneStore implements IMilestoneStore {
  projectMilestones: { [projectId: string]: TMilestone[] } = {};
  milestoneIssues: { [milestoneId: string]: TMilestoneIssue[] } = {};
  
  // services
  milestoneService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      projectMilestones: observable,
      milestoneIssues: observable,
      fetchMilestones: action,
      createMilestone: action,
      updateMilestone: action,
      deleteMilestone: action,
      fetchMilestoneIssues: action,
      addIssueToMilestone: action,
    });

    this.milestoneService = new MilestoneService();
  }

  fetchMilestones = async (workspaceSlug: string, projectId: string) => {
    try {
      const response = await this.milestoneService.getMilestones(workspaceSlug, projectId);
      runInAction(() => {
        this.projectMilestones[projectId] = response;
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  createMilestone = async (workspaceSlug: string, projectId: string, data: Partial<TMilestone>) => {
    try {
      const response = await this.milestoneService.createMilestone(workspaceSlug, projectId, data);
      runInAction(() => {
        if (!this.projectMilestones[projectId]) this.projectMilestones[projectId] = [];
        this.projectMilestones[projectId].push(response);
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  updateMilestone = async (workspaceSlug: string, projectId: string, milestoneId: string, data: Partial<TMilestone>) => {
    try {
      const response = await this.milestoneService.updateMilestone(workspaceSlug, projectId, milestoneId, data);
      runInAction(() => {
        if (this.projectMilestones[projectId]) {
          const index = this.projectMilestones[projectId].findIndex((m) => m.id === milestoneId);
          if (index !== -1) this.projectMilestones[projectId][index] = response;
        }
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  deleteMilestone = async (workspaceSlug: string, projectId: string, milestoneId: string) => {
    try {
      await this.milestoneService.deleteMilestone(workspaceSlug, projectId, milestoneId);
      runInAction(() => {
        if (this.projectMilestones[projectId]) {
          this.projectMilestones[projectId] = this.projectMilestones[projectId].filter((m) => m.id !== milestoneId);
        }
      });
    } catch (error) {
      throw error;
    }
  };

  fetchMilestoneIssues = async (workspaceSlug: string, projectId: string, milestoneId: string) => {
    try {
      const response = await this.milestoneService.getMilestoneIssues(workspaceSlug, projectId, milestoneId);
      runInAction(() => {
        this.milestoneIssues[milestoneId] = response;
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  addIssueToMilestone = async (workspaceSlug: string, projectId: string, milestoneId: string, issueId: string) => {
    try {
      const response = await this.milestoneService.addIssueToMilestone(workspaceSlug, projectId, milestoneId, issueId);
      runInAction(() => {
        if (!this.milestoneIssues[milestoneId]) this.milestoneIssues[milestoneId] = [];
        this.milestoneIssues[milestoneId].push(response);
        // Update total issues count in milestone object
        if (this.projectMilestones[projectId]) {
          const milestone = this.projectMilestones[projectId].find((m) => m.id === milestoneId);
          if (milestone) milestone.total_issues += 1;
        }
      });
      return response;
    } catch (error) {
      throw error;
    }
  };
}
