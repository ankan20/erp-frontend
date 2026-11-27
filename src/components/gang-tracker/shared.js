// Shared bits for the Gang Tracker conversation views.

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function initials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

// one stable colour per person id — used for avatars AND their lane in the history graph
export const LANE_COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#dc2626", "#4f46e5"];
export function personColor(id) {
  return LANE_COLORS[(Number(id) || 0) % LANE_COLORS.length];
}

export const THREAD_STATUSES = ["Ongoing", "Scheduled", "Waiting", "Done", "Dropped"];
export const THREAD_STATUS_STYLE = {
  Ongoing:   { cls: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-500",    hint: "Talk in progress" },
  Scheduled: { cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500",   hint: "Next talk fixed" },
  Waiting:   { cls: "bg-violet-50 text-violet-700 border-violet-200",    dot: "bg-violet-500",  hint: "Waiting on someone" },
  Done:      { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", hint: "Finished" },
  Dropped:   { cls: "bg-gray-100 text-gray-500 border-gray-200",         dot: "bg-gray-400",    hint: "Closed without result" },
};
export const isClosed = (s) => s === "Done" || s === "Dropped";

export const inputCls =
  "border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full bg-white";
