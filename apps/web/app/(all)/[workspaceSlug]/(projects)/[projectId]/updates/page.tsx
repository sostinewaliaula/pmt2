/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
// components
import { ProjectUpdateList, CreateProjectUpdateModal } from "@/components/project-updates";
import { Button } from "@plane/propel/button";

export default function ProjectUpdatesPage() {
  const { workspaceSlug, projectId } = useParams();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
      <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
        <h1 className="text-xl font-semibold text-primary">Status Updates</h1>
        <Button
          variant="primary"
          prependIcon={<Plus className="h-4 w-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          Post Update
        </Button>
      </div>

      <div className="flex-grow overflow-y-auto">
        <ProjectUpdateList />
      </div>

      <CreateProjectUpdateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        workspaceSlug={workspaceSlug.toString()}
        projectId={projectId.toString()}
      />
    </div>
  );
}
