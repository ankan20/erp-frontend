"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ListTodo, X, Plus, ArrowRight, Loader2, Calendar, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import {
  misTaskApi, TASK_PRIORITIES, TASKS_CHANGED, PRIORITY_STRIPE, currentProject, fmtDate, todayISO,
} from "@/lib/misTasks";
import { followupApi } from "@/lib/misFollowups";

const TASK_PAGE = "/task-management/todo";
const BOARD_PAGE = "/task-management/task-tracker";
const REFRESH_MS = 2 * 60 * 1000;
const POS_KEY = "quickTaskFab:pos";   // { x, y } — top-left of the button, in px
const BTN = 36;                        // button size (matches the chat button)
const EDGE = 4;                        // keep this far from the window edge
const DRAG_THRESHOLD = 4;              // px moved before a press counts as a drag

const clampPos = ({ x, y }) => ({
  x: Math.min(Math.max(x, EDGE), window.innerWidth - BTN - EDGE),
  y: Math.min(Math.max(y, EDGE), window.innerHeight - BTN - EDGE),
});
const readPos = () => {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? clampPos(p) : null;
  } catch { return null; }
};

/**
 * Global floating button: open/overdue badge, quick add, the next few due
 * tasks with one-click "done", and a link to the full page.
 * Sits in the left sidebar just above the chat button by default; drag it
 * anywhere (position is remembered per browser). Double-click puts it back.
 * Alt+Q opens it (see shortcuts.config.js → "quick-task").
 */
export default function QuickTaskFab() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [fu, setFu] = useState(null);       // follow-ups waiting on me / to review
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", dueDate: "", priority: "Medium" });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // ─── position: null = default spot (left sidebar, above the chat button)
  const [pos, setPos] = useState(null);
  const drag = useRef(null);       // { startX, startY, origX, origY, moved }
  const justDragged = useRef(false);

  useEffect(() => {
    setPos(readPos()); // localStorage is client-only, so read it after mount
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const r = wrapRef.current.querySelector("[data-qt-btn]").getBoundingClientRect();
    drag.current = { startX: e.clientX, startY: e.clientY, origX: r.left, origY: r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setPos(clampPos({ x: d.origX + dx, y: d.origY + dy }));
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d?.moved) return;
    justDragged.current = true; // swallow the click that follows a drag
    setPos((p) => {
      try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
      return p;
    });
  };
  const resetPos = () => {
    try { localStorage.removeItem(POS_KEY); } catch {}
    setPos(null);
  };

  const refreshStats = useCallback(() => {
    misTaskApi.stats({ scope: "mine" }).then((r) => r?.data && setStats(r.data)).catch(() => {});
    followupApi.stats().then((r) => r?.data && setFu(r.data)).catch(() => {});
  }, []);

  const loadUpcoming = useCallback(async () => {
    setLoading(true);
    try {
      const r = await misTaskApi.list({ scope: "mine", status: "To Do,In Progress,On Hold", perPage: 6 });
      setUpcoming(r?.data?.items || []);
    } catch {
      setUpcoming([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // badge: on mount, every 2 min (only while the tab is visible), and after any task change
  useEffect(() => {
    refreshStats();
    const t = setInterval(() => { if (document.visibilityState === "visible") refreshStats(); }, REFRESH_MS);
    const h = () => { refreshStats(); if (open) loadUpcoming(); };
    window.addEventListener(TASKS_CHANGED, h);
    return () => { clearInterval(t); window.removeEventListener(TASKS_CHANGED, h); };
  }, [refreshStats, loadUpcoming, open]);

  useEffect(() => {
    if (!open) return;
    loadUpcoming();
    requestAnimationFrame(() => inputRef.current?.focus());
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, loadUpcoming]);

  // close when navigating
  useEffect(() => { setOpen(false); }, [pathname]);

  const quickAdd = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    setSaving(true);
    try {
      await misTaskApi.create({
        title, priority: form.priority, dueDate: form.dueDate || null,
        projectCode: currentProject()?.code || null,
      });
      toast.success("Task added");
      setForm({ title: "", dueDate: "", priority: "Medium" });
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err?.message || "Could not add task");
    } finally {
      setSaving(false);
    }
  };

  // To Do → Start (clock on) · In Progress / On Hold → Done (clock stops, task locks)
  const markDone = async (t) => {
    const starting = t.status === "To Do";
    if (!starting && !window.confirm(`Mark ${t.taskCode} Done? It will be locked.`)) return;
    if (!starting) setUpcoming((u) => u.filter((x) => x.id !== t.id));
    try {
      if (starting) await misTaskApi.start(t.id);
      else await misTaskApi.setStatus(t.id, "Done");
      toast.success(starting ? `${t.taskCode} started — time is being measured` : `${t.taskCode} done`);
      if (starting) loadUpcoming();
    } catch (err) {
      toast.error(err?.message || "Could not update task");
      loadUpcoming();
    }
  };

  const fuWaiting = (fu?.waitingOnMe ?? 0) + (fu?.toReview ?? 0);
  const openCount = (stats?.open ?? 0) + fuWaiting;       // badge = tasks + follow-ups waiting on me
  const overdue = (stats?.overdue ?? 0) + (fu?.waitingOnMeOverdue ?? 0);
  const today = todayISO();

  // which way the panel opens (default spot = bottom-left → up and to the right)
  const panelBelow = !!pos && typeof window !== "undefined" && pos.y < window.innerHeight / 2;
  const panelLeft = !!pos && typeof window !== "undefined" && pos.x > window.innerWidth / 2;

  return (
    <div ref={wrapRef}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`fixed z-[9980] w-9 h-9 print:hidden ${pos ? "" : "bottom-[60px] left-[7px]"}`}>
      {open && (
        <div
          // open toward the middle of the screen from wherever the button sits
          className={`absolute w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150
            ${panelBelow ? "top-full mt-2" : "bottom-full mb-2"} ${panelLeft ? "right-0" : "left-0"}`}
          role="dialog" aria-label="Quick tasks">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#c4d1df] bg-gradient-to-b from-[#f4f4f4] to-[#e3e3e3]">
            <span className="text-[13px] font-semibold text-gray-800">My Tasks</span>
            <span className="text-[11px] text-gray-600">
              {openCount} open{overdue > 0 && <> · <b className="text-red-600">{overdue} overdue</b></>}
            </span>
          </div>

          <form onSubmit={quickAdd} className="p-3 space-y-2 border-b border-gray-100">
            <input ref={inputRef} value={form.title} maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Quick add a task… (Enter)"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <input type="date" value={form.dueDate} min={today} aria-label="Due date"
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="flex-1 min-w-0 border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={form.priority} aria-label="Priority" onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
              <button type="submit" disabled={saving || !form.title.trim()} aria-label="Add task"
                className="px-2.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </form>

          <div className="max-h-[260px] overflow-y-auto">
            {loading && upcoming.length === 0 ? (
              <div className="py-6 flex justify-center text-gray-400"><Loader2 size={16} className="animate-spin" /></div>
            ) : upcoming.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-500">Nothing pending. 🎉</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {upcoming.map((t) => (
                  <li key={t.id} className={`flex items-start gap-2 px-3 py-2 border-l-4 ${PRIORITY_STRIPE[t.priority]} hover:bg-gray-50`}>
                    <button onClick={() => markDone(t)} title={t.status === "To Do" ? "Start" : "Mark done"}
                      aria-label={t.status === "To Do" ? `Start ${t.taskCode}` : `Mark ${t.taskCode} done`}
                      className={`mt-0.5 w-5 h-5 rounded-full border shrink-0 flex items-center justify-center text-[9px]
                        ${t.status === "To Do" ? "border-blue-400 text-blue-600 hover:bg-blue-50" : "border-gray-400 text-transparent hover:text-emerald-600 hover:border-emerald-500"}`}>
                      {t.status === "To Do" ? "▶" : "✓"}
                    </button>
                    <button onClick={() => router.push(`${TASK_PAGE}?task=${t.uuid}`)} className="min-w-0 flex-1 text-left">
                      <p className="text-sm text-gray-800 leading-snug truncate">{t.title}</p>
                      <p className={`text-[10px] inline-flex items-center gap-1 ${t.isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                        <Calendar size={10} /> {t.dueDate ? fmtDate(t.dueDate) : "No due date"} · {t.status}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {fuWaiting > 0 && (
            <button onClick={() => router.push(`${BOARD_PAGE}?tab=mine`)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs border-t border-gray-100 hover:bg-violet-50">
              <ArrowRightLeft size={13} className="text-violet-600 shrink-0" />
              <span className="flex-1 text-gray-700">
                Follow-ups: <b>{fu.waitingOnMe}</b> waiting on you{fu.toReview > 0 && <> · <b>{fu.toReview}</b> to review</>}
              </span>
              <ArrowRight size={13} className="text-gray-400" />
            </button>
          )}

          <button onClick={() => router.push(TASK_PAGE)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border-t border-blue-100">
            Open all tasks <ArrowRight size={13} />
          </button>
        </div>
      )}

      <button
        type="button"
        data-qt-btn
        data-shortcut="quick-task"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (justDragged.current) { justDragged.current = false; return; }
          setOpen((o) => !o);
        }}
        onDoubleClick={resetPos}
        aria-label={open ? "Close quick tasks" : `My tasks: ${openCount} open, ${overdue} overdue`}
        aria-expanded={open}
        title="My Tasks (Alt+Q) — drag to move, double-click to reset"
        className="relative w-9 h-9 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
      >
        {open ? <X size={17} /> : <ListTodo size={17} />}
        {!open && openCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center border border-white
            ${overdue > 0 ? "bg-red-600" : "bg-amber-500"} text-white`}>
            {openCount > 99 ? "99+" : openCount}
          </span>
        )}
      </button>
    </div>
  );
}
