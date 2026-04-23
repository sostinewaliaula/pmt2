/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction } from "mobx";
// types
import type { TDashboard, TWidget, TWidgetStatsResponse } from "@plane/types";
// services
import { DashboardService } from "@/services/dashboard.service";
// plane web store
import type { CoreRootStore } from "./root.store";

export interface IDashboardStore {
  // observables
  dashboards: { [workspaceSlug: string]: TDashboard[] };
  dashboardDetails: { [workspaceSlug: string]: Record<string, TDashboard> };
  widgetStats: { [workspaceSlug: string]: Record<string, Record<string, TWidgetStatsResponse>> };

  // actions
  fetchDashboards: (workspaceSlug: string) => Promise<TDashboard[]>;
  createDashboard: (workspaceSlug: string, data: Partial<TDashboard>) => Promise<TDashboard>;
  fetchDashboardDetails: (workspaceSlug: string, dashboardId: string) => Promise<TDashboard>;
  updateDashboard: (workspaceSlug: string, dashboardId: string, data: Partial<TDashboard>) => Promise<TDashboard>;
  deleteDashboard: (workspaceSlug: string, dashboardId: string) => Promise<void>;

  createDashboardWidget: (workspaceSlug: string, dashboardId: string, data: Partial<TWidget>) => Promise<TWidget>;
  updateDashboardWidget: (
    workspaceSlug: string,
    dashboardId: string,
    widgetId: string,
    data: Partial<TWidget>
  ) => Promise<TWidget>;
  deleteDashboardWidget: (workspaceSlug: string, dashboardId: string, widgetId: string) => Promise<void>;

  fetchWidgetStats: (workspaceSlug: string, dashboardId: string, widgetId: string) => Promise<TWidgetStatsResponse>;
}

export class DashboardStore implements IDashboardStore {
  dashboards: { [workspaceSlug: string]: TDashboard[] } = {};
  dashboardDetails: { [workspaceSlug: string]: Record<string, TDashboard> } = {};
  widgetStats: { [workspaceSlug: string]: Record<string, Record<string, TWidgetStatsResponse>> } = {};

  // services
  dashboardService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      dashboards: observable,
      dashboardDetails: observable,
      widgetStats: observable,
      fetchDashboards: action,
      createDashboard: action,
      fetchDashboardDetails: action,
      updateDashboard: action,
      deleteDashboard: action,
      fetchWidgetStats: action,
    });

    this.dashboardService = new DashboardService();
  }

  fetchDashboards = async (workspaceSlug: string) => {
    try {
      const response = await this.dashboardService.getDashboards(workspaceSlug);
      runInAction(() => {
        this.dashboards[workspaceSlug] = response;
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  createDashboard = async (workspaceSlug: string, data: Partial<TDashboard>) => {
    try {
      const response = await this.dashboardService.createDashboard(workspaceSlug, data);
      runInAction(() => {
        if (!this.dashboards[workspaceSlug]) this.dashboards[workspaceSlug] = [];
        this.dashboards[workspaceSlug].push(response);
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  fetchDashboardDetails = async (workspaceSlug: string, dashboardId: string) => {
    try {
      const response = await this.dashboardService.getDashboardDetails(workspaceSlug, dashboardId);
      runInAction(() => {
        if (!this.dashboardDetails[workspaceSlug]) this.dashboardDetails[workspaceSlug] = {};
        this.dashboardDetails[workspaceSlug][dashboardId] = response;
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  updateDashboard = async (workspaceSlug: string, dashboardId: string, data: Partial<TDashboard>) => {
    try {
      const response = await this.dashboardService.updateDashboard(workspaceSlug, dashboardId, data);
      runInAction(() => {
        if (this.dashboardDetails[workspaceSlug]?.[dashboardId]) {
          this.dashboardDetails[workspaceSlug][dashboardId] = response;
        }
        if (this.dashboards[workspaceSlug]) {
          const index = this.dashboards[workspaceSlug].findIndex((d) => d.id === dashboardId);
          if (index !== -1) this.dashboards[workspaceSlug][index] = response;
        }
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  deleteDashboard = async (workspaceSlug: string, dashboardId: string) => {
    try {
      await this.dashboardService.deleteDashboard(workspaceSlug, dashboardId);
      runInAction(() => {
        if (this.dashboards[workspaceSlug]) {
          this.dashboards[workspaceSlug] = this.dashboards[workspaceSlug].filter((d) => d.id !== dashboardId);
        }
        if (this.dashboardDetails[workspaceSlug]?.[dashboardId]) {
          delete this.dashboardDetails[workspaceSlug][dashboardId];
        }
      });
    } catch (error) {
      throw error;
    }
  };

  createDashboardWidget = async (workspaceSlug: string, dashboardId: string, data: Partial<TWidget>) => {
    try {
      const response = await this.dashboardService.createDashboardWidget(workspaceSlug, dashboardId, data);
      runInAction(() => {
        if (this.dashboardDetails[workspaceSlug]?.[dashboardId]) {
          this.dashboardDetails[workspaceSlug][dashboardId].widgets.push(response);
        }
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  updateDashboardWidget = async (
    workspaceSlug: string,
    dashboardId: string,
    widgetId: string,
    data: Partial<TWidget>
  ) => {
    try {
      const response = await this.dashboardService.updateDashboardWidget(workspaceSlug, dashboardId, widgetId, data);
      runInAction(() => {
        if (this.dashboardDetails[workspaceSlug]?.[dashboardId]) {
          const index = this.dashboardDetails[workspaceSlug][dashboardId].widgets.findIndex((w) => w.id === widgetId);
          if (index !== -1) this.dashboardDetails[workspaceSlug][dashboardId].widgets[index] = response;
        }
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  deleteDashboardWidget = async (workspaceSlug: string, dashboardId: string, widgetId: string) => {
    try {
      await this.dashboardService.deleteDashboardWidget(workspaceSlug, dashboardId, widgetId);
      runInAction(() => {
        if (this.dashboardDetails[workspaceSlug]?.[dashboardId]) {
          this.dashboardDetails[workspaceSlug][dashboardId].widgets = this.dashboardDetails[workspaceSlug][
            dashboardId
          ].widgets.filter((w) => w.id !== widgetId);
        }
      });
    } catch (error) {
      throw error;
    }
  };

  fetchWidgetStats = async (workspaceSlug: string, dashboardId: string, widgetId: string) => {
    try {
      const response = await this.dashboardService.getWidgetStats(workspaceSlug, dashboardId, widgetId);
      runInAction(() => {
        if (!this.widgetStats[workspaceSlug]) this.widgetStats[workspaceSlug] = {};
        if (!this.widgetStats[workspaceSlug][dashboardId]) this.widgetStats[workspaceSlug][dashboardId] = {};
        this.widgetStats[workspaceSlug][dashboardId][widgetId] = response;
      });
      return response;
    } catch (error) {
      throw error;
    }
  };
}
