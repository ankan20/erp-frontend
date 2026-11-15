"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { ROLE } from "@/config/role.config";
import { sidebarConfig } from "@/config/sidebar.config";
import { API_ENDPOINTS } from "@/config/api.config";

import { getCookie, setCookie } from "@/lib/cookies";

import { apiRequest } from "@/lib/apiClient";
import { toast } from "sonner";

import ProjectSelectPopup from "@/components/common/ProjectSelectPopup";
import { getFirstAllowedPage } from "@/helper/getFirstAllowedPage";
import { getLocalStorage } from "@/lib/localStorage";

export default function HomePage() {

  const router = useRouter();

  const [projectList, setProjectList] = useState([]);

  const [loadingProjects, setLoadingProjects] =
    useState(false);

  useEffect(() => {

    const token = getLocalStorage("token") ;

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

  // Returns true if 'path' matches a sidebar item the user has at least VIEW/EDIT/APPROVER on.
  // Handles both exact matches (list pages) and prefix matches (detail pages like /grn/123).
  const isPathAllowed = (path, permissions) => {
    const check = (items) => {
      for (const item of items) {
        if (item.permissionKey && item.path) {
          const canAccess =
            permissions[`${item.permissionKey}.VIEW`] ||
            permissions[`${item.permissionKey}.EDIT`] ||
            permissions[`${item.permissionKey}.APPROVER`];
          if (canAccess && (path === item.path || path.startsWith(item.path + "/"))) {
            return true;
          }
        }
        if (item.children && check(item.children)) return true;
      }
      return false;
    };
    return check(sidebarConfig);
  };

  const handleProjectSuccess = (permissions) => {
    const firstPage = getFirstAllowedPage(sidebarConfig, permissions);

    if (!firstPage) {
      router.replace("/no-access");
      return;
    }

    // Restore saved path if it's accessible with the new permissions
    const returnTo = typeof window !== "undefined" ? sessionStorage.getItem("returnTo") : null;
    if (returnTo) {
      sessionStorage.removeItem("returnTo");
      if (isPathAllowed(returnTo, permissions)) {
        router.replace(returnTo);
        return;
      }
    }

    router.replace(firstPage);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-white via-[#fdfcf9] to-[#f7f3eb]">

      <ProjectSelectPopup
        open={true}
        projectList={projectList}
        loadingProjects={loadingProjects}
        onSuccess={handleProjectSuccess}
      />

    </div>
  );
}