/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { LayoutGrid, Plus, Search } from "lucide-react";
// plane package imports
import { Button } from "@plane/propel/button";
import { useTranslation } from "@plane/i18n";
// hooks
import { useDashboard } from "@/hooks/store/use-dashboard";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { CreateDashboardModal } from "./create-dashboard-modal";

export const DashboardList = observer(function DashboardList() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug ? String(params.workspaceSlug) : "";
  const { t } = useTranslation();
  const dashboardStore = useDashboard();
  const dashboards = dashboardStore?.dashboards ?? {};
  const fetchDashboards = dashboardStore?.fetchDashboards;

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { isLoading, error } = useSWR(
    workspaceSlug ? `DASHBOARDS_LIST_${workspaceSlug}` : null,
    workspaceSlug && fetchDashboards ? () => fetchDashboards(workspaceSlug) : null
  );

  const rawList = workspaceSlug ? dashboards[workspaceSlug] : undefined;
  const list = Array.isArray(rawList) ? rawList : [];
  const filteredDashboards = list.filter((dashboard) =>
    dashboard?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v && v !== key ? v : fallback;
  };

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
        : null) || "Could not load dashboards. Please refresh the page.";
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <h3 className="text-lg font-medium text-primary">Something went wrong</h3>
        <p className="max-w-md text-sm text-secondary">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
      <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-secondary" />
          <h1 className="text-xl font-semibold">{tr("dashboards.title", "Dashboards")}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center gap-2 rounded-md border border-subtle bg-surface-2 px-3 py-1.5 focus-within:border-accent-primary">
            <Search className="h-4 w-4 text-secondary" />
            <input
              type="text"
              placeholder={tr("dashboards.search_placeholder", "Search dashboards...")}
              className="bg-transparent text-sm outline-none placeholder:text-tertiary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            prependIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            {tr("dashboards.create_button", "Create dashboard")}
          </Button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDashboards?.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={`/${workspaceSlug}/dashboards/${dashboard.id}`}
              className="group flex flex-col gap-4 rounded-xl border border-subtle bg-surface-2 p-5 transition-all hover:border-accent-primary hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
                  <LayoutGrid className="h-6 w-6" />
                </div>
                {dashboard.is_public && (
                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                    Public
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-base font-medium text-primary group-hover:text-accent-primary">{dashboard.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-secondary">
                  {dashboard.description || "No description provided."}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-2 text-xs text-tertiary">
                <span>Updated {new Date(dashboard.updated_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-subtle bg-surface-1 p-5 transition-all hover:border-accent-primary hover:bg-surface-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-secondary">{tr("dashboards.create_new", "Create new dashboard")}</span>
          </button>
        </div>
      </div>

      {workspaceSlug && (
        <CreateDashboardModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          workspaceSlug={workspaceSlug}
        />
      )}
    </div>
  );
});
