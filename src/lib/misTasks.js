// MIS — Self Task: API helpers + shared constants/styles.
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const T = API_ENDPOINTS.MIS.TASKS;

export const TASK_STATUSES = ["To Do", "In Progress", "On Hold", "Done", "Cancelled"];
export const OPEN_STATUSES = ["To Do", "In Progress", "On Hold"];
export const BOARD_COLUMNS = ["To Do", "In Progress", "On Hold", "Done"];
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];

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
  Low:      "bg-gray-50 text-gray-600 border-gray-200",
  Medium:   "bg-sky-50 text-sky-700 border-sky-200",
  High:     "bg-orange-50 text-orange-700 border-orange-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};
export const PRIORITY_STRIPE = {
  Low: "border-l-gray-300", Medium: "border-l-sky-400", High: "border-l-orange-400", Critical: "border-l-red-500",
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
  assignable: (projectCode) => apiRequest({ url: T.ASSIGNABLE, params: clean({ projectCode }) }),
  owners: () => apiRequest({ url: T.OWNERS }),
  get: (id) => apiRequest({ url: `${T.ONE}${id}` }),
  getByUuid: (uuid) => apiRequest({ url: `${T.BY_UUID}${uuid}` }),
  create: (data) => mutate({ url: T.CREATE, method: "POST", data }),
  update: (id, data) => mutate({ url: `${T.ONE}${id}`, method: "PUT", data }),
  setStatus: (id, status, comment) =>
    mutate({ url: `${T.ONE}${id}/status`, method: "PATCH", data: clean({ status, comment }) }),
  comment: (id, comment) => apiRequest({ url: `${T.ONE}${id}/comments`, method: "POST", data: { comment } }),
  remove: (id) => mutate({ url: `${T.ONE}${id}`, method: "DELETE" }),
};
