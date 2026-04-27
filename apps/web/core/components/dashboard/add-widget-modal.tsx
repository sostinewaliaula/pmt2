/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Dialog, Transition } from "@headlessui/react";
import { LayoutGrid, X } from "lucide-react";
// plane package imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// hooks
import { useDashboard } from "@/hooks/store/use-dashboard";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  dashboardId: string;
  existingWidgetIds?: string[];
};

export const AddWidgetModal = observer(function AddWidgetModal({
  isOpen,
  onClose,
  workspaceSlug,
  dashboardId,
  existingWidgetIds = [],
}: Props) {
  const { availableWidgets, fetchAvailableWidgets, createDashboardWidget } = useDashboard();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const { isLoading } = useSWR(isOpen ? "AVAILABLE_WIDGETS" : null, isOpen ? () => fetchAvailableWidgets() : null);

  const handleAdd = async (widgetId: string) => {
    setSubmittingId(widgetId);
    try {
      await createDashboardWidget(workspaceSlug, dashboardId, { widget: widgetId });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Widget added to dashboard.",
      });
      onClose();
    } catch (error: any) {
      const message =
        typeof error?.detail === "string"
          ? error.detail
          : Array.isArray(error?.non_field_errors)
            ? error.non_field_errors.join(", ")
            : "Failed to add widget.";
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message });
    } finally {
      setSubmittingId(null);
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-surface-2 px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6 border border-subtle">
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-surface-2 text-secondary hover:text-primary outline-none"
                    onClick={onClose}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div>
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-primary">
                    Add a widget
                  </Dialog.Title>
                  <p className="mt-1 text-sm text-tertiary">Pick a widget from the catalog.</p>

                  <div className="mt-6">
                    {isLoading ? (
                      <div className="flex h-40 items-center justify-center">
                        <LogoSpinner />
                      </div>
                    ) : availableWidgets.length === 0 ? (
                      <div className="flex h-40 items-center justify-center text-sm text-tertiary">
                        No widgets are available.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {availableWidgets.map((widget) => {
                          const alreadyAdded = existingWidgetIds.includes(widget.id);
                          return (
                            <div
                              key={widget.id}
                              className="flex items-start gap-3 rounded-lg border border-subtle bg-surface-1 p-4"
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-primary/10 text-accent-primary">
                                <LayoutGrid className="h-5 w-5" />
                              </div>
                              <div className="flex-grow">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="text-sm font-medium text-primary">{widget.name}</h4>
                                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase text-tertiary">
                                    {widget.category}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-secondary">{widget.description}</p>
                                <div className="mt-3">
                                  <Button
                                    size="sm"
                                    variant={alreadyAdded ? "secondary" : "primary"}
                                    disabled={alreadyAdded || submittingId === widget.id}
                                    loading={submittingId === widget.id}
                                    onClick={() => handleAdd(widget.id)}
                                  >
                                    {alreadyAdded ? "Already added" : "Add"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button type="button" variant="secondary" onClick={onClose}>
                      Done
                    </Button>
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
