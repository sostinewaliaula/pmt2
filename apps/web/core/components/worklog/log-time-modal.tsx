/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment } from "react";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
// plane package imports
import { Button } from "@plane/propel/button";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import { TWorklogCreate } from "@plane/types";
// hooks
import { useWorklog } from "@/hooks/store/use-worklog";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

export const LogTimeModal = observer(function LogTimeModal({ isOpen, onClose, workspaceSlug, projectId, issueId }: Props) {
  const { t } = useTranslation();
  const { createWorklog } = useWorklog();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TWorklogCreate>({
    defaultValues: {
      duration: 0,
      date: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  const onSubmit = async (data: TWorklogCreate) => {
    try {
      await createWorklog(workspaceSlug, projectId, issueId, data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Worklog created successfully.",
      });
      reset();
      onClose();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to create worklog. Please try again.",
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-surface-2 px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
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
                      Log Time
                    </Dialog.Title>
                    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary">Duration (minutes)</label>
                        <input
                          type="number"
                          {...register("duration", { required: true, min: 1 })}
                          className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                        />
                        {errors.duration && <span className="text-xs text-red-500">Duration is required and must be greater than 0.</span>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-secondary">Date</label>
                        <input
                          type="date"
                          {...register("date", { required: true })}
                          className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-secondary">Description</label>
                        <textarea
                          {...register("description")}
                          rows={3}
                          className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                          placeholder="What did you work on?"
                        />
                      </div>
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                        <Button type="submit" variant="primary" loading={isSubmitting}>
                          Log Time
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
