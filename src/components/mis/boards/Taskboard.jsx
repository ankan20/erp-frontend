"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Ban, Loader2, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/mis/MisModal";
import {
  workItemApi, flattenTree, TASKBOARD_COLUMNS, WI_STATES, POINT_TYPES, STATE_STYLE, TYPE_STYLE,
} from "@/lib/misBoards";
import { TypeBadge } from "./WorkItemSheet";

const DRAG = "text/tb-task";
const NO_PARENT = "none";
const COL_DOT = { "To Do": "bg-gray-400", "In Progress": "bg-blue-500", "On Hold": "bg-amber-500", Done: "bg-emerald-500" };
const hrs = (n) => `${Math.round((n || 0) * 100) / 100} h`;

function RemainingEditor({ task, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(task.remainingHours ?? "");
  const busy = useRef(false);                       // Enter saves, then the blur that follows must not save again
  const save = async () => {
    if (busy.current) return;
    busy.current = true;
    setEdit(false);
    try { await commit(); } finally { busy.current = false; }
  };
  const commit = async () => {
    const n = val === "" ? null : Number(val);
    if (n === (task.remainingHours ?? null)) return;
    if (n != null && (Number.isNaN(n) || n < 0)) { toast.error("Remaining work must be 0 or more"); return; }
    try { await workItemApi.update(task.id, { remainingHours: n }); onSaved?.(); }
    catch (e) { toast.error(e?.message || "Could not save"); }
  };
  if (!task.canEdit || task.state === "Done") {
    return <span className="text-[11px] font-semibold text-gray-600">{task.remainingHours != null ? hrs(task.remainingHours) : ""}</span>;
  }
  return edit ? (
    <input type="number" min="0" step="0.25" autoFocus value={val} onChange={(e) => setVal(e.target.value)}
      onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") { setVal(task.remainingHours ?? ""); setEdit(false); } }}
      onClick={(e) => e.stopPropagation()} aria-label={`Remaining hours of ${task.taskCode}`}
      className="w-14 border border-blue-400 rounded px-1 py-0.5 text-[11px] text-right" />
  ) : (
    <button type="button" onClick={(e) => { e.stopPropagation(); setVal(task.remainingHours ?? ""); setEdit(true); }} title="Remaining work — click to change"
      className="text-[11px] font-semibold text-gray-600 hover:bg-gray-100 rounded px-1">
      {task.remainingHours != null ? hrs(task.remainingHours) : "— h"}
    </button>
  );
}

function TaskCard({ t, onOpen, dragging, setDragging, onSaved }) {
  return (
    <article draggable={t.canEdit}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG, String(t.id)); e.dataTransfer.effectAllowed = "move"; setDragging(t.id); }}
      onDragEnd={() => setDragging(null)}
      onClick={() => onOpen(t.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(t.id)} tabIndex={0}
      aria-label={`${t.taskCode} ${t.title}`}
      className={`bg-amber-50/60 border border-amber-200 border-l-4 ${TYPE_STYLE.Task.bar} rounded-md p-2 shadow-sm cursor-pointer hover:shadow-md transition
        ${dragging === t.id ? "opacity-40" : ""} ${t.isBlocked ? "ring-1 ring-red-300" : ""}`}>
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-[12px] text-gray-800 leading-snug break-words min-w-0">
          <span className="text-[10px] text-gray-500 font-semibold mr-1">{t.taskCode}</span>{t.title}
        </p>
        {t.isBlocked && <Ban size={12} className="text-red-500 shrink-0 mt-0.5" title={t.blockedReason || "Blocked"} />}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 min-w-0">
          <UserAvatar id={t.ownerUserId} name={t.ownerName} size={18} />
          <span className="text-[10px] text-gray-600 truncate">{t.ownerName?.split(" ")[0]}</span>
          {t.isRunning && <Timer size={11} className="text-blue-600 animate-pulse" title="Clock running" />}
        </span>
        <RemainingEditor task={t} onSaved={onSaved} />
      </div>
    </article>
  );
}

/**
 * Sprint taskboard (Azure "Taskboard"): one swimlane per PBI/Bug, its tasks in
 * To Do / In Progress / On Hold / Done. Drag a task across columns (state, with the
 * Self Task timer rules) or onto another PBI's lane (re-parent). Remaining work is
 * editable on the card and rolls up per lane / column.
 */
export default function Taskboard({ sprint, projectCode, onOpen, onAddChild, refreshKey, showProject = false }) {
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [person, setPerson] = useState("all");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);           // "<laneId>|<column>"

  const load = useCallback(async () => {
    if (!sprint) return;
    setLoading(true);
    try {
      const r = await workItemApi.tree({ projectCode: projectCode || "company", sprintId: sprint.id, includeDone: 1 });
      setRoots(r?.data || []);
    } catch (e) {
      toast.error(e?.message || "Could not load the taskboard");
    } finally {
      setLoading(false);
    }
  }, [sprint, projectCode]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const all = useMemo(() => flattenTree(roots, new Set()), [roots]);
  const tasks = useMemo(() => all.filter((r) => r.workItemType === "Task" && r.sprintId === sprint?.id && r.state !== "Cancelled"), [all, sprint]);
  const parents = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.parentId));
    return all.filter((r) => POINT_TYPES.includes(r.workItemType) && (r.sprintId === sprint?.id || ids.has(r.id)));
  }, [all, tasks, sprint]);
  const people = useMemo(() => {
    const m = new Map();
    tasks.forEach((t) => m.set(t.ownerUserId, t.ownerName));
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [tasks]);

  const shown = person === "all" ? tasks : tasks.filter((t) => String(t.ownerUserId) === person);
  const parentIds = new Set(parents.map((p) => p.id));
  const lanes = [
    ...parents.map((p) => ({ id: p.id, parent: p, tasks: shown.filter((t) => t.parentId === p.id) })),
    { id: NO_PARENT, parent: null, tasks: shown.filter((t) => !parentIds.has(t.parentId)) },
  ].filter((l) => l.parent || l.tasks.length);
  const colTotals = TASKBOARD_COLUMNS.map((c) => {
    const ts = shown.filter((t) => t.state === c);
    return { c, n: ts.length, h: ts.reduce((a, t) => a + (c === "Done" ? 0 : t.remainingHours || 0), 0) };
  });
  const totalRemaining = shown.filter((t) => t.state !== "Done").reduce((a, t) => a + (t.remainingHours || 0), 0);

  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const drop = (lane, col) => async (e) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData(DRAG) || dragging);
    setDragging(null);
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const newParent = lane.id === NO_PARENT ? null : lane.id;
    const moveLane = (t.parentId && parentIds.has(t.parentId) ? t.parentId : null) !== newParent;
    try {
      if (moveLane) await workItemApi.update(t.id, { parentId: newParent });
      if (t.state !== col) await workItemApi.setState(t.id, col);
      if (moveLane || t.state !== col) toast.success(`${t.taskCode} → ${col}${moveLane ? ` · ${lane.parent ? lane.parent.taskCode : "no parent"}` : ""}`);
    } catch (err) {
      toast.error(err?.message || "Move not allowed");
    }
    load();
  };

  const setParentState = async (p, state) => {
    try { await workItemApi.setState(p.id, state); toast.success(`${p.taskCode} → ${state}`); load(); }
    catch (e) { toast.error(e?.message || "Could not change state"); }
  };

  if (!sprint) return <p className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">Choose or create a sprint.</p>;

  return (
    <div className="space-y-3">
      {/* person filter + totals */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide inline-flex items-center gap-1"><Users size={13} /> Person</span>
        <button onClick={() => setPerson("all")}
          className={`px-2.5 py-1 rounded-full text-xs border ${person === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>All</button>
        {people.map((u) => (
          <button key={u.id} onClick={() => setPerson(String(u.id))} aria-pressed={person === String(u.id)}
            className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full text-xs border ${person === String(u.id) ? "bg-blue-50 text-blue-700 border-blue-400" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
            <UserAvatar id={u.id} name={u.name} size={18} /> {u.name}
          </button>
        ))}
        <span className="flex-1" />
        <span className="text-xs text-gray-600">Remaining: <b className="text-gray-800">{hrs(totalRemaining)}</b> · {shown.length} task(s)</span>
        {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="min-w-[960px]">
          {/* column header */}
          <div className="grid grid-cols-[260px_repeat(4,minmax(170px,1fr))] border-b border-gray-200 bg-gray-50 sticky top-0 z-[1]">
            <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Activity / Snag</div>
            {colTotals.map(({ c, n, h }) => (
              <div key={c} className="px-3 py-2 border-l border-gray-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 uppercase tracking-wide"><span className={`w-2 h-2 rounded-full ${COL_DOT[c]}`} />{c}</span>
                <span className="text-[10px] text-gray-500">{n}{c !== "Done" && h ? ` · ${hrs(h)}` : ""}</span>
              </div>
            ))}
          </div>

          {lanes.length === 0 && !loading && (
            <p className="py-10 text-center text-sm text-gray-500">No tasks in this sprint yet — add Tasks under the sprint&apos;s Activities.</p>
          )}

          {lanes.map((lane) => {
            const p = lane.parent;
            const isCol = collapsed.has(lane.id);
            const rem = lane.tasks.filter((t) => t.state !== "Done").reduce((a, t) => a + (t.remainingHours || 0), 0);
            const doneN = lane.tasks.filter((t) => t.state === "Done").length;
            return (
              <div key={lane.id} className="grid grid-cols-[260px_repeat(4,minmax(170px,1fr))] border-b border-gray-100 last:border-b-0">
                {/* lane header = parent card */}
                <div className={`p-2 border-l-4 ${p ? TYPE_STYLE[p.workItemType].bar : "border-l-gray-300"} bg-gray-50/40`}>
                  <div className="flex items-start gap-1">
                    <button onClick={() => toggle(lane.id)} aria-label={isCol ? "Expand lane" : "Collapse lane"} aria-expanded={!isCol}
                      className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 shrink-0">
                      {isCol ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {p ? (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <TypeBadge type={p.workItemType} />
                          <span className="text-[10px] text-gray-500 font-semibold">{p.taskCode}</span>
                          {showProject && <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 rounded px-1">{p.projectCode || "Company"}</span>}
                          {p.storyPoints != null && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded px-1">{p.storyPoints} pt</span>}
                          {p.isBlocked && <Ban size={12} className="text-red-500" />}
                        </div>
                        <button onClick={() => onOpen(p.id)} className="text-left text-[13px] font-medium text-gray-800 hover:text-blue-700 hover:underline leading-snug">{p.title}</button>
                        <div className="mt-1 flex items-center gap-1.5">
                          <UserAvatar id={p.ownerUserId} name={p.ownerName} size={18} />
                          <select value={p.state} disabled={!p.canEdit} onChange={(e) => setParentState(p, e.target.value)} aria-label={`State of ${p.taskCode}`}
                            className={`text-[10px] font-medium rounded-full border px-1.5 py-0.5 ${STATE_STYLE[p.state] || STATE_STYLE.New}`}>
                            {WI_STATES[p.workItemType].map((s) => <option key={s}>{s}</option>)}
                          </select>
                          {p.canEdit && (
                            <button onClick={() => onAddChild(p, "Task")} title="Add task" aria-label={`Add task to ${p.taskCode}`}
                              className="ml-auto w-6 h-6 rounded flex items-center justify-center text-blue-600 hover:bg-blue-100"><Plus size={14} /></button>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-gray-500">{doneN}/{lane.tasks.length} done · {hrs(rem)} left</p>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-gray-600">Tasks without a sprint Activity</p>
                        <p className="text-[10px] text-gray-500">{lane.tasks.length} task(s) · {hrs(rem)} left</p>
                      </div>
                    )}
                  </div>
                </div>
                {TASKBOARD_COLUMNS.map((c) => {
                  const key = `${lane.id}|${c}`;
                  const cards = lane.tasks.filter((t) => t.state === c);
                  return (
                    <div key={c}
                      onDragOver={(e) => { if (dragging) { e.preventDefault(); if (over !== key) setOver(key); } }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
                      onDrop={drop(lane, c)}
                      aria-label={`${p ? p.taskCode : "No parent"} — ${c}`}
                      className={`border-l border-gray-100 p-1.5 space-y-1.5 min-h-[64px] transition-colors ${over === key ? "bg-blue-50 outline outline-2 outline-blue-300 -outline-offset-2" : ""}`}>
                      {isCol
                        ? (cards.length ? <p className="text-[10px] text-gray-400 px-1">{cards.length} card(s)</p> : null)
                        : cards.map((t) => <TaskCard key={t.id} t={t} onOpen={onOpen} dragging={dragging} setDragging={setDragging} onSaved={load} />)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-gray-500">Drag a task to change its state (Start → In Progress runs the work clock; Done locks it) or onto another item&apos;s row to move it there. Click the hours to update remaining work.</p>
    </div>
  );
}
