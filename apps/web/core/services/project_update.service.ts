/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TProjectUpdate } from "@plane/types";
import { APIService } from "@/services/api.service";

export class ProjectUpdateService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getProjectUpdates(workspaceSlug: string, projectId: string): Promise<TProjectUpdate[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/project-updates/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createProjectUpdate(workspaceSlug: string, projectId: string, data: Partial<TProjectUpdate>): Promise<TProjectUpdate> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/project-updates/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteProjectUpdate(workspaceSlug: string, projectId: string, updateId: string): Promise<any> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/project-updates/${updateId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
