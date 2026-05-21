"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { ROLE } from "@/config/role.config";
import { sidebarConfig } from "@/config/sidebar.config";
import { API_ENDPOINTS } from "@/config/api.config";

import { getCookie, setCookie } from "@/lib/cookies";

import { apiRequest } from "@/lib/apiClient";

import ProjectSelectPopup from "@/components/common/ProjectSelectPopup";
import { getFirstAllowedPage } from "@/helper/getFirstAllowedPage";

export default function HomePage() {

  const router = useRouter();

  const [projectList, setProjectList] = useState([]);

  const [loadingProjects, setLoadingProjects] =
    useState(false);

  useEffect(() => {

    const token = getCookie("token");

    const role = getCookie("role");

    if (!token) {
      router.replace("/login");
      return;
    }

    // ROLE BASED REDIRECT
    if (role === ROLE.SUPER_ADMIN) {
      router.replace("/settings/company-details");
      return;
    }

    if (role === ROLE.ADMIN) {
      router.replace("/master/ledger-code");
      return;
    }

    fetchProjects();

  }, []);

  const fetchProjects = async () => {

    try {

      setLoadingProjects(true);

      const res = await apiRequest({
        url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS,
      });

      setProjectList(res.data || []);

    } catch (err) {

      toast.error(
        err.message || "Failed to fetch projects"
      );

    } finally {

      setLoadingProjects(false);
    }
  };

  const handleProjectSuccess = (
    permissions
  ) => {

    const firstPage =
      getFirstAllowedPage(
        sidebarConfig,
        permissions
      );

    if (!firstPage) {
      router.replace("/no-access");
      return;
    }

    router.replace(firstPage);
  };

  return (
    <div className="min-h-screen bg-[#ececec]">

      <ProjectSelectPopup
        open={true}
        projectList={projectList}
        loadingProjects={loadingProjects}
        onSuccess={handleProjectSuccess}
      />

    </div>
  );
}