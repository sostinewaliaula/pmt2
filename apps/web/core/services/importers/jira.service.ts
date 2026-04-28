/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { IJiraImporterForm } from "@plane/types";
import { APIService } from "@/services/api.service";

export class JiraImporterService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  /** Create a new Jira importer and fire the fetch task. */
  async createImporter(workspaceSlug: string, projectId: string, data: IJiraImporterForm): Promise<any> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/importers/jira/`, data)
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  /** Poll importer status + get dry-run summary. */
  async getImporter(workspaceSlug: string, projectId: string, importerId: string): Promise<any> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/importers/jira/${importerId}/`)
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  /** List all Jira importers for a project. */
  async listImporters(workspaceSlug: string, projectId: string): Promise<any[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/importers/jira/`)
      .then((res) => res?.data ?? [])
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  /** Trigger Phase 2 load after dry-run review. */
  async triggerLoad(workspaceSlug: string, projectId: string, importerId: string): Promise<any> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/importers/jira/${importerId}/load/`, {})
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  /** List Jira projects accessible with the given credentials. */
  async listJiraProjects(
    workspaceSlug: string,
    credentials: { cloud_hostname: string; email: string; api_token: string }
  ): Promise<Array<{ key: string; name: string }>> {
    return this.post(`/api/workspaces/${workspaceSlug}/importers/jira/list-projects/`, credentials)
      .then((res) => res?.data ?? [])
      .catch((err) => {
        throw err?.response?.data;
      });
  }
}
