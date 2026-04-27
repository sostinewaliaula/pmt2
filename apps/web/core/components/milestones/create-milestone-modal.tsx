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
import type { TMilestone } from "@plane/types";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
};

type FormValues = {
  name: string;
  description: string;
  start_date: string;
  target_date: string;
  status: TMilestone["status"];
};

export const CreateMilestoneModal = observer(function CreateMilestoneModal({
  isOpen,
  onClose,
  workspaceSlug,
  projectId,
}: Props) {
  const { createMilestone } = useMilestone();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      description: "",
      start_date: "",
      target_date: "",
      status: "planned",
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    const payload: Partial<TMilestone> = {
      name: data.name,
      description: data.description,
      status: data.status,
      start_date: data.start_date || null,
      target_date: data.target_date || null,
    };
    try {
      await createMilestone(workspaceSlug, projectId, payload);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Milestone created.",
      });
      reset();
      onClose();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to create milestone.",
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
                      Create Milestone
                    </Dialog.Title>
                    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary">Name</label>
                        <input
                          type="text"
                          {...register("name", { required: true, maxLength: 255 })}
                          className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                          placeholder="e.g. Beta launch"
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
                          placeholder="What's the goal?"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-secondary">Start date</label>
                          <input
                            type="date"
                            {...register("start_date")}
                            className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-secondary">Target date</label>
                          <input
                            type="date"
                            {...register("target_date")}
                            className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-secondary">Status</label>
                        <select
                          {...register("status")}
                          className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm text-primary shadow-sm focus:border-accent-primary outline-none"
                        >
                          <option value="planned">Planned</option>
                          <option value="in-progress">In progress</option>
                          <option value="on-hold">On hold</option>
                          <option value="completed">Completed</option>
                        </select>
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
