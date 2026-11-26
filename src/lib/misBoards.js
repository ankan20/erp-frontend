// MIS — Boards (Azure Boards style, Scrum): API helpers + shared styles.
//   Epic → Feature → PBI / Bug → Task. Tasks are the same rows as Self Task.
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { emitTasksChanged } from "@/lib/misTasks";

const W = API_ENDPOINTS.MIS.WORK_ITEMS;
const S = API_ENDPOINTS.MIS.SPRINTS;

export const WI_TYPES = ["Epic", "Feature", "PBI", "Bug", "Task"];
// Construction names shown to users. The keys (Epic, Feature, PBI, Bug, Task) are what the server
// stores — change only the right-hand side to rename a level everywhere on the web.
export const TYPE_LABEL = { Epic: "Phase", Feature: "Work Package", PBI: "Activity", Bug: "Snag", Task: "Task" };
export const TYPE_PLURAL = { Epic: "Phases", Feature: "Work Packages", PBI: "Activities", Bug: "Snags", Task: "Tasks" };
export const typeLabel = (t) => TYPE_LABEL[t] || t;
export const typePlural = (t) => TYPE_PLURAL[t] || `${t}s`;
export const TEAM_TYPES = ["Epic", "Feature", "PBI", "Bug"];
export const SPRINT_TYPES_OK = ["PBI", "Bug", "Task"];
export const POINT_TYPES = ["PBI", "Bug"];
export const WI_STATES = {
  Epic: ["New", "In Progress", "Done", "Removed"],
  Feature: ["New", "In Progress", "Done", "Removed"],
  PBI: ["New", "Approved", "Committed", "Done", "Removed"],
  Bug: ["New", "Approved", "Committed", "Done", "Removed"],
  Task: ["To Do", "In Progress", "On Hold", "Done", "Cancelled"],
};
export const PARENT_TYPES = { Epic: [], Feature: ["Epic"], PBI: ["Feature"], Bug: ["Feature"], Task: ["PBI", "Bug"] };
// which type a "+ child" button creates under each parent type
export const CHILD_TYPE = { Epic: "Feature", Feature: "PBI", PBI: "Task", Bug: "Task", Task: null };
export const CLOSED_STATES = ["Done", "Removed", "Cancelled"];

// Azure-like colours: Epic orange, Feature purple, PBI blue, Bug red, Task yellow
export const TYPE_STYLE = {
  Epic: { badge: "bg-orange-100 text-orange-700 border-orange-200", bar: "border-l-orange-500", dot: "bg-orange-500" },
  Feature: { badge: "bg-violet-100 text-violet-700 border-violet-200", bar: "border-l-violet-500", dot: "bg-violet-500" },
  PBI: { badge: "bg-sky-100 text-sky-700 border-sky-200", bar: "border-l-sky-500", dot: "bg-sky-500" },
  Bug: { badge: "bg-red-100 text-red-700 border-red-200", bar: "border-l-red-500", dot: "bg-red-500" },
  Task: { badge: "bg-amber-100 text-amber-800 border-amber-200", bar: "border-l-amber-400", dot: "bg-amber-400" },
};
export const STATE_STYLE = {
  New: "bg-gray-100 text-gray-700 border-gray-200",
  Approved: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Committed: "bg-blue-100 text-blue-700 border-blue-200",
  "To Do": "bg-gray-100 text-gray-700 border-gray-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  "On Hold": "bg-amber-50 text-amber-700 border-amber-200",
  Done: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Removed: "bg-gray-50 text-gray-400 border-gray-200",
  Cancelled: "bg-gray-50 text-gray-400 border-gray-200",
};

const clean = (o) =>
  Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

// every mutation pings open lists (same event as Self Task / Follow-ups)
const mutate = async (p) => {
  const r = await apiRequest(p);
  emitTasksChanged();
  return r;
};
const one = (id, path = "") => `${W.ONE}${id}${path}`;

export const workItemApi = {
  access: () => apiRequest({ url: W.ACCESS }),
  team: (projectCode, search) => apiRequest({ url: `${W.LIST}/team`, params: clean({ projectCode, search }) }),
  assignable: (projectCode, type) => apiRequest({ url: W.ASSIGNABLE, params: clean({ projectCode, type }) }),
  list: (params) => apiRequest({ url: W.LIST, params: clean(params) }),
  tree: (params) => apiRequest({ url: W.TREE, params: clean(params) }),
  get: (id) => apiRequest({ url: one(id) }),
  getByUuid: (uuid) => apiRequest({ url: `${W.BY_UUID}${uuid}` }),
  create: (data) => mutate({ url: W.LIST, method: "POST", data }),
  update: (id, data) => mutate({ url: one(id), method: "PUT", data }),
  setState: (id, state, comment) => mutate({ url: one(id, "/state"), method: "PATCH", data: clean({ state, comment }) }),
  remove: (id) => mutate({ url: one(id), method: "DELETE" }),
  comment: (id, comment, mentions = []) => apiRequest({ url: one(id, "/comments"), method: "POST", data: { comment, mentions } }),
  addLink: (id, data) => apiRequest({ url: one(id, "/links"), method: "POST", data }),
  removeLink: (id, linkId) => apiRequest({ url: one(id, `/links/${linkId}`), method: "DELETE" }),
  linked: (params) => apiRequest({ url: W.LINKED, params: clean(params) }),
  reorder: (itemId, { afterId, beforeId }) => mutate({ url: W.REORDER, method: "POST", data: clean({ itemId, afterId, beforeId }) }),
  bulk: (ids, changes) => mutate({ url: W.BULK, method: "POST", data: { ids, changes } }),
  velocity: (projectCode, count) => apiRequest({ url: W.VELOCITY, params: clean({ projectCode, count }) }),
  kanban: (projectCode, level) => apiRequest({ url: W.KANBAN, params: clean({ projectCode, level }) }),
  boardConfig: (projectCode, level) => apiRequest({ url: W.BOARD_CONFIG, params: clean({ projectCode, level }) }),
  saveBoardConfig: (data) => mutate({ url: W.BOARD_CONFIG, method: "PUT", data }),
  boardMove: (id, data) => mutate({ url: one(id, "/board-move"), method: "POST", data }),
  queries: (projectCode) => apiRequest({ url: W.QUERIES, params: clean({ projectCode }) }),
  saveQuery: (data, id) => apiRequest({ url: id ? `${W.QUERIES}/${id}` : W.QUERIES, method: id ? "PUT" : "POST", data }),
  deleteQuery: (id) => apiRequest({ url: `${W.QUERIES}/${id}`, method: "DELETE" }),
};

export const boardsSprintApi = {
  capacity: (id) => apiRequest({ url: `${S.ONE}${id}/capacity` }),
  setCapacity: (id, members) => mutate({ url: `${S.ONE}${id}/capacity`, method: "PUT", data: { members } }),
  burndown: (id) => apiRequest({ url: `${S.ONE}${id}/burndown` }),
  standup: (id) => apiRequest({ url: `${S.ONE}${id}/standup` }),
  retro: (id) => apiRequest({ url: `${S.ONE}${id}/retro` }),
  retroAdd: (id, category, text) => apiRequest({ url: `${S.ONE}${id}/retro`, method: "POST", data: { category, text } }),
  retroDelete: (id, itemId) => apiRequest({ url: `${S.ONE}${id}/retro/${itemId}`, method: "DELETE" }),
  retroToBacklog: (id, itemId) => mutate({ url: `${S.ONE}${id}/retro/${itemId}/to-backlog`, method: "POST", data: {} }),
};

/** Flatten a tree into visible rows (respecting collapsed ids) with depth. */
export function flattenTree(nodes, collapsed, depth = 0, out = []) {
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.children?.length && !collapsed.has(n.id)) flattenTree(n.children, collapsed, depth + 1, out);
  }
  return out;
}

/** Sum story points of PBIs/Bugs in a list (planning bars). */
export const sumPoints = (items) => items.reduce((a, i) => a + (POINT_TYPES.includes(i.workItemType) ? i.storyPoints || 0 : 0), 0);

export const TASKBOARD_COLUMNS = ["To Do", "In Progress", "On Hold", "Done"];
export const KANBAN_LEVELS = [
  { id: "PBI", label: "Activities & Snags" },
  { id: "Feature", label: "Work Packages" },
  { id: "Epic", label: "Phases" },
];
