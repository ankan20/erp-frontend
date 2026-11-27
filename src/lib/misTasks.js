// MIS — Self Task: API helpers + shared constants/styles.
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const T = API_ENDPOINTS.MIS.TASKS;

export const TASK_STATUSES = ["To Do", "In Progress", "On Hold", "Done", "Cancelled"];
export const OPEN_STATUSES = ["To Do", "In Progress", "On Hold"];
export const BOARD_COLUMNS = ["To Do", "In Progress", "On Hold", "Done"];
// Keep in step with TASK_PRIORITIES in erp_backend app/models/misTask.py
export const TASK_PRIORITIES = ["Immediate", "Scheduled"];
export const DEFAULT_PRIORITY = "Scheduled";

export const STATUS_STYLE = {
  "To Do":       "bg-gray-100 text-gray-700 border-gray-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  "On Hold":     "bg-amber-100 text-amber-700 border-amber-200",
  Done:          "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled:     "bg-red-100 text-red-600 border-red-200",
};
export const STATUS_DOT = {
  "To Do": "bg-gray-400", "In Progress": "bg-blue-500", "On Hold": "bg-amber-500",
  Done: "bg-emerald-500", Cancelled: "bg-red-400",
};
export const PRIORITY_STYLE = {
  Immediate: "bg-red-50 text-red-700 border-red-200",
  Scheduled: "bg-sky-50 text-sky-700 border-sky-200",
};
export const PRIORITY_STRIPE = {
  Immediate: "border-l-red-500", Scheduled: "border-l-sky-400",
};

// Any task create/update/delete fires this so the FAB badge and open lists refresh.
export const TASKS_CHANGED = "erp:tasks-changed";
export const emitTasksChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TASKS_CHANGED));
};

export const currentProject = () => {
  try {
    const p = getLocalStorage("projectInfo");
    const obj = typeof p === "string" ? JSON.parse(p) : p;
    return obj?.projectCode ? { code: obj.projectCode, name: obj.projectName || obj.projectCode } : null;
  } catch {
    return null;
  }
};

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}-${m}-${y}` : iso;
};

export const fmtDateTime = (iso) => {
  if (!iso) return "";
  const dt = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const clean = (o) =>
  Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

const mutate = async (p) => {
  const r = await apiRequest(p);
  emitTasksChanged();
  return r;
};

export const misTaskApi = {
  list: (params) => apiRequest({ url: T.LIST, params: clean(params) }),
  stats: (params) => apiRequest({ url: T.STATS, params: clean(params) }),
  access: () => apiRequest({ url: T.ACCESS }),
  assignable: (projectCode, purpose) => apiRequest({ url: T.ASSIGNABLE, params: clean({ projectCode, purpose }) }),
  owners: () => apiRequest({ url: T.OWNERS }),
  get: (id) => apiRequest({ url: `${T.ONE}${id}` }),
  getByUuid: (uuid) => apiRequest({ url: `${T.BY_UUID}${uuid}` }),
  create: (data) => mutate({ url: T.CREATE, method: "POST", data }),
  update: (id, data) => mutate({ url: `${T.ONE}${id}`, method: "PUT", data }),
  setStatus: (id, status, comment) =>
    mutate({ url: `${T.ONE}${id}/status`, method: "PATCH", data: clean({ status, comment }) }),
  comment: (id, comment) => apiRequest({ url: `${T.ONE}${id}/comments`, method: "POST", data: { comment } }),
  remove: (id) => mutate({ url: `${T.ONE}${id}`, method: "DELETE" }),
  // work timer + lock
  start: (id) => mutate({ url: `${T.ONE}${id}/start`, method: "POST" }),
  requestReopen: (id, reason) => mutate({ url: `${T.ONE}${id}/reopen-request`, method: "POST", data: { reason } }),
  reopen: (id, note) => mutate({ url: `${T.ONE}${id}/reopen`, method: "POST", data: clean({ note }) }),
  reopenRequests: (scope = "decide") => apiRequest({ url: `${T.LIST}/reopen-requests`, params: { scope } }),
  decideReopen: (rid, approve, note) =>
    mutate({ url: `${T.LIST}/reopen-requests/${rid}/decide`, method: "POST", data: clean({ approve, note }) }),
};

// ── work timer helpers ──
/** Seconds worked, ticking live while the clock runs (pass `now` from a ticking state). */
export const liveSeconds = (t, now = Date.now()) => {
  const base = Number(t?.workedSeconds) || 0;
  if (!t?.isRunning || !t?.runStartedAt) return base;
  // workedSeconds from the API already includes the running part up to the response time
  const fetched = t._fetchedAt || now;
  return base + Math.max(0, Math.floor((now - fetched) / 1000));
};

/** 5400 → "1h 30m", 45 → "0m", 90061 → "25h 1m" */
export const fmtDuration = (sec) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

/** Stamp list/detail rows with the time they were fetched, so live timers count from there. */
export const stampFetched = (rows) => {
  const at = Date.now();
  return Array.isArray(rows) ? rows.map((r) => ({ ...r, _fetchedAt: at })) : rows ? { ...rows, _fetchedAt: at } : rows;
};

/** "2026-12-01" + "17:45" → "01-12-2026 17:45" */
export const fmtDateTimeParts = (d, t) => (d ? `${fmtDate(d)}${t ? ` ${t}` : ""}` : "—");
