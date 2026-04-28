/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle, UserPlus, SkipForward, XCircle } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

type ImportSummary = {
  added: string[];
  invited: string[];
  skipped: string[];
  invalid: string[];
  summary: { added: number; invited: number; skipped: number; invalid: number; total_parsed: number };
};

type Props = { workspaceSlug: string };

const apiService = new APIService(API_BASE_URL);

export function CsvUserImport({ workspaceSlug }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    setIsUploading(true);
    try {
      const res = await apiService.post(`/api/workspaces/${workspaceSlug}/members/csv-import/`, form);
      setResult(res.data as ImportSummary);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "CSV processed",
        message: `${res.data.summary.added} added, ${res.data.summary.invited} invited, ${res.data.summary.skipped} skipped.`,
      });
    } catch (err: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Import failed",
        message: err?.error ?? "Could not process the CSV file.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="border-custom-border-200 rounded-lg border p-6">
      <div className="mb-4">
        <h3 className="text-sm text-custom-text-100 font-semibold">Import users from CSV</h3>
        <p className="text-xs text-custom-text-400 mt-1">
          Upload a Jira user export CSV. Users already in PMT are added directly; new users receive an invitation email.
        </p>
      </div>

      {!result ? (
        <div className="flex flex-col gap-y-3">
          <label
            htmlFor="csv-user-file-input"
            className="border-custom-border-200 hover:border-custom-primary-100 flex cursor-pointer flex-col items-center gap-y-2 rounded-md border-2 border-dashed px-6 py-8 transition-colors"
          >
            <Upload className="text-custom-text-400 size-8" />
            <p className="text-sm text-custom-text-200">
              {fileName ? (
                <span className="text-custom-primary-100 font-medium">{fileName}</span>
              ) : (
                "Click to select a CSV file"
              )}
            </p>
            <p className="text-xs text-custom-text-400">Supports Jira user exports (.csv)</p>
          </label>
          <input
            ref={fileInputRef}
            id="csv-user-file-input"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button onClick={handleUpload} loading={isUploading} disabled={!fileName} className="self-start">
            {isUploading ? "Processing…" : "Import users"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<UserPlus className="text-green-500 size-4" />}
              label="Added"
              value={result.summary.added}
            />
            <StatCard
              icon={<CheckCircle className="text-blue-500 size-4" />}
              label="Invited"
              value={result.summary.invited}
            />
            <StatCard
              icon={<SkipForward className="text-custom-text-400 size-4" />}
              label="Already member"
              value={result.summary.skipped}
            />
            <StatCard
              icon={<XCircle className="text-red-500 size-4" />}
              label="Invalid"
              value={result.summary.invalid}
            />
          </div>

          {result.added.length > 0 && (
            <EmailList title="Added to workspace" emails={result.added} color="text-green-600" />
          )}
          {result.invited.length > 0 && (
            <EmailList title="Invitation sent" emails={result.invited} color="text-blue-600" />
          )}
          {result.invalid.length > 0 && (
            <EmailList title="Invalid / failed" emails={result.invalid} color="text-red-500" />
          )}

          <Button variant="neutral-primary" onClick={reset} className="self-start">
            Import another file
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-custom-background-90 flex flex-col items-center gap-y-1 rounded-md py-3">
      <div className="flex items-center gap-x-1">
        {icon}
        <span className="text-xl text-custom-text-100 font-semibold">{value}</span>
      </div>
      <span className="text-xs text-custom-text-400">{label}</span>
    </div>
  );
}

function EmailList({ title, emails, color }: { title: string; emails: string[]; color: string }) {
  return (
    <div>
      <p className={`text-xs mb-1 font-medium ${color}`}>{title}</p>
      <ul className="flex max-h-28 flex-col gap-y-0.5 overflow-y-auto">
        {emails.map((e) => (
          <li key={e} className="text-xs text-custom-text-300 font-mono">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}
