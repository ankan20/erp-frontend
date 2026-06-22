"use client";

import { useState } from "react";

import {
  Loader2,
  Search,
  Hash,
  User,
  MapPin,
  Building2,
  CheckCircle2,
  CheckCheck,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";

import { toast } from "sonner";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { setCookie } from "@/lib/cookies";
import { getLocalStorage, setLocalStorage } from "@/lib/localStorage";

// ── BAND COLORS — cycles through 4 matching the infographic ──────────────────
const BAND_COLORS = ["#c0392b", "#27ae60", "#2471a3", "#7d3c98"];

// ── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_MAP = {
  ongoing:   { label: "Ongoing",   cls: "bg-green-100 text-green-700 border-green-200",   Icon: CheckCircle2  },
  completed: { label: "Completed", cls: "bg-blue-100  text-blue-700  border-blue-200",    Icon: CheckCheck    },
  "hold": { label: "On Hold",   cls: "bg-yellow-100 text-yellow-700 border-yellow-200",Icon: Clock         },
  cancelled: { label: "Cancelled", cls: "bg-red-100   text-red-700   border-red-200",     Icon: XCircle       },
};

function StatusBadge({ status }) {
  const key = (status || "").toLowerCase().replace(/\s+/g, "-");
  const cfg = STATUS_MAP[key] ?? {
    label: status || "—",
    cls:   "bg-gray-100 text-gray-600 border-gray-200",
    Icon:  AlertCircle,
  };
  const { label, cls, Icon } = cfg;
  return (
    <span
      className={`
        inline-flex items-center gap-1
        text-[11px] font-semibold
        px-2 py-0.5
        rounded-full border
        shrink-0
        ${cls}
      `}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function ProjectSelectPopup({
  open,
  projectList = [],
  loadingProjects = false,
  onSuccess,
}) {
  // ── ALL STATE & LOGIC EXACTLY AS BEFORE ───────────────────────────────────
  const savedProject = getLocalStorage("projectInfo");

  const [selectedProject, setSelectedProject] = useState(
    savedProject?.projectId || "",
  );

  const [loadingSelect, setLoadingSelect] = useState(false);

  // ── NEW: local search state (pure UI, zero effect on logic) ───────────────
  const [searchQuery, setSearchQuery] = useState("");

  const handleProjectSelect = async (value, item) => {
    if (!item) return;

    try {
      setLoadingSelect(true);

      // SAVE PROJECT
      const projectData = {
        projectId:   item.id,
        projectCode: item.projectCode,
        projectName: item.projectName,
        clientName:  item.clientName,
      };

      setLocalStorage("projectInfo", JSON.stringify(projectData));

      let projectCode = item.projectCode || "";

      // FETCH TOKEN + PERMISSION
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.GET_PROJECT_PERMISSION}/${projectCode}`,
        method: "POST",
        data:   { projectCode },
      });

      const permissions = res?.data[0].permissions || {};
      const token       = res?.data[0].token;

      // REPLACE TOKEN — use localStorage because the project token embeds
      // all permissions, making it too large for the 4096-byte cookie limit
      setLocalStorage("token", token);

      // SAVE PERMISSION
      setLocalStorage("permissions", JSON.stringify(permissions));

      toast.success("Project Selected");

      onSuccess?.(permissions);
    } catch (err) {
      toast.error(err.message || "Failed to select project");
    } finally {
      setLoadingSelect(false);
    }
  };

  if (!open) return null;

  // ── FILTERED LIST (search is purely presentational) ───────────────────────
  const filtered = projectList.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.projectName  || "").toLowerCase().includes(q) ||
      (p.projectCode  || "").toLowerCase().includes(q) ||
      (p.clientName   || "").toLowerCase().includes(q)
    );
  });

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/*
       * The page background (gradient set in page.js) is intentionally visible
       * here — no black overlay — giving a clean, modern appearance.
       */}
      <div className="w-full max-w-[660px] flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[90vh]">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-5 bg-gradient-to-r from-[#0c3472] to-[#1564b3] shrink-0">
          <h2 className="text-[22px] font-bold text-white leading-tight">
            Select Project
          </h2>
          <p className="text-[13px] text-blue-200 mt-0.5">
            Choose a project to continue
          </p>

          {/* SEARCH */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project name, code or client…"
              className="
                w-full pl-9 pr-4 py-[9px]
                rounded-lg text-[13px]
                bg-white border border-blue-200
                outline-none
                focus:ring-2 focus:ring-blue-300 focus:border-blue-300
                placeholder:text-gray-400
              "
            />
          </div>
        </div>

        {/* ── PROJECT LIST ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0f4fb]">

          {/* Loading state */}
          {loadingProjects && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#0c3472]" />
            </div>
          )}

          {/* Empty state */}
          {!loadingProjects && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-[13px]">
              {searchQuery.trim()
                ? "No projects match your search."
                : "No projects available."}
            </div>
          )}

          {/* Cards */}
          {!loadingProjects &&
            filtered.map((project, index) => {
              const bandColor = BAND_COLORS[index % BAND_COLORS.length];
              const isSelected =
                String(selectedProject) === String(project.id);
              const isThisLoading = loadingSelect && isSelected;

              return (
                <div
                  key={project.id}
                  onClick={() => {
                    if (loadingSelect) return;
                    setSelectedProject(project.id);
                    handleProjectSelect(project.id, project);
                  }}
                  className={`
                    relative overflow-hidden rounded-xl bg-white
                    border-2 transition-all duration-150
                    ${
                      isSelected
                        ? "border-[#0c3472] shadow-md"
                        : "border-transparent shadow-sm hover:border-blue-200 hover:shadow-md"
                    }
                    ${
                      loadingSelect && !isSelected
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:-translate-y-[1px]"
                    }
                  `}
                >
                  {/* COLORED LEFT BAND (infographic parallelogram) */}
                  <div
                    className="absolute left-0 top-0 bottom-0 flex flex-col items-center justify-center gap-0.5"
                    style={{
                      width:    "88px",
                      background: bandColor,
                      clipPath: "polygon(0 0, 82% 0, 100% 100%, 0 100%)",
                    }}
                  >
                    {isThisLoading ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <>
                        <span className="text-white text-[9px] font-bold tracking-[0.2em] opacity-70 pr-4">
                          PROJ
                        </span>
                        <span className="text-white text-[13px] font-extrabold leading-none pr-4 tracking-wide">
                          {project.projectCode}
                        </span>
                      </>
                    )}
                  </div>

                  {/* CONTENT */}
                  <div className="pl-[100px] pr-4 py-[10px]">

                    {/* Row 1: Project Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[14px] font-bold text-[#1a2a4a] leading-snug flex-1">
                        {project.projectName}
                      </span>
                      <StatusBadge status={project.status} />
                    </div>

                    {/* Row 2: Code + Client */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0c3472] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                        <Hash className="w-3 h-3" />
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {project.clientName && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                          <User className="w-3 h-3" />
                          {project.clientName}
                        </span>
                      )}
                    </div>

                    {/* Row 3: State + GSTN */}
                    {(project.state || project.gstn) && (
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        {project.state && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                            <MapPin className="w-3 h-3" />
                            {project.state}
                          </span>
                        )}
                        {project.gstn && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                            <Building2 className="w-3 h-3 shrink-0" />
                            {project.gstn}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <div className="px-6 py-2.5 bg-white border-t border-gray-100 text-center shrink-0">
          <p className="text-[11px] text-gray-400">
            {loadingProjects
              ? "Loading projects…"
              : `${projectList.length} project${projectList.length !== 1 ? "s" : ""} available`}
            {!loadingProjects &&
              searchQuery.trim() &&
              filtered.length !== projectList.length &&
              ` · ${filtered.length} matching`}
          </p>
        </div>

      </div>
    </div>
  );
}
