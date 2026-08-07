"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  Plus,
  Save,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { sidebarConfig } from "@/config/sidebar.config";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import SearchableSelect from "@/components/common/SearchableSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Build flat row list from sidebarConfig — runs once at module level
// ---------------------------------------------------------------------------

function buildAllRows() {
  const visibleModules = sidebarConfig.filter((m) => !m.hideInPermissions);
  const rows = [];

  const recurse = (items, depth, path, serial) => {
    items.forEach((item, idx) => {
      const currentPath = [...path, idx + 1];
      const currentSerial = [...serial, idx + 1];
      const rowId = currentPath.join("-");
      const serialNo = currentSerial.join(".");

      if (item.children?.length > 0) {
        if (item.showChildrenInPermission === false) {
          const key =
            item.permissionKey ||
            item.children.find((c) => c.permissionKey)?.permissionKey;
          if (key)
            rows.push({ rowId, moduleCode: key, title: item.title, depth, isLeaf: true, serialNo });
        } else {
          rows.push({ rowId, moduleCode: null, title: item.title, depth, isLeaf: false, serialNo });
          recurse(item.children, depth + 1, currentPath, currentSerial);
        }
      } else if (item.permissionKey) {
        rows.push({ rowId, moduleCode: item.permissionKey, title: item.title, depth, isLeaf: true, serialNo });
      }
    });
  };

  visibleModules.forEach((module, idx) => {
    const serialNo = String(idx + 1);
    rows.push({ rowId: serialNo, moduleCode: null, title: module.title, depth: 0, isLeaf: false, serialNo });
    recurse(module.children || [], 1, [idx + 1], [idx + 1]);
  });

  return rows;
}

const ALL_ROWS = buildAllRows();
const LEAF_ROWS = ALL_ROWS.filter((r) => r.isLeaf && r.moduleCode);
const MODULE_ROW_MAP = Object.fromEntries(
  LEAF_ROWS.map((r) => [r.moduleCode, r.rowId])
);

// Default rowLevels: all leaf rows start with 2 levels
function defaultRowLevels() {
  const init = {};
  LEAF_ROWS.forEach((r) => { init[r.rowId] = 2; });
  return init;
}

// ---------------------------------------------------------------------------
// Row style helpers
// ---------------------------------------------------------------------------

const GROUP_STYLES = {
  0: "bg-[#c8e3ef] font-bold text-[12px]",
  1: "bg-[#d7ebcd] font-semibold text-[12px]",
  2: "bg-[#f5f0d9] font-medium text-[12px]",
};

function groupStyle(depth) {
  return GROUP_STYLES[depth] ?? "bg-[#efefef] font-medium text-[12px]";
}

// ---------------------------------------------------------------------------
// Creator popover
// ---------------------------------------------------------------------------

function CreatorPopover({ users, anchorRect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!anchorRect) return null;

  const GAP = 6;
  const W = 260;
  let left = anchorRect.left;
  let top = anchorRect.bottom + GAP;

  if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
  const maxH = 240;
  if (top + maxH > window.innerHeight - 8) top = anchorRect.top - maxH - GAP;

  return (
    <div
      ref={ref}
      className="fixed z-[99999] bg-white border border-[#b5b5b5] rounded-sm shadow-xl overflow-hidden"
      style={{ top, left, width: W }}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-[#f0f7ff] border-b border-[#c8d8ea]">
        <span className="text-[12px] font-semibold text-gray-700">Creator Users</span>
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-gray-200 transition text-gray-500 hover:text-gray-800"
        >
          <X size={12} />
        </button>
      </div>
      <div className="max-h-[200px] overflow-y-auto p-2 space-y-1">
        {users.length === 0 ? (
          <p className="text-[11px] text-gray-400 px-1">No users</p>
        ) : (
          users.map((u, i) => (
            <div
              key={i}
              className="px-2.5 py-1.5 bg-[#f5f9ff] border border-[#d0e4f7] rounded-sm text-[11px] text-gray-700"
            >
              {u.userName || u.loginUserName || "Unknown"}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Creator cell
// ---------------------------------------------------------------------------

function CreatorCell({ userIds, allUsers, onShowMore }) {
  const btnRef = useRef(null);
  const users = allUsers.filter((u) => userIds.includes(Number(u.id)));
  if (users.length === 0)
    return <span className="text-gray-300 text-[11px] px-2 py-1 block">—</span>;

  const visible = users.slice(0, 2);
  const extra = users.length - 2;

  return (
    <div className="px-2 py-1 flex items-center gap-1 min-h-[30px] flex-wrap">
      <span className="text-[11px] text-gray-700 truncate max-w-[110px]">
        {visible.map((u) => u.userName || u.loginUserName || "?").join(", ")}
      </span>
      {extra > 0 && (
        <button
          ref={btnRef}
          type="button"
          onClick={() => {
            const rect = btnRef.current?.getBoundingClientRect();
            if (rect) onShowMore(users, rect);
          }}
          className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-sm hover:bg-blue-200 border border-blue-200 shrink-0 transition-colors"
        >
          +{extra}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ApproverSection({ projectCode, projectData, refetchKey = 0 }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectUsers, setProjectUsers] = useState([]);
  // `${rowId}_${levelKey}` → [userId] | `${rowId}_creator` → [userId, ...]
  const [selectedUsers, setSelectedUsers] = useState({});
  // Per-row level counts: { [rowId]: number }
  const [rowLevels, setRowLevels] = useState(defaultRowLevels);
  const [creatorPopover, setCreatorPopover] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  // Max levels across all rows — drives column count
  const maxLevels = useMemo(() => {
    const vals = Object.values(rowLevels);
    return vals.length > 0 ? Math.max(1, ...vals) : 1;
  }, [rowLevels]);

  const levelKeys = useMemo(
    () => Array.from({ length: maxLevels }, (_, i) => `Level${i + 1}`),
    [maxLevels]
  );

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!projectCode) {
      setProjectUsers([]);
      setSelectedUsers({});
      setRowLevels(defaultRowLevels());
      return;
    }

    const load = async () => {
      setLoading(true);
      setSelectedUsers({});
      const enc = encodeURIComponent(projectCode);

      try {
        const [approvalRes, creatorRes, usersRes] = await Promise.all([
          apiRequest({
            url: `${API_ENDPOINTS.SETTINGS.APPROVAL_PATH.LIST}?projectCode=${enc}`,
            method: "GET",
          }).catch(() => null),
          apiRequest({
            url: `${API_ENDPOINTS.SETTINGS.APPROVAL_PATH.EDIT_USERS}?projectCode=${enc}`,
            method: "GET",
          }).catch(() => null),
          apiRequest({
            url: `${API_ENDPOINTS.SETTINGS.APPROVAL_PATH.GET_USERS_BY_PROJECT}?projectCode=${enc}`,
            method: "GET",
          }).catch(() => null),
        ]);

        setProjectUsers(Array.isArray(usersRes?.data) ? usersRes.data : []);

        const restored = {};
        const initRowLevels = defaultRowLevels();

        const approvalData = Array.isArray(approvalRes?.data)
          ? approvalRes.data[0]
          : approvalRes?.data;
        const modules = Array.isArray(approvalData?.modules) ? approvalData.modules : [];

        modules.forEach((mod) => {
          const rowId = MODULE_ROW_MAP[mod.moduleCode];
          if (!rowId) return;
          restored[`${rowId}_creator`] = (mod.creatorUsers || []).map((u) => Number(u.userId));
          (mod.approverUsers || []).forEach((u) => {
            restored[`${rowId}_Level${u.level}`] = [Number(u.userId)];
          });
          // Restore per-row level count from saved data
          const savedMaxLevel = Math.max(0, ...(mod.approverUsers || []).map((u) => Number(u.level)));
          if (savedMaxLevel > 0) initRowLevels[rowId] = Math.max(2, savedMaxLevel);
        });

        setRowLevels(initRowLevels);

        // Overwrite creator from edit-users (authoritative)
        const editUsersData = creatorRes?.data || {};
        Object.entries(editUsersData).forEach(([key, users]) => {
          const [moduleCode, permission] = key.split(".");
          if (permission !== "EDIT") return;
          const rowId = MODULE_ROW_MAP[moduleCode];
          if (!rowId) return;
          restored[`${rowId}_creator`] = Array.isArray(users)
            ? users.map((u) => Number(u.id))
            : [];
        });

        setSelectedUsers(restored);
      } catch {
        toast.error("Failed to load approval data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectCode, refetchKey]);

  // ---------------------------------------------------------------------------
  // Per-row level management
  // ---------------------------------------------------------------------------

  const addRowLevel = useCallback((rowId) => {
    setRowLevels((prev) => ({ ...prev, [rowId]: (prev[rowId] ?? 2) + 1 }));
  }, []);

  const removeRowLevel = useCallback((rowId) => {
    setRowLevels((prev) => {
      const cur = prev[rowId] ?? 2;
      if (cur <= 1) return prev;
      const lastKey = `${rowId}_Level${cur}`;
      setSelectedUsers((su) => {
        const updated = { ...su };
        delete updated[lastKey];
        return updated;
      });
      return { ...prev, [rowId]: cur - 1 };
    });
  }, []);

  const handleLevelChange = useCallback((rowId, levelKey, value) => {
    setSelectedUsers((prev) => ({
      ...prev,
      [`${rowId}_${levelKey}`]: value ? [Number(value)] : [],
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const buildPayload = () => {
    const modules = LEAF_ROWS
      .map((row) => {
        const rowLevelCount = rowLevels[row.rowId] ?? 2;
        const approverUsers = Array.from({ length: rowLevelCount }, (_, i) => {
          const lk = `Level${i + 1}`;
          const val = selectedUsers[`${row.rowId}_${lk}`];
          const userId = Array.isArray(val) ? val[0] : val;
          return userId ? { userId: Number(userId), level: i + 1 } : null;
        }).filter(Boolean);

        const rawCreators = selectedUsers[`${row.rowId}_creator`] || [];
        const creatorUsers = [...new Set(rawCreators.map(Number))].map((id) => ({ userId: id }));

        return { moduleCode: row.moduleCode, creatorUsers, approverUsers };
      })
      .filter((m) => m.creatorUsers.length > 0 || m.approverUsers.length > 0);

    return { projectCode, modules };
  };

  const handleSaveRequest = () => {
    if (!projectCode) { toast.error("No project selected"); return; }
    const payload = buildPayload();
    if (payload.modules.length === 0) {
      toast.error("Please assign at least one approver");
      return;
    }
    setConfirmSave(true);
  };

  const handleSaveConfirmed = async () => {
    setConfirmSave(false);
    const payload = buildPayload();
    let tid;
    try {
      setSaving(true);
      tid = toast.loading("Saving approval path...");
      await apiRequest({
        url: API_ENDPOINTS.SETTINGS.APPROVAL_PATH.SAVE,
        method: "POST",
        data: payload,
      });
      toast.success("Approval path saved", { id: tid });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save", { id: tid });
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // User options
  // ---------------------------------------------------------------------------

  const userOptions = useMemo(
    () =>
      projectUsers.map((u) => ({
        id: String(u.id),
        userName: u.userName || u.loginUserName || "User",
      })),
    [projectUsers]
  );

  const disabled = loading || saving;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">Save Approval Path</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              Are you sure you want to save the approval path for{" "}
              <span className="font-semibold text-black">
                {projectData?.projectName || projectCode}
              </span>
              ? This will overwrite the existing configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px] h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveConfirmed}
              className="text-[12px] h-8 bg-blue-600 hover:bg-blue-700"
            >
              Yes, Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {creatorPopover && (
        <CreatorPopover
          users={creatorPopover.users}
          anchorRect={creatorPopover.anchorRect}
          onClose={() => setCreatorPopover(null)}
        />
      )}

      <div className="mt-4 border border-[#b5b5b5] rounded-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#d6e6f2] border-b border-[#b5b5b5] px-3 py-1.5">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left py-0.5 select-none"
          >
            <Users size={14} className="text-blue-700 shrink-0" />
            <span className="font-semibold text-[13px] text-gray-800 shrink-0">Approval Path</span>
            {projectData?.projectName && (
              <span className="text-[11px] text-gray-500 font-normal truncate hidden sm:inline">
                — {projectData.projectName}
              </span>
            )}
            {collapsed
              ? <ChevronDown size={13} className="text-gray-500 shrink-0 ml-1" />
              : <ChevronUp size={13} className="text-gray-500 shrink-0 ml-1" />
            }
          </button>

          <div
            className="flex items-center gap-1.5 ml-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleSaveRequest}
              disabled={disabled}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 transition-colors border border-blue-700"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
              <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </div>

        {collapsed && (
          <div className="px-3 py-1.5 text-[11px] text-gray-400 bg-[#fafafa]">
            Per-module levels
            {projectUsers.length > 0 && ` · ${projectUsers.length} users`}
            {" — click title to expand"}
          </div>
        )}

        {!collapsed && (
          <div className="bg-white">
            <div className="px-3 py-1 border-b border-[#ececec] bg-[#f7f7f7] text-[11px] text-gray-400">
              Use <Plus size={9} className="inline mx-0.5" /> / <Minus size={9} className="inline mx-0.5" /> per row to set each module&apos;s level count
              {projectUsers.length > 0 && ` · ${projectUsers.length} project users`}
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-[100px] gap-2 text-[12px] text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                Loading approval data...
              </div>
            ) : (
              <div
                className="overflow-auto"
                style={{ maxHeight: "calc(100vh - 340px)" }}
              >
                <table
                  className="w-full border-collapse text-[12px]"
                  style={{ minWidth: `${240 + 160 + maxLevels * 155 + 72}px` }}
                >
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#d9d9d9]">
                      <th
                        className="border border-[#b5b5b5] px-3 py-1.5 text-left font-semibold"
                        style={{ minWidth: 240 }}
                      >
                        Module / Sub Module
                      </th>
                      <th
                        className="border border-[#b5b5b5] px-2 py-1.5 text-center font-semibold"
                        style={{ minWidth: 160 }}
                      >
                        Creator
                      </th>
                      {levelKeys.map((lk) => (
                        <th
                          key={lk}
                          className="border border-[#b5b5b5] px-2 py-1.5 text-center font-semibold"
                          style={{ minWidth: 155 }}
                        >
                          {lk}
                        </th>
                      ))}
                      <th
                        className="border border-[#b5b5b5] px-1 py-1.5 text-center font-semibold"
                        style={{ minWidth: 72 }}
                        title="Add or remove levels per module"
                      >
                        Levels
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {ALL_ROWS.map((row) => {
                      const isGroup = !row.isLeaf;
                      const gStyle = isGroup ? groupStyle(row.depth) : "";
                      const rowLevelCount = rowLevels[row.rowId] ?? 2;

                      return (
                        <tr key={row.rowId}>
                          {/* Module name */}
                          <td
                            className={`border border-[#b5b5b5] py-1.5 ${
                              isGroup ? gStyle : "bg-white text-gray-800 text-[12px]"
                            }`}
                            style={{ paddingLeft: `${8 + row.depth * 14}px` }}
                          >
                            <span className="text-gray-500 mr-1 text-[10px] font-normal">
                              {row.serialNo}.
                            </span>
                            {row.title}
                          </td>

                          {/* Creator */}
                          <td
                            className={`border border-[#b5b5b5] ${
                              isGroup ? gStyle : "bg-[#f9fafb]"
                            }`}
                          >
                            {row.isLeaf && (
                              <CreatorCell
                                userIds={selectedUsers[`${row.rowId}_creator`] || []}
                                allUsers={projectUsers}
                                onShowMore={(users, anchorRect) =>
                                  setCreatorPopover({ users, anchorRect })
                                }
                              />
                            )}
                          </td>

                          {/* Level columns */}
                          {levelKeys.map((lk, colIdx) => {
                            const colLevelNum = colIdx + 1;
                            const isActiveForRow = row.isLeaf && colLevelNum <= rowLevelCount;
                            const val = selectedUsers[`${row.rowId}_${lk}`];
                            const currentVal =
                              Array.isArray(val) && val[0] ? String(val[0]) : "";

                            return (
                              <td
                                key={lk}
                                className={`border border-[#b5b5b5] p-0 ${
                                  isGroup
                                    ? gStyle
                                    : !isActiveForRow
                                    ? "bg-[#f3f3f3]"
                                    : ""
                                }`}
                              >
                                {isActiveForRow && (
                                  <SearchableSelect
                                    options={userOptions}
                                    value={currentVal}
                                    onChange={(v) => handleLevelChange(row.rowId, lk, v)}
                                    disabled={disabled}
                                    placeholder="— select —"
                                    clearLabel="— select —"
                                    labelKey="userName"
                                    valueKey="id"
                                    searchKeys={["userName"]}
                                    className="rounded-none"
                                  />
                                )}
                              </td>
                            );
                          })}

                          {/* Per-row level controls */}
                          <td
                            className={`border border-[#b5b5b5] px-1 py-0.5 ${
                              isGroup ? gStyle : "bg-[#fafafa]"
                            }`}
                          >
                            {row.isLeaf && (
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => removeRowLevel(row.rowId)}
                                  disabled={disabled || rowLevelCount <= 1}
                                  title="Remove last level"
                                  className="w-5 h-5 flex items-center justify-center rounded-sm border border-[#c0c0c0] bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
                                >
                                  <Minus size={9} />
                                </button>
                                <span className="text-[10px] text-gray-600 w-4 text-center font-medium select-none">
                                  {rowLevelCount}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addRowLevel(row.rowId)}
                                  disabled={disabled}
                                  title="Add level"
                                  className="w-5 h-5 flex items-center justify-center rounded-sm border border-[#c0c0c0] bg-white hover:bg-gray-100 disabled:opacity-30 transition-colors text-gray-600"
                                >
                                  <Plus size={9} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
