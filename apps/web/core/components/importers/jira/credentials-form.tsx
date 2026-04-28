/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ToggleSwitch } from "@plane/ui";
// services
import { JiraImporterService } from "@/services/importers/jira.service";
// hooks
import { useProject } from "@/hooks/store/use-project";

type FormValues = {
  cloud_hostname: string;
  email: string;
  api_token: string;
  project_key: string;
  epics_to_modules: boolean;
  target_project_id: string;
};

type Props = {
  workspaceSlug: string;
  onImporterCreated: (importerId: string, projectId: string) => void;
};

const jiraService = new JiraImporterService();

export const JiraCredentialsForm = observer(function JiraCredentialsForm({ workspaceSlug, onImporterCreated }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [jiraProjects, setJiraProjects] = useState<Array<{ key: string; name: string }> | null>(null);
  const { workspaceProjectIds, projectMap } = useProject();

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { epics_to_modules: true },
  });

  const pmt_projects = workspaceProjectIds?.map((id) => projectMap[id]).filter(Boolean) ?? [];

  const handleLoadJiraProjects = async () => {
    const { cloud_hostname, email, api_token } = getValues();
    if (!cloud_hostname || !email || !api_token) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Missing credentials",
        message: "Fill in the hostname, email, and API token first.",
      });
      return;
    }
    setIsFetchingProjects(true);
    try {
      const projects = await jiraService.listJiraProjects(workspaceSlug, { cloud_hostname, email, api_token });
      setJiraProjects(projects);
      if (projects.length === 0) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "No projects found",
          message: "No accessible Jira projects found for these credentials.",
        });
      }
    } catch (err: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Connection failed",
        message: err?.error ?? "Could not connect to Jira. Check your credentials.",
      });
    } finally {
      setIsFetchingProjects(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const importer = await jiraService.createImporter(workspaceSlug, values.target_project_id, {
        metadata: {
          cloud_hostname: values.cloud_hostname,
          email: values.email,
          api_token: values.api_token,
          project_key: values.project_key,
        },
        config: { epics_to_modules: values.epics_to_modules },
        data: { users: [], invite_users: false, total_issues: 0, total_labels: 0, total_states: 0, total_modules: 0 },
        project_id: values.target_project_id,
      });
      onImporterCreated(importer.id, values.target_project_id);
    } catch (err: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Connection failed",
        message: err?.error ?? "Could not connect to Jira. Check your credentials and project key.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-y-4">
      <div className="flex flex-col gap-y-1">
        <label htmlFor="jira-hostname" className="text-sm text-custom-text-200 font-medium">
          Jira cloud hostname
        </label>
        <Input
          id="jira-hostname"
          {...register("cloud_hostname", { required: "Required" })}
          placeholder="your-org.atlassian.net"
          className="w-full"
        />
        {errors.cloud_hostname && <p className="text-xs text-red-500">{errors.cloud_hostname.message}</p>}
      </div>

      <div className="flex flex-col gap-y-1">
        <label htmlFor="jira-email" className="text-sm text-custom-text-200 font-medium">
          Jira account email
        </label>
        <Input
          id="jira-email"
          {...register("email", { required: "Required" })}
          type="email"
          placeholder="you@company.com"
          className="w-full"
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-y-1">
        <label htmlFor="jira-api-token" className="text-sm text-custom-text-200 font-medium">
          Jira API token
        </label>
        <Input
          id="jira-api-token"
          {...register("api_token", { required: "Required" })}
          type="password"
          placeholder="••••••••••••••••"
          className="w-full"
        />
        <p className="text-xs text-custom-text-400">
          Generate one at <span className="text-custom-primary-100">id.atlassian.com → Security → API tokens</span>
        </p>
        {errors.api_token && <p className="text-xs text-red-500">{errors.api_token.message}</p>}
      </div>

      {/* Jira project picker */}
      <div className="flex flex-col gap-y-1">
        <label htmlFor="jira-project-key" className="text-sm text-custom-text-200 font-medium">
          Jira project
        </label>
        {jiraProjects === null ? (
          <Button
            type="button"
            variant="neutral-primary"
            onClick={handleLoadJiraProjects}
            loading={isFetchingProjects}
            className="self-start"
          >
            {isFetchingProjects ? "Loading projects…" : "Load Jira projects"}
          </Button>
        ) : (
          <div className="flex flex-col gap-y-1">
            <select
              id="jira-project-key"
              {...register("project_key", { required: "Required" })}
              className="border-custom-border-200 bg-custom-background-100 text-sm text-custom-text-100 rounded-md border px-3 py-2"
            >
              <option value="">Select a Jira project…</option>
              {jiraProjects.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setJiraProjects(null)}
              className="text-xs text-custom-primary-100 self-start"
            >
              Use different credentials
            </button>
          </div>
        )}
        {errors.project_key && <p className="text-xs text-red-500">{errors.project_key.message}</p>}
      </div>

      <div className="flex flex-col gap-y-1">
        <label htmlFor="jira-target-project" className="text-sm text-custom-text-200 font-medium">
          Import into project
        </label>
        <select
          id="jira-target-project"
          {...register("target_project_id", { required: "Required" })}
          className="border-custom-border-200 bg-custom-background-100 text-sm text-custom-text-100 rounded-md border px-3 py-2"
        >
          <option value="">Select a project…</option>
          {pmt_projects.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.target_project_id && <p className="text-xs text-red-500">{errors.target_project_id.message}</p>}
      </div>

      <div className="border-custom-border-200 flex items-center justify-between rounded-md border px-4 py-3">
        <div>
          <p className="text-sm text-custom-text-100 font-medium">Map Jira epics to modules</p>
          <p className="text-xs text-custom-text-400">Epics become PMT modules; their child issues are linked.</p>
        </div>
        <Controller
          control={control}
          name="epics_to_modules"
          render={({ field: { value, onChange } }) => <ToggleSwitch value={value} onChange={onChange} size="sm" />}
        />
      </div>

      <Button type="submit" loading={isSubmitting} className="self-start" disabled={jiraProjects === null}>
        {isSubmitting ? "Connecting…" : "Connect & fetch"}
      </Button>
    </form>
  );
});
