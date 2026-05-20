"use client";

import { useState } from "react";

import { Loader2 } from "lucide-react";

import { toast } from "sonner";

import SearchableSelect from "@/components/common/SearchableSelect";

import { Button } from "@/components/ui/button";

import { apiRequest } from "@/lib/apiClient";

import { API_ENDPOINTS } from "@/config/api.config";

import { setCookie } from "@/lib/cookies";

import { getLocalStorage, setLocalStorage } from "@/lib/localStorage";

export default function ProjectSelectPopup({
  open,
  projectList = [],
  loadingProjects = false,
  onSuccess,
}) {
  const savedProject = getLocalStorage("projectInfo");

  const [selectedProject, setSelectedProject] = useState(
    savedProject?.projectId || "",
  );

  const [loadingSelect, setLoadingSelect] = useState(false);

  const handleProjectSelect = async (value, item) => {
    if (!item) return;

    try {
      setLoadingSelect(true);

      // SAVE PROJECT
      const projectData = {
        projectId: item.id,
        projectCode: item.projectCode,
        projectName: item.projectName,
        clientName: item.clientName,
      };

      setLocalStorage("projectInfo", JSON.stringify(projectData));

      let projectCode = item.projectCode || "";

      // FETCH TOKEN + PERMISSION
      const res = await apiRequest({
        url: `${API_ENDPOINTS.GET_PROJECT_PERMISSION}/${projectCode}`,
        method: "POST",
        data: {
          projectCode: projectCode,
        },
      });

      const permissions = res?.data[0].permissions || {};

      const token = res?.data[0].token;

      // REPLACE TOKEN
      setCookie("token", token);

      // SAVE PERMISSION
      localStorage.setItem("permissions", JSON.stringify(permissions));

      toast.success("Project Selected");

      onSuccess?.(permissions);
    } catch (err) {
      toast.error(err.message || "Failed to select project");
    } finally {
      setLoadingSelect(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-black/40
      "
    >
      <div
        className="
          w-full max-w-[550px]
          rounded-xl
          bg-white
          shadow-xl
          p-6
        "
      >
        <div className="space-y-5">
          <div>
            <h2
              className="
                text-[28px]
                font-semibold
                text-[#0c3472]
              "
            >
              Select Project
            </h2>

            <p
              className="
                text-[15px]
                text-gray-500
                mt-1
              "
            >
              Please select a project to continue
            </p>
          </div>

          <SearchableSelect
            placeholder="Select Project"
            options={projectList.map((project) => ({
              label: `${project.projectCode} : ${project.projectName}`,
              value: project.id,
              ...project,
            }))}
            value={selectedProject}
            onChange={(value, item) => {
              setSelectedProject(value);

              handleProjectSelect(value, item);
            }}
            disabled={loadingProjects || loadingSelect}
          />

          {(loadingProjects || loadingSelect) && (
            <div
              className="
                flex items-center
                justify-center
                py-2
              "
            >
              <Loader2
                className="
                  w-5 h-5
                  animate-spin
                "
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
