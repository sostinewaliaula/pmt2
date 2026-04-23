/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  TDashboard,
  TWidget,
  TWidgetStatsResponse,
  TWidgetStatsRequestParams,
} from "@plane/types";
import { APIService } from "@/services/api.service";

export class DashboardService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getDashboards(workspaceSlug: string): Promise<TDashboard[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/dashboards/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createDashboard(workspaceSlug: string, data: Partial<TDashboard>): Promise<TDashboard> {
    return this.post(`/api/workspaces/${workspaceSlug}/dashboards/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getDashboardDetails(workspaceSlug: string, dashboardId: string): Promise<TDashboard> {
    return this.get(`/api/workspaces/${workspaceSlug}/dashboards/${dashboardId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateDashboard(workspaceSlug: string, dashboardId: string, data: Partial<TDashboard>): Promise<TDashboard> {
    return this.patch(`/api/workspaces/${workspaceSlug}/dashboards/${dashboardId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteDashboard(workspaceSlug: string, dashboardId: string): Promise<any> {
    return this.delete(`/api/workspaces/${workspaceSlug}/dashboards/${dashboardId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createDashboardWidget(workspaceSlug: string, dashboardId: string, data: Partial<TWidget>): Promise<TWidget> {
    return this.post(`/api/workspaces/${workspaceSlug}/dashboards/${dashboardId}/widgets/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateDashboardWidget(
    workspaceSlug: string,
    dashboardId: string,
    widgetId: string,
    data: Partial<TWidget>
  ): Promise<TWidget> {
    return this.patch(`/api/workspaces/${workspaceSlug}/dashboards/${dashboardId}/widgets/${widgetId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteDashboardWidget(workspaceSlug: string, dashboardId: string, widgetId: string): Promise<any> {
    return this.delete(`/api/workspaces/${workspaceSlug}/dashboards/${dashboardId}/widgets/${widgetId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getWidgetStats(
    workspaceSlug: string,
    dashboardId: string,
    widgetId: string
  ): Promise<TWidgetStatsResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/dashboards/${dashboardId}/widgets/${widgetId}/stats/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
