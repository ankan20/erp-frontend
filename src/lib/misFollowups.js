// MIS — Follow-up board (sprints → agendas → relay steps): API helpers + shared styles.
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { emitTasksChanged } from "@/lib/misTasks";

const S = API_ENDPOINTS.MIS.SPRINTS;
const F = API_ENDPOINTS.MIS.FOLLOWUPS;

export const BOARD_COLUMNS = ["To Do", "In Progress", "Review", "Done"];
export const FU_PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const SPRINT_TYPES = ["Weekly", "Monthly"];

export const BOARD_DOT = {
  Backlog: "bg-gray-300", "To Do": "bg-gray-400", "In Progress": "bg-blue-500", Review: "bg-violet-500", Done: "bg-emerald-500",
};
export const BOARD_STYLE = {
  Backlog: "bg-gray-50 text-gray-600 border-gray-200",
  "To Do": "bg-gray-100 text-gray-700 border-gray-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Review: "bg-violet-100 text-violet-700 border-violet-200",
  Done: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
export const STEP_STYLE = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
  Reassigned: "bg-gray-50 text-gray-500 border-gray-200",
  Cancelled: "bg-gray-50 text-gray-400 border-gray-200",
};
export const SPRINT_STYLE = {
  Planned: "bg-gray-100 text-gray-700 border-gray-200",
  Active: "bg-blue-100 text-blue-700 border-blue-200",
  Closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// avatar initials + a stable colour per person (same idea as the gang tracker page)
const AVATAR_BG = ["bg-blue-700", "bg-indigo-600", "bg-violet-600", "bg-emerald-600", "bg-orange-500", "bg-teal-600", "bg-rose-600", "bg-sky-700"];
export const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
export const avatarBg = (id) => AVATAR_BG[Math.abs(Number(id) || 0) % AVATAR_BG.length];

const clean = (o) =>
  Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

// every mutation pings the FAB / open lists (same event as tasks)
const mutate = async (p) => {
  const r = await apiRequest(p);
  emitTasksChanged();
  return r;
};

export const sprintApi = {
  list: (params) => apiRequest({ url: S.LIST, params: clean(params) }),
  get: (id) => apiRequest({ url: `${S.ONE}${id}` }),
  create: (data) => mutate({ url: S.LIST, method: "POST", data }),
  update: (id, data) => mutate({ url: `${S.ONE}${id}`, method: "PUT", data }),
  remove: (id) => mutate({ url: `${S.ONE}${id}`, method: "DELETE" }),
  start: (id) => mutate({ url: `${S.ONE}${id}/start`, method: "POST" }),
  close: (id, moveTo) => mutate({ url: `${S.ONE}${id}/close`, method: "POST", data: { moveTo } }),
  report: (id) => apiRequest({ url: `${S.ONE}${id}/report` }),
};

const one = (id, path = "") => `${F.ONE}${id}${path}`;

export const followupApi = {
  list: (params) => apiRequest({ url: F.LIST, params: clean(params) }),
  stats: () => apiRequest({ url: F.STATS }),
  access: () => apiRequest({ url: F.ACCESS }),
  assignable: (projectCode) => apiRequest({ url: F.ASSIGNABLE, params: clean({ projectCode }) }),
  get: (id) => apiRequest({ url: one(id) }),
  getByUuid: (uuid) => apiRequest({ url: `${F.BY_UUID}${uuid}` }),
  create: (data) => mutate({ url: F.LIST, method: "POST", data }),
  update: (id, data) => mutate({ url: one(id), method: "PUT", data }),
  remove: (id) => mutate({ url: one(id), method: "DELETE" }),
  setBoardStatus: (id, boardStatus, note) => mutate({ url: one(id, "/board-status"), method: "PATCH", data: clean({ boardStatus, note }) }),
  moveSprint: (id, sprintId) => mutate({ url: one(id, "/move-sprint"), method: "PATCH", data: { sprintId: sprintId ?? null } }),
  comment: (id, comment) => apiRequest({ url: one(id, "/comments"), method: "POST", data: { comment } }),
  assign: (id, data) => mutate({ url: one(id, "/assign"), method: "POST", data: clean(data) }),
  start: (id) => mutate({ url: one(id, "/start"), method: "POST" }),
  handoff: (id, data) => mutate({ url: one(id, "/handoff"), method: "POST", data: clean(data) }),
  returnToSupervisor: (id, note) => mutate({ url: one(id, "/return"), method: "POST", data: clean({ note }) }),
  close: (id, note) => mutate({ url: one(id, "/close"), method: "POST", data: clean({ note }) }),
  reject: (id, data) => mutate({ url: one(id, "/reject"), method: "POST", data: clean(data) }),
};

/** Can this user supervise (create / manage) in a project? access = /followups/access response. */
export const canSuperviseIn = (access, projectCode) => {
  if (!access) return false;
  if (access.isSuperAdmin) return true;
  if (!projectCode || projectCode === "company") return !!access.canSuperviseCompany;
  return (access.superviseProjects || []).includes(projectCode);
};
