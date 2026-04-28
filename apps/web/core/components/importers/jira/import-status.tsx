/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Loader, XCircle } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// services
import { JiraImporterService } from "@/services/importers/jira.service";

type ImportStatus = "queued" | "processing" | "fetched" | "loading" | "completed" | "failed";

type Summary = {
  issues: number;
  sprints: number;
  epics: number;
  users: Array<{ emailAddress: string; displayName: string; accountId: string }>;
};

type Props = {
  workspaceSlug: string;
  projectId: string;
  importerId: string;
  onReset: () => void;
};

type ImporterResponse = {
  status: ImportStatus;
  summary?: Summary;
  error_message?: string | null;
};

const POLL_INTERVAL = 4000; // ms

const jiraService = new JiraImporterService();

const STATUS_LABEL: Record<ImportStatus, string> = {
  queued: "Queued — waiting for a worker…",
  processing: "Fetching data from Jira…",
  fetched: "Fetch complete — ready to import",
  loading: "Importing into your project…",
  completed: "Import complete!",
  failed: "Import failed",
};

export function JiraImportStatus({ workspaceSlug, projectId, importerId, onReset }: Props) {
  const [status, setStatus] = useState<ImportStatus>("queued");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStartingLoad, setIsStartingLoad] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const data: ImporterResponse = await jiraService.getImporter(workspaceSlug, projectId, importerId);
      setStatus(data.status as ImportStatus);
      if (data.summary) setSummary(data.summary as Summary);
      if (data.error_message) setErrorMessage(data.error_message);

      if (data.status !== "completed" && data.status !== "failed") {
        timerRef.current = setTimeout(poll, POLL_INTERVAL);
      }
    } catch {
      // swallow transient poll errors — will retry
      timerRef.current = setTimeout(poll, POLL_INTERVAL);
    }
  }, [workspaceSlug, projectId, importerId]);

  useEffect(() => {
    poll();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll]);

  const handleLoad = async () => {
    setIsStartingLoad(true);
    try {
      await jiraService.triggerLoad(workspaceSlug, projectId, importerId);
      setStatus("loading");
      timerRef.current = setTimeout(poll, POLL_INTERVAL);
    } catch (err: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not start import",
        message: err?.error ?? "Something went wrong.",
      });
    } finally {
      setIsStartingLoad(false);
    }
  };

  return (
    <div className="flex max-w-lg flex-col gap-y-6">
      {/* Status indicator */}
      <div className="border-custom-border-200 flex items-center gap-x-3 rounded-md border px-4 py-3">
        {status === "completed" ? (
          <CheckCircle className="text-green-500 size-5 shrink-0" />
        ) : status === "failed" ? (
          <XCircle className="text-red-500 size-5 shrink-0" />
        ) : (
          <Loader className="text-custom-primary-100 size-5 shrink-0 animate-spin" />
        )}
        <span className="text-sm text-custom-text-100">{STATUS_LABEL[status]}</span>
      </div>

      {/* Dry-run summary (shown after fetch) */}
      {summary && (status === "fetched" || status === "loading" || status === "completed") && (
        <div className="border-custom-border-200 flex flex-col gap-y-3 rounded-md border p-4">
          <p className="text-sm text-custom-text-100 font-medium">What will be imported</p>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Issues" value={summary.issues} />
            <Stat label="Sprints → Cycles" value={summary.sprints} />
            <Stat label="Epics → Modules" value={summary.epics} />
          </div>

          {summary.users.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-custom-text-200 mb-1 font-medium">
                {summary.users.length} Jira user{summary.users.length !== 1 ? "s" : ""} found
              </p>
              <ul className="flex max-h-32 flex-col gap-y-1 overflow-y-auto">
                {summary.users.map((u) => (
                  <li key={u.accountId} className="text-xs text-custom-text-300">
                    {u.displayName}
                    {u.emailAddress ? ` — ${u.emailAddress}` : " (no email — will not be matched)"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error detail */}
      {status === "failed" && errorMessage && (
        <div className="border-red-500/30 bg-red-500/5 rounded-md border px-4 py-3">
          <p className="text-xs text-red-400 mb-1 font-medium">Error detail</p>
          <p className="text-xs text-custom-text-200 font-mono break-all">{errorMessage}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-x-3">
        {status === "fetched" && (
          <Button onClick={handleLoad} loading={isStartingLoad}>
            {isStartingLoad ? "Starting…" : "Start import"}
          </Button>
        )}
        {(status === "completed" || status === "failed") && (
          <Button variant="neutral-primary" onClick={onReset}>
            Import another project
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-custom-background-90 flex flex-col items-center rounded-md py-3">
      <span className="text-xl text-custom-text-100 font-semibold">{value}</span>
      <span className="text-xs text-custom-text-400">{label}</span>
    </div>
  );
}
