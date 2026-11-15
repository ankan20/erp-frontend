"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ListTodo, X, Plus, ArrowRight, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  misTaskApi, TASK_PRIORITIES, TASKS_CHANGED, PRIORITY_STRIPE, currentProject, fmtDate, todayISO,
} from "@/lib/misTasks";

const TASK_PAGE = "/task-management/todo";
const REFRESH_MS = 2 * 60 * 1000;

/**
 * Global floating button (bottom-right): open/overdue badge, quick add,
 * the next few due tasks with one-click "done", and a link to the full page.
 * Alt+Q opens it (see shortcuts.config.js → "quick-task").
 */
export default function QuickTaskFab() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", dueDate: "", priority: "Medium" });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const refreshStats = useCallback(() => {
    misTaskApi.stats({ scope: "mine" }).then((r) => r?.data && setStats(r.data)).catch(() => {});
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

  const markDone = async (t) => {
    setUpcoming((u) => u.filter((x) => x.id !== t.id));
    try {
      await misTaskApi.setStatus(t.id, "Done");
      toast.success(`${t.taskCode} done`);
    } catch (err) {
      toast.error(err?.message || "Could not update task");
      loadUpcoming();
    }
  };

  const openCount = stats?.open ?? 0;
  const overdue = stats?.overdue ?? 0;
  const today = todayISO();

  return (
    <div ref={wrapRef} className="fixed bottom-14 right-4 z-[9980] flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div className="w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
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
                    <button onClick={() => markDone(t)} title="Mark done" aria-label={`Mark ${t.taskCode} done`}
                      className="mt-0.5 w-4 h-4 rounded-full border border-gray-400 hover:border-emerald-500 hover:bg-emerald-50 shrink-0" />
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

          <button onClick={() => router.push(TASK_PAGE)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border-t border-blue-100">
            Open all tasks <ArrowRight size={13} />
          </button>
        </div>
      )}

      <button
        type="button"
        data-shortcut="quick-task"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close quick tasks" : `My tasks: ${openCount} open, ${overdue} overdue`}
        aria-expanded={open}
        title="My Tasks (Alt+Q)"
        className="relative w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:scale-105 transition flex items-center justify-center ring-4 ring-white"
      >
        {open ? <X size={20} /> : <ListTodo size={20} />}
        {!open && openCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white
            ${overdue > 0 ? "bg-red-600" : "bg-amber-500"} text-white`}>
            {openCount > 99 ? "99+" : openCount}
          </span>
        )}
      </button>
    </div>
  );
}
