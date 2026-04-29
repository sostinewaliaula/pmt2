/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "react-router";
import useSWR from "swr";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
// hooks
import { useDashboard } from "@/hooks/store/use-dashboard";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";

type Props = {
  widget: any;
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export const DashboardWidgetRenderer = observer(function DashboardWidgetRenderer({ widget }: Props) {
  const { workspaceSlug, dashboardId } = useParams();
  const { widgetStats, fetchWidgetStats } = useDashboard();

  const { isLoading } = useSWR(
    workspaceSlug && dashboardId && widget.id ? `WIDGET_STATS_${widget.id}` : null,
    workspaceSlug && dashboardId && widget.id
      ? () => fetchWidgetStats(workspaceSlug.toString(), dashboardId.toString(), widget.id)
      : null
  );

  const stats = widgetStats[workspaceSlug?.toString()]?.[dashboardId?.toString()]?.[widget.id];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  const widgetKey = widget.widget_detail?.key || widget.key;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-subtle bg-surface-1 px-4 py-2">
        <h4 className="text-xs tracking-wider font-semibold text-secondary uppercase">
          {widget.widget_detail?.name || widget.key}
        </h4>
      </div>
      <div className="flex-grow p-4">
        {!stats ? (
          <div className="text-xs flex h-full items-center justify-center text-tertiary">No data available</div>
        ) : (
          <div className="h-full w-full">
            {widgetKey === "overview_stats" && (
              <div className="grid h-full grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center rounded-lg bg-surface-1 p-3">
                  <span className="text-2xl font-bold text-primary">{stats.assigned_issues_count || 0}</span>
                  <span className="text-[10px] text-tertiary uppercase">Assigned</span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-surface-1 p-3">
                  <span className="text-2xl font-bold text-primary">{stats.pending_issues_count || 0}</span>
                  <span className="text-[10px] text-tertiary uppercase">Pending</span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-surface-1 p-3">
                  <span className="text-2xl font-bold text-primary">{stats.completed_issues_count || 0}</span>
                  <span className="text-[10px] text-tertiary uppercase">Completed</span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-surface-1 p-3">
                  <span className="text-2xl font-bold text-primary">{stats.created_issues_count || 0}</span>
                  <span className="text-[10px] text-tertiary uppercase">Created</span>
                </div>
              </div>
            )}

            {widgetKey === "issues_by_state_groups" && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats}>
                  <XAxis dataKey="state_group" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface-2)",
                      border: "1px solid var(--color-border-subtle)",
                    }}
                    itemStyle={{ color: "var(--color-text-primary)" }}
                  />
                  <Bar dataKey="count" fill="var(--color-accent-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {widgetKey === "issues_by_priority" && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="priority"
                  >
                    {stats.map((entry: any, index: number) => (
                      <Cell
                        key={entry.priority ?? entry.state_group ?? entry.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Fallback for other keys */}
            {widgetKey !== "overview_stats" &&
              widgetKey !== "issues_by_state_groups" &&
              widgetKey !== "issues_by_priority" && (
                <div className="text-xs flex h-full items-center justify-center text-tertiary">
                  Renderer for {widgetKey} not implemented.
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
});
