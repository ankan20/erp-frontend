"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, LayoutGrid, List as ListIcon, Loader2, Search, RefreshCw, ChevronLeft, ChevronRight, Play, Check, Lock, Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import { getCookie } from "@/lib/cookies";
import SearchableSelect from "@/components/common/SearchableSelect";
import TaskBoard from "./TaskBoard";
import TaskFormDialog from "./TaskFormDialog";
import TaskDetailSheet from "./TaskDetailSheet";
import TaskTimer, { useTick } from "./TaskTimer";
import ReopenRequestsDialog from "./ReopenRequestsDialog";
import {
  misTaskApi, TASK_STATUSES, TASK_PRIORITIES, STATUS_STYLE, PRIORITY_STYLE, TASKS_CHANGED,
  currentProject, fmtDateTimeParts, stampFetched,
} from "@/lib/misTasks";

const PER_PAGE = 50;
const BOARD_LIMIT = 200;

const SCOPES = [
  { id: "mine", label: "My Tasks" },
  { id: "assigned_by_me", label: "Assigned by Me" },
  { id: "my_all", label: "All Tasks" },               // my tasks + tasks I gave to others
  { id: "team", label: "Team Tasks", needsView: true },
];

const readPref = (k, d) => { try { return sessionStorage.getItem(k) || d; } catch { return d; } };
const writePref = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };

/**
 * The whole Self Task screen. Reused by My Profile with lockScope="mine".
 *   lockScope — show only that scope (no scope tabs)
 *   compact   — hide KPI cards
 */
export default function SelfTaskView({ lockScope = null, compact = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const myId = Number(getCookie("userId")) || null;

  const [access, setAccess] = useState({ isSuperAdmin: false, canViewOthers: false, canEditOthers: false });
  const [scope, setScope] = useState(lockScope || "mine");
  const [view, setView] = useState("list");
  const [filters, setFilters] = useState({ search: "", status: "", priority: "", ownerUserId: "", projectCode: "", overdue: false });
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [stats, setStats] = useState(null);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);

  // remembered list/board choice (per tab session)
  useEffect(() => { setView(readPref("mis-task-view", "list")); }, []);
  const changeView = (v) => { setView(v); writePref("mis-task-view", v); };

  useEffect(() => {
    misTaskApi.access().then((r) => r?.data && setAccess(r.data)).catch(() => {});
  }, []);

  const teamAllowed = access.isSuperAdmin || access.canViewOthers;
  useEffect(() => {
    if (!teamAllowed || lockScope) return;
    misTaskApi.owners().then((r) => setOwners((r?.data || []).map((u) => ({
      value: String(u.id), label: u.empCode ? `${u.name} (${u.empCode})` : u.name,
    })))).catch(() => {});
  }, [teamAllowed, lockScope]);

  // open a task straight from a link: ?task=<uuid>
  useEffect(() => {
    const uuid = searchParams?.get("task");
    if (!uuid) return;
    misTaskApi.getByUuid(uuid).then((r) => r?.data?.id && setOpenId(r.data.id)).catch(() => {});
  }, [searchParams]);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText })), 350);
    return () => clearTimeout(t);
  }, [searchText]);
  useEffect(() => { setPage(1); }, [filters, scope, view]);

  const apiScope = scope === "team" && access.isSuperAdmin ? "all" : scope;

  const query = useMemo(() => ({
    scope: apiScope,
    search: filters.search,
    status: view === "board" ? "" : filters.status,
    priority: filters.priority,
    ownerUserId: scope === "team" ? filters.ownerUserId : "",
    projectCode: filters.projectCode,
    overdue: filters.overdue ? "1" : "",
    page: view === "board" ? 1 : page,
    perPage: view === "board" ? BOARD_LIMIT : PER_PAGE,
  }), [apiScope, filters, scope, view, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        misTaskApi.list(query),
        compact ? Promise.resolve(null) : misTaskApi.stats({ scope: apiScope, projectCode: filters.projectCode }),
      ]);
      const d = l?.data || { items: [], total: 0 };
      setData({ ...d, items: stampFetched(d.items || []) });
      if (s?.data) setStats(s.data);
    } catch (e) {
      setData({ items: [], total: 0 });
      if (!/permission/i.test(e?.message || "")) toast.error(e?.message || "Could not load tasks");
    } finally {
      setLoading(false);
    }
  }, [query, apiScope, filters.projectCode, compact]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener(TASKS_CHANGED, h);
    return () => window.removeEventListener(TASKS_CHANGED, h);
  }, [load]);

  const canEditTask = useCallback(
    (t) => access.isSuperAdmin || access.canEditOthers || t.ownerUserId === myId || t.createdBy === myId,
    [access, myId],
  );

  const moveTask = async (task, status) => {
    if (status === "Done" && !window.confirm(`Mark ${task.taskCode} Done?\n\nThe clock stops and the task is locked.`)) return;
    // optimistic: move the card now, undo on error
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === task.id ? { ...x, status } : x)) }));
    try {
      if (status === "In Progress") await misTaskApi.start(task.id);
      else await misTaskApi.setStatus(task.id, status);
      toast.success(status === "In Progress" ? `${task.taskCode} started — time is being measured` : `${task.taskCode} → ${status}`);
    } catch (e) {
      toast.error(e?.message || "Could not move task");
      load();
    }
  };

  // live timers + reopen requests waiting for me
  const now = useTick(data.items.some((t) => t.isRunning));
  const [reqOpen, setReqOpen] = useState(false);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t) => { setOpenId(null); setEditing(t); setFormOpen(true); };

  const cp = currentProject();
  const projectOptions = [
    { value: "", label: "All projects" },
    { value: "company", label: "Company (no project)" },
    ...(cp ? [{ value: cp.code, label: `${cp.code} : ${cp.name}` }] : []),
  ];

  const scopes = lockScope ? [] : SCOPES.filter((s) => !s.needsView || teamAllowed);
  const pages = Math.max(1, Math.ceil((data.total || 0) / PER_PAGE));
  const showOwner = scope !== "mine";

  const selectCls = "border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-4">
      {/* reopen requests waiting for me (higher level) */}
      {stats?.reopenToDecide > 0 && (
        <button onClick={() => setReqOpen(true)}
          className="w-full flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-left text-sm text-amber-900 hover:bg-amber-100">
          <Hourglass size={15} /> <b>{stats.reopenToDecide}</b> reopen request{stats.reopenToDecide > 1 ? "s" : ""} waiting for your decision
          <span className="ml-auto text-xs font-semibold underline">Review</span>
        </button>
      )}

      {/* KPI cards */}
      {!compact && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "To Do", value: stats?.byStatus?.["To Do"], color: "text-gray-700", f: { status: "To Do", overdue: false } },
            { label: "In Progress", value: stats?.byStatus?.["In Progress"], color: "text-blue-700", f: { status: "In Progress", overdue: false } },
            { label: "Overdue", value: stats?.overdue, color: "text-red-600", f: { status: "", overdue: true } },
            { label: "Due Today", value: stats?.dueToday, color: "text-amber-600", f: null },
            { label: "Done This Week", value: stats?.doneThisWeek, color: "text-emerald-600", f: { status: "Done", overdue: false } },
          ].map((k) => (
            <button key={k.label} type="button" disabled={!k.f}
              onClick={() => k.f && setFilters((f) => ({ ...f, ...k.f }))}
              className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition disabled:hover:border-gray-200 disabled:cursor-default">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value ?? (loading ? "…" : 0)}</p>
            </button>
          ))}
        </div>
      )}

      {/* scope tabs + view toggle + new */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200">
        <div className="flex gap-0">
          {scopes.map((s) => (
            <button key={s.id} onClick={() => setScope(s.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${scope === s.id
                ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {s.label}{s.id === "team" && access.isSuperAdmin ? " (All)" : ""}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          <div className="flex rounded-md border border-gray-300 overflow-hidden" role="group" aria-label="View">
            <button onClick={() => changeView("list")} aria-pressed={view === "list"} title="List"
              className={`px-2.5 py-1.5 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <ListIcon size={15} />
            </button>
            <button onClick={() => changeView("board")} aria-pressed={view === "board"} title="Board"
              className={`px-2.5 py-1.5 border-l border-gray-300 ${view === "board" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <LayoutGrid size={15} />
            </button>
          </div>
          <button onClick={load} title="Refresh" aria-label="Refresh"
            className="p-2 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button data-shortcut="create" onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700">
            <Plus size={15} /> New Task
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input data-shortcut="search" type="text" placeholder="Search title / code…" value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="border border-gray-300 rounded-md pl-8 pr-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {view === "list" && (
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className={selectCls}>
            <option value="">All status</option>
            {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} className={selectCls}>
          <option value="">All priority</option>
          {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div className="w-52">
          <SearchableSelect options={projectOptions} value={filters.projectCode}
            onChange={(v) => setFilters((f) => ({ ...f, projectCode: v ?? "" }))} placeholder="All projects" />
        </div>
        {scope === "team" && (
          <div className="w-56">
            <SearchableSelect options={owners} value={filters.ownerUserId} clearLabel="All employees"
              onChange={(v) => setFilters((f) => ({ ...f, ownerUserId: v ?? "" }))} placeholder="All employees" />
          </div>
        )}
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters((f) => ({ ...f, overdue: e.target.checked }))}
            className="accent-red-600" /> Overdue only
        </label>
        {(filters.search || filters.status || filters.priority || filters.ownerUserId || filters.projectCode || filters.overdue) && (
          <button onClick={() => { setSearchText(""); setFilters({ search: "", status: "", priority: "", ownerUserId: "", projectCode: "", overdue: false }); }}
            className="text-xs text-blue-600 hover:underline">Clear filters</button>
        )}
      </div>

      {/* content */}
      {loading && data.items.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : data.items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-14 text-center">
          <p className="text-sm text-gray-600">No tasks here yet.</p>
          <button onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:underline">+ Create a task</button>
        </div>
      ) : view === "board" ? (
        <>
          <TaskBoard tasks={data.items} onOpen={(t) => setOpenId(t.id)} onMove={moveTask} canMove={(t) => !t.isLocked && canEditTask(t)} showOwner={showOwner} now={now} />
          {data.total > BOARD_LIMIT && (
            <p className="text-xs text-gray-500">Showing the first {BOARD_LIMIT} of {data.total} tasks. Use filters to narrow down.</p>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Code", "Title", showOwner && "Assigned to", "Project", "Priority", "Due", "Time", "Status"].filter(Boolean).map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((t) => (
                  <tr key={t.id} onClick={() => setOpenId(t.id)} tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(t.id)}
                    className="hover:bg-blue-50/40 cursor-pointer focus:outline-none focus:bg-blue-50/60">
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{t.taskCode}</td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium max-w-[360px]">
                      <span className={t.status === "Done" || t.status === "Cancelled" ? "line-through text-gray-400" : ""}>{t.title}</span>
                      {t.reopenCount > 0 && <span className="ml-2 text-[10px] text-purple-600">↺{t.reopenCount}</span>}
                    </td>
                    {showOwner && <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{t.ownerName}</td>}
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{t.projectCode || "Company"}</td>
                    <td className="px-4 py-2.5"><span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span></td>
                    <td className={`px-4 py-2.5 whitespace-nowrap ${t.isOverdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>{fmtDateTimeParts(t.dueDate, t.dueTime)}</td>
                    <td className="px-4 py-2.5"><TaskTimer task={t} now={now} compact /></td>
                    <td className="px-4 py-2.5"><span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium whitespace-nowrap ${STATUS_STYLE[t.status]}`}>{t.status}</span></td>
                    <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {t.isLocked ? (
                        <span title={t.reopenPending ? "Locked — reopen requested" : "Done — locked"} className="w-7 h-7 flex items-center justify-center text-gray-400">
                          {t.reopenPending ? <Hourglass size={14} className="text-amber-600" /> : <Lock size={14} />}
                        </span>
                      ) : canEditTask(t) && t.status === "To Do" ? (
                        <button title="Start — begins measuring work time" aria-label={`Start ${t.taskCode}`} onClick={() => moveTask(t, "In Progress")}
                          className="w-7 h-7 rounded-full border border-blue-300 text-blue-600 hover:bg-blue-50 flex items-center justify-center"><Play size={13} /></button>
                      ) : canEditTask(t) && (t.status === "In Progress" || t.status === "On Hold") ? (
                        <button title="Done — stops the clock and locks the task" aria-label={`Mark ${t.taskCode} done`} onClick={() => moveTask(t, "Done")}
                          className="w-7 h-7 rounded-full border border-gray-300 text-gray-400 hover:text-emerald-600 hover:border-emerald-500 flex items-center justify-center"><Check size={14} /></button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-600">
              <span>{data.total} tasks · page {page} of {pages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={14} /></button>
                <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      <ReopenRequestsDialog open={reqOpen} onClose={() => setReqOpen(false)} onOpenTask={(id) => { setReqOpen(false); setOpenId(id); }} onChanged={load} />
      <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} task={editing} access={access} onSaved={load} />
      <TaskDetailSheet
        open={!!openId}
        taskId={openId}
        onClose={() => {
          setOpenId(null);
          if (searchParams?.get("task")) router.replace(window.location.pathname);
        }}
        onEdit={openEdit}
        onChanged={load}
      />
    </div>
  );
}
