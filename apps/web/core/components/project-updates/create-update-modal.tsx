/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment } from "react";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
import { Dialog, Transition } from "@headlessui/react";
import { X, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
// plane package imports
import { Button } from "@plane/propel/button";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import { TProjectUpdate } from "@plane/types";
// hooks
import { useProjectUpdate } from "@/hooks/store/use-project-update";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
};

const STATUS_OPTIONS: { label: string; value: TProjectUpdate["status"]; icon: any; color: string }[] = [
  { label: "On Track", value: "on-track", icon: CheckCircle2, color: "text-green-500" },
  { label: "At Risk", value: "at-risk", icon: AlertTriangle, color: "text-orange-500" },
  { label: "Off Track", value: "off-track", icon: AlertCircle, color: "text-red-500" },
];

export const CreateProjectUpdateModal = observer(function CreateProjectUpdateModal({ isOpen, onClose, workspaceSlug, projectId }: Props) {
  const { t } = useTranslation();
  const { createProjectUpdate } = useProjectUpdate();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Partial<TProjectUpdate>>({
    defaultValues: {
      status: "on-track",
      content: "",
    },
  });

  const selectedStatus = watch("status");

  const onSubmit = async (data: Partial<TProjectUpdate>) => {
    try {
      await createProjectUpdate(workspaceSlug, projectId, data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Update posted successfully.",
      });
      reset();
      onClose();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to post update. Please try again.",
      });
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-layer-1 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-surface-2 px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 border border-subtle">
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-surface-2 text-secondary hover:text-primary outline-none"
                    onClick={onClose}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-primary">
                      Post Progress Update
                    </Dialog.Title>
                    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
                      <div className="grid grid-cols-3 gap-3">
                        {STATUS_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setValue("status", option.value)}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                              selectedStatus === option.value
                                ? `bg-surface-1 border-accent-primary shadow-sm`
                                : "bg-surface-2 border-subtle hover:border-accent-primary"
                            }`}
                          >
                            <option.icon className={`h-5 w-5 ${option.color}`} />
                            <span className="text-xs font-medium text-secondary">{option.label}</span>
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Content</label>
                        <textarea
                          {...register("content", { required: true })}
                          rows={5}
                          className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none placeholder:text-tertiary"
                          placeholder="Summarize the latest progress, achievements, and blockers..."
                        />
                        {errors.content && <span className="text-xs text-red-500">Content is required.</span>}
                      </div>

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                        <Button type="submit" variant="primary" loading={isSubmitting}>
                          Post Update
                        </Button>
                        <Button type="button" variant="secondary" onClick={onClose}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
});
