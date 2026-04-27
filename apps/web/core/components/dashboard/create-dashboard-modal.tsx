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
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import type { TDashboard } from "@plane/types";
// hooks
import { useDashboard } from "@/hooks/store/use-dashboard";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  onCreated?: (dashboard: TDashboard) => void;
};

type FormValues = {
  name: string;
  description: string;
  is_public: boolean;
};

export const CreateDashboardModal = observer(function CreateDashboardModal({
  isOpen,
  onClose,
  workspaceSlug,
  onCreated,
}: Props) {
  const { createDashboard } = useDashboard();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: "", description: "", is_public: false },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const dashboard = await createDashboard(workspaceSlug, data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Dashboard created.",
      });
      reset();
      onCreated?.(dashboard);
      onClose();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to create dashboard.",
      });
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                    onClick={handleClose}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-primary">
                      Create Dashboard
                    </Dialog.Title>
                    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary">Name</label>
                        <input
                          type="text"
                          {...register("name", { required: true, maxLength: 255 })}
                          className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                          placeholder="My Dashboard"
                          autoFocus
                        />
                        {errors.name && <span className="text-xs text-red-500">Name is required.</span>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-secondary">Description</label>
                        <textarea
                          {...register("description")}
                          rows={3}
                          className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                          placeholder="What is this dashboard about?"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="dashboard-is-public"
                          type="checkbox"
                          {...register("is_public")}
                          className="h-4 w-4 rounded border-subtle"
                        />
                        <label htmlFor="dashboard-is-public" className="text-sm text-secondary">
                          Make this dashboard public to the workspace
                        </label>
                      </div>
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                        <Button type="submit" variant="primary" loading={isSubmitting}>
                          Create
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleClose}>
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
