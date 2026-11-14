"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { tcodeConfig } from "@/config/tcode.config";
import Image from "next/image";
import { toast } from "sonner";
import { clearAuthCookies, setCookie } from "@/lib/cookies";
import { getCookie } from "@/lib/cookies";
import {
  getLocalStorage,
  setLocalStorage,
  clearLocalStorage,
} from "@/lib/localStorage";
import SearchableSelect from "@/components/common/SearchableSelect";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { User, LogOut } from "lucide-react";
import { useComm } from "@/context/CommContext";
import { ROLE, roleMap } from "@/config/role.config";

function NavTooltip({ label, children }) {
  return (
    <div className="relative group flex items-center justify-center">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[9999]
        opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="bg-[#1e2a3a] text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md
          whitespace-nowrap shadow-lg border border-[#2d3d52]">
          {label}
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1e2a3a]" />
      </div>
    </div>
  );
}

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [tcode, setTcode] = useState("");
  // const [showProjectSelect, setShowProjectSelect] = useState(false);
  // const [projectList, setProjectList] = useState([]);
  // const [loadingProjects, setLoadingProjects] = useState(false);
  // const projectRef = useRef(null);
  const profileRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  // CommProvider is always an ancestor in the protected layout — safe to call here
  const comm = useComm();

  // Lazy initialisers read localStorage/cookies once on client mount — no effect needed
  const [projectInfo] = useState(() => {
    try {
      const stored = getLocalStorage("projectInfo");
      if (stored) return typeof stored === "string" ? JSON.parse(stored) : stored;
    } catch {}
    return { projectId: "", projectCode: "", clientName: "", projectName: "" };
  });

  const [username] = useState(() => {
    try { return getLocalStorage("userName") || ""; } catch { return ""; }
  });

  const [role] = useState(() => {
    try {
      const storedRole = getCookie("role") || "";
      return roleMap[storedRole] || storedRole;
    } catch { return ""; }
  });

  // Attach listener only when dropdown is open — avoids stale closure with []
  useEffect(() => {
    if (!showProfile) return;

    const handleOutsideClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showProfile]);

  const handleTCodeNavigate = () => {
    const route = tcodeConfig[tcode.toLowerCase().trim()];
    if (route) {
      router.push(route);
      setTcode("");
    } else {
      toast.error("no match found!");
    }
  };

  // const fetchProjects = async () => {
  //   try {
  //     setLoadingProjects(true);

  //     const res = await apiRequest({
  //       url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS,
  //     });

  //     setProjectList(res.data || []);
  //   } catch (err) {
  //     toast.error(err.message || "Failed to fetch projects");
  //   } finally {
  //     setLoadingProjects(false);
  //   }
  // };

  // const handleProjectSelect = (value, item) => {
  //   const projectData = {
  //     projectId: item.id,
  //     projectCode: item.projectCode,
  //     projectName: item.projectName,
  //     clientName: item.clientName,
  //   };

  //   setProjectInfo(projectData);

  //   setLocalStorage("projectInfo", JSON.stringify(projectData));

  //   setShowProjectSelect(false);

  //   toast.success("Project Selected");
  // };

  const handleLogout = async () => {
    try {
      await apiRequest({
        url: API_ENDPOINTS.LOGOUT,
        method: "POST",
      });
    } catch {
      // Proceed with local logout even if backend call fails
    }
    clearAuthCookies();
    clearLocalStorage();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <div className="w-full border border-[#c4d1df] bg-[#efefef]">
      {/* TOP SECTION */}
      <div className="flex flex-col lg:flex-row justify-between px-4 lg:px-6 pt-2 gap-4 mb-3.5">
        {/* LEFT */}
        <div className="flex flex-col">
          {/* Branding */}
          <div className="leading-tight">
            <div className="flex items-end gap-1">
              <span className="text-[22px] lg:text-[24px] font-extrabold text-[#003b8e]">
                PRAX
              </span>
              <span className="text-[13px] lg:text-[14px] font-bold">
                CONSTRUCTION
              </span>
              <span className="text-[13px] lg:text-[14px] font-bold text-red-600">
                ERP
              </span>
            </div>

            <div className="mt-0.5 text-[15px] lg:text-[18px] font-bold">
              Company: Dishaan Hi-tech (India) Pvt. Ltd.
            </div>
          </div>

          <div className="mt-2 h-[1px] w-full lg:w-130 bg-[#b8c7da]" />

          {/* ICONS + TCODE */}
          <div className="mt-4 flex items-center flex-wrap gap-4">
            {/* LEFT ICONS */}
            <div className="flex items-center gap-2 h-[32px]">
              <NavTooltip label="Dashboard">
                <button
                  className="cursor-pointer"
                  onClick={() => router.push("/dashboard")}
                >
                  <Image
                    src="/assets/icons/computer-monitor.png"
                    alt="Dashboard"
                    width={32}
                    height={32}
                  />
                </button>
              </NavTooltip>

              <NavTooltip label="Master">
                <button
                  className="cursor-pointer"
                  onClick={() => router.push("/master/ledger-code")}
                >
                  <Image
                    src="/assets/icons/database.png"
                    alt="Master Data"
                    width={32}
                    height={32}
                  />
                </button>
              </NavTooltip>

              <NavTooltip label="Settings">
                <button
                  className="cursor-pointer"
                  onClick={() => {
                    if (role === roleMap.super_admin) {
                      router.push("/settings/company-details");
                    }
                  }}
                >
                  <Image
                    src="/assets/icons/settings.png"
                    alt="Settings"
                    width={32}
                    height={32}
                  />
                </button>
              </NavTooltip>

              <NavTooltip label="Project List">
                <button
                  className="cursor-pointer flex items-center justify-center h-[32px]"
                  onClick={() => {
                    if (role === roleMap.user) {
                      router.push("/");
                    }
                  }}
                >
                  <Image
                    src="/assets/icons/project-list.png"
                    alt="Project List"
                    width={32}
                    height={32}
                  />
                </button>
              </NavTooltip>
            </div>

            {/* SPACE BETWEEN ICONS AND TCODE */}
            <div className=" flex items-center gap-2 ml-6 md:ml-20 lg:ml-40 xl:ml-64 shrink-0">
              <span className="text-sm">T. Code</span>

              <input
                value={tcode}
                onChange={(e) => setTcode(e.target.value)}
                className="h-6 w-25 border border-[#d5b7a2] bg-[#eef0a7] px-2 text-sm outline-none"
              />

              <button onClick={handleTCodeNavigate} className="cursor-pointer">
                <Image
                  src="/assets/icons/green-right-arrow.png"
                  alt=""
                  width={28}
                  height={28}
                />
              </button>
            </div>
          </div>
        </div>
        {/* RIGHT */}
        <div className="w-full lg:w-150 flex justify-between items-start gap-4">
          {/* PROJECT INFO */}
          <div className="text-[13px] lg:text-[14px] space-y-0.5">
            <div className="flex items-center leading-none">
              <span className="min-w-27.5 lg:min-w-32.5 font-bold">
                Project Code
              </span>

              <span className="mr-2">:</span>

              <span className="font-bold break-words">
                {projectInfo.projectCode || "-"}
              </span>
            </div>

            <div className="flex items-center leading-none">
              <span className="min-w-[110px] lg:min-w-[130px] font-bold">
                Client Name
              </span>

              <span className="mr-2">:</span>

              <span className="font-bold text-red-600 break-words">
                {projectInfo.clientName || "-"}
              </span>
            </div>

            <div className="flex items-center leading-none">
              <span className="min-w-[110px] lg:min-w-[130px] font-bold">
                Project Name
              </span>

              <span className="mr-2">:</span>

              <span className="break-words">
                {projectInfo.projectName || "-"}
              </span>
            </div>

            <div className="flex items-center leading-none">
              <span className="min-w-[110px] lg:min-w-[130px] font-bold">
                User
              </span>

              <span className="mr-2">:</span>

              <span className="wrap-break-words">{username || "-"}</span>
            </div>
          </div>

          {/* PROFILE */}
          <div ref={profileRef} className="relative shrink-0">
            <button
              onClick={() => setShowProfile((prev) => !prev)}
              className="
        h-10
        w-10
        rounded-full
        bg-[#d6e6f2]
        border
        border-[#8f8f8f]
        flex
        items-center
        justify-center
        hover:bg-[#c6d9e8]
        transition
        cursor-pointer
      "
            >
              <User size={20} />
            </button>
            {/* Online indicator */}
            <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full
              border-2 border-white" title="Online" />

            {showProfile && (
              <div
                className="
          absolute
          right-0
          top-12
          w-[220px]
          bg-white
          border
          border-gray-200
          rounded-lg
          shadow-lg
          overflow-hidden
          z-50
        "
              >
                {/* TOP */}
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="text-[14px] font-semibold">
                    {username || "User"}
                  </div>

                  <div className="text-[12px] text-gray-500 mt-0.5">
                    {role || "-"}
                  </div>
                </div>

                {/* LOGOUT */}
                <button
                  onClick={handleLogout}
                  className="
            w-full
            flex
            items-center
            gap-2
            px-4
            py-3
            text-left
            bg-red-50
            hover:bg-red-100
            transition
            cursor-pointer
          "
                >
                  <LogOut size={16} className="text-red-600" />

                  <span className="text-[13px] text-red-600 font-medium">
                    Logout
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM */}
    </div>
  );
}
