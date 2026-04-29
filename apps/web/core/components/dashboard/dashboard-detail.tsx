/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import useSWR from "swr";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
// plane package imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// hooks
import { useDashboard } from "@/hooks/store/use-dashboard";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { AddWidgetModal } from "./add-widget-modal";
import { DashboardWidgetRenderer } from "./widget-renderer";

export const DashboardDetail = observer(function DashboardDetail() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug ? String(params.workspaceSlug) : "";
  const dashboardId = params?.dashboardId ? String(params.dashboardId) : "";
  const dashboardStore = useDashboard();
  const dashboardDetails = dashboardStore?.dashboardDetails ?? {};
  const fetchDashboardDetails = dashboardStore?.fetchDashboardDetails;
  const deleteDashboardWidget = dashboardStore?.deleteDashboardWidget;
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);

  const { isLoading, error } = useSWR(
    workspaceSlug && dashboardId ? `DASHBOARD_DETAIL_${dashboardId}` : null,
    workspaceSlug && dashboardId && fetchDashboardDetails
      ? () => fetchDashboardDetails(workspaceSlug, dashboardId)
      : null
  );

  const dashboard = workspaceSlug && dashboardId ? dashboardDetails[workspaceSlug]?.[dashboardId] : undefined;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  if (error) {
    const message =
      (typeof error === "object" && error && "detail" in error && typeof (error as any).detail === "string"
        ? (error as any).detail
        : null) || "Could not load this dashboard. Please refresh the page.";
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <h3 className="text-lg font-medium text-primary">Something went wrong</h3>
        <p className="text-sm max-w-md text-secondary">{message}</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-primary">Dashboard not found</h3>
          <p className="text-sm text-secondary">
            The dashboard you are looking for does not exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
      <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-secondary" />
          <h1 className="text-xl font-semibold">{dashboard.name}</h1>
          {dashboard.is_public && (
            <span className="bg-green-500/10 text-xs text-green-500 ml-2 rounded-full px-2 py-0.5 font-medium">
              Public
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            size="sm"
            prependIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsAddWidgetOpen(true)}
          >
            Add Widget
          </Button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-5">
        <div className="grid auto-rows-[100px] grid-cols-12 gap-6">
          {dashboard.widgets?.map((widget) => (
            <div
              key={widget.id}
              style={{
                gridColumn: `span ${widget.width || 4}`,
                gridRow: `span ${widget.height || 3}`,
              }}
              className="group shadow-sm hover:shadow-md relative overflow-hidden rounded-xl border border-subtle bg-surface-2 transition-all"
            >
              <button
                type="button"
                onClick={async () => {
                  if (!deleteDashboardWidget || !workspaceSlug || !dashboardId) return;
                  if (!window.confirm("Remove this widget from the dashboard?")) return;
                  try {
                    await deleteDashboardWidget(workspaceSlug, dashboardId, widget.id);
                    setToast({
                      type: TOAST_TYPE.SUCCESS,
                      title: "Success!",
                      message: "Widget removed.",
                    });
                  } catch {
                    setToast({
                      type: TOAST_TYPE.ERROR,
                      title: "Error!",
                      message: "Failed to remove widget.",
                    });
                  }
                }}
                className="hover:text-red-500 absolute top-2 right-2 z-10 rounded-md bg-surface-1/80 p-1 text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove widget"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <DashboardWidgetRenderer widget={widget} />
            </div>
          ))}

          {(!dashboard.widgets || dashboard.widgets.length === 0) && (
            <div className="col-span-12 flex h-64 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-subtle bg-surface-1">
              <div className="text-center">
                <h3 className="text-base font-medium text-primary">No widgets added yet</h3>
                <p className="text-sm text-secondary text-tertiary">Start building your dashboard by adding widgets.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                prependIcon={<Plus className="h-4 w-4" />}
                onClick={() => setIsAddWidgetOpen(true)}
              >
                Add Your First Widget
              </Button>
            </div>
          )}
        </div>
      </div>

      {workspaceSlug && dashboardId && (
        <AddWidgetModal
          isOpen={isAddWidgetOpen}
          onClose={() => setIsAddWidgetOpen(false)}
          workspaceSlug={workspaceSlug}
          dashboardId={dashboardId}
          existingWidgetIds={(dashboard.widgets ?? [])
            .map((w) => w.widget_detail?.id)
            .filter((id): id is string => Boolean(id))}
        />
      )}
    </div>
  );
});
