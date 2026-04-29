/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Search } from "lucide-react";
// plane imports
import { ROLE, EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { ChevronDownIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Avatar, CustomSelect, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// helpers
import { getFileURL } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useUserPermissions } from "@/hooks/store/user";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  projectId: string;
  workspaceSlug: string;
};

export const SendProjectInvitationModal = observer(function SendProjectInvitationModal(props: Props) {
  const { isOpen, onClose, onSuccess, projectId, workspaceSlug } = props;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const {
    project: { getProjectMemberDetails, bulkAddMembersToProject },
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails },
  } = useMember();

  // local state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [defaultRole, setDefaultRole] = useState<EUserPermissions>(EUserPermissions.MEMBER);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // derived
  // Default to ADMIN when the role cannot be determined — the Add button is only
  // visible to admins, so this is a safe upper bound and prevents the role list
  // from collapsing to Guest-only while the store is still loading.
  const currentProjectRole =
    getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId) ?? EUserPermissions.ADMIN;

  const uninvitedIds = useMemo(
    () =>
      (workspaceMemberIds ?? []).filter((userId) => {
        const pm = getProjectMemberDetails(userId, projectId);
        return !(pm?.member.id && pm?.original_role);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceMemberIds, projectId]
  );

  const filteredIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uninvitedIds;
    return uninvitedIds.filter((userId) => {
      const m = getWorkspaceMemberDetails(userId)?.member;
      if (!m) return false;
      return (
        m.display_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
      );
    });
  }, [uninvitedIds, search, getWorkspaceMemberDetails]);

  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const toggleMember = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Workspace Guests are capped at Guest project role by the backend.
  // Return the effective role for a given user.
  const effectiveRole = (userId: string): EUserPermissions => {
    const wsRole = getWorkspaceMemberDetails(userId)?.role as EUserPermissions | undefined;
    if (wsRole === EUserPermissions.GUEST) return EUserPermissions.GUEST;
    return defaultRole;
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await bulkAddMembersToProject(workspaceSlug, projectId, {
        members: Array.from(selectedIds).map((id) => ({
          member_id: id,
          role: effectiveRole(id),
        })),
      });
      setToast({
        title: "Success!",
        type: TOAST_TYPE.SUCCESS,
        message: `${selectedIds.size} member${selectedIds.size !== 1 ? "s" : ""} added successfully.`,
      });
      if (onSuccess) onSuccess();
      handleClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setSelectedIds(new Set());
      setSearch("");
      setDefaultRole(EUserPermissions.MEMBER);
    }, 300);
  };

  const availableRoles = Object.entries(ROLE).filter(([key]) => parseInt(key) <= currentProjectRole);

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="flex flex-col gap-4 p-5">
        <h3 className="text-16 leading-6 font-medium text-primary">
          {t("project_settings.members.invite_members.title")}
        </h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="placeholder-secondary focus:ring-accent-primary w-full rounded-md border border-subtle bg-transparent py-2 pr-3 pl-9 text-13 text-primary focus:ring-1 focus:outline-none"
          />
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAll}
              className="rounded"
              disabled={filteredIds.length === 0}
            />
            <span className="text-xs text-secondary">
              {selectedIds.size > 0
                ? `${selectedIds.size} of ${uninvitedIds.length} selected`
                : `${uninvitedIds.length} workspace member${uninvitedIds.length !== 1 ? "s" : ""} not yet in project`}
            </span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary">Add as:</span>
            <CustomSelect
              value={defaultRole}
              onChange={(val: EUserPermissions) => setDefaultRole(val)}
              customButton={
                <button className="flex items-center gap-1 rounded-md border border-subtle px-2 py-1 text-13 text-secondary hover:bg-layer-1 hover:text-primary">
                  <span>{ROLE[defaultRole]}</span>
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              }
              input
            >
              {availableRoles.map(([key, label]) => (
                <CustomSelect.Option key={key} value={parseInt(key) as EUserPermissions}>
                  {label}
                </CustomSelect.Option>
              ))}
            </CustomSelect>
          </div>
        </div>

        {/* Member list */}
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-md border border-subtle p-1">
          {filteredIds.length === 0 ? (
            <p className="py-6 text-center text-13 text-secondary">
              {search ? "No members match your search." : "All workspace members are already in this project."}
            </p>
          ) : (
            filteredIds.map((userId) => {
              const details = getWorkspaceMemberDetails(userId);
              if (!details?.member) return null;
              const { display_name, first_name, last_name, email, avatar_url } = details.member;
              const isSelected = selectedIds.has(userId);
              const isWsGuest = (details.role as EUserPermissions) === EUserPermissions.GUEST;

              return (
                <label
                  key={userId}
                  className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-layer-1 ${isSelected ? "bg-layer-1" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMember(userId)}
                    className="shrink-0 rounded"
                  />
                  <Avatar name={display_name} src={getFileURL(avatar_url ?? "")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-13 text-primary">
                      {first_name} {last_name} <span className="text-secondary">({display_name})</span>
                    </div>
                    <div className="truncate text-11 text-secondary">{email}</div>
                  </div>
                  <span className="shrink-0 text-11 text-secondary">
                    {isWsGuest ? (
                      <span title="Workspace Guests can only be added as project Guest">Guest only</span>
                    ) : (
                      ROLE[details.role as EUserPermissions]
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="lg" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={selectedIds.size === 0}
          >
            {isSubmitting
              ? "Adding…"
              : selectedIds.size > 0
                ? `Add ${selectedIds.size} member${selectedIds.size !== 1 ? "s" : ""}`
                : "Add members"}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
