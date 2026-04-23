/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction } from "mobx";
// types
import type { TProjectUpdate } from "@plane/types";
// services
import { ProjectUpdateService } from "@/services/project_update.service";
// plane web store
import type { CoreRootStore } from "./root.store";

export interface IProjectUpdateStore {
  // observables
  projectUpdates: { [projectId: string]: TProjectUpdate[] };
  
  // actions
  fetchProjectUpdates: (workspaceSlug: string, projectId: string) => Promise<TProjectUpdate[]>;
  createProjectUpdate: (workspaceSlug: string, projectId: string, data: Partial<TProjectUpdate>) => Promise<TProjectUpdate>;
  deleteProjectUpdate: (workspaceSlug: string, projectId: string, updateId: string) => Promise<void>;
}

export class ProjectUpdateStore implements IProjectUpdateStore {
  projectUpdates: { [projectId: string]: TProjectUpdate[] } = {};
  
  // services
  projectUpdateService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      projectUpdates: observable,
      fetchProjectUpdates: action,
      createProjectUpdate: action,
      deleteProjectUpdate: action,
    });

    this.projectUpdateService = new ProjectUpdateService();
  }

  fetchProjectUpdates = async (workspaceSlug: string, projectId: string) => {
    try {
      const response = await this.projectUpdateService.getProjectUpdates(workspaceSlug, projectId);
      runInAction(() => {
        this.projectUpdates[projectId] = response;
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  createProjectUpdate = async (workspaceSlug: string, projectId: string, data: Partial<TProjectUpdate>) => {
    try {
      const response = await this.projectUpdateService.createProjectUpdate(workspaceSlug, projectId, data);
      runInAction(() => {
        if (!this.projectUpdates[projectId]) this.projectUpdates[projectId] = [];
        this.projectUpdates[projectId].unshift(response);
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  deleteProjectUpdate = async (workspaceSlug: string, projectId: string, updateId: string) => {
    try {
      await this.projectUpdateService.deleteProjectUpdate(workspaceSlug, projectId, updateId);
      runInAction(() => {
        if (this.projectUpdates[projectId]) {
          this.projectUpdates[projectId] = this.projectUpdates[projectId].filter((u) => u.id !== updateId);
        }
      });
    } catch (error) {
      throw error;
    }
  };
}
