"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Timer, Ban, CheckCircle2, AlertTriangle, PauseCircle, ListTodo, Coffee, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/mis/MisModal";
import { fmtDate, fmtDuration } from "@/lib/misTasks";
import { workItemApi } from "@/lib/misBoards";

/*
 * Team — "who is doing what" for supervisors, in plain words.
 * Every Task counts: self-created or assigned, in a sprint or not. A supervisor sees every active user
 * (people with no work too); anyone else sees just their own card. Refreshes every minute.
 */
const STATUS = {
  working: { label: "Working now", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Timer },
  blocked: { label: "Blocked", cls: "bg-red-50 text-red-700 border-red-200", icon: Ban },
  onHold: { label: "On hold", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: PauseCircle },
  toDo: { label: "Not started", cls: "bg-gray-100 text-gray-700 border-gray-200", icon: ListTodo },
  idle: { label: "No work", cls: "bg-white text-gray-500 border-gray-200", icon: Coffee },
};
const FILTERS = [["all", "Everyone"], ["working", "Working"], ["blocked", "Blocked"], ["toDo", "Not started"], ["idle", "No work"]];

const ago = (iso) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return fmtDate(iso);
};

function TaskLine({ t, onOpen, children }) {
  return (
    <li className="text-[13px] leading-snug">
      <button onClick={() => onOpen(t.id)} className="text-left text-gray-800 hover:text-blue-700 hover:underline">{t.title}</button>
      <span className="text-[11px] text-gray-500"> · {t.code}{t.projectCode ? ` · ${t.projectCode}` : ""}</span>
      {children}
    </li>
  );
}

export default function TeamView({ projectCode, onOpen, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await workItemApi.team(projectCode || "all", search.trim() || undefined); setData(r?.data || null); }
    catch (e) { toast.error(e?.message || "Could not load the team"); }
    finally { setLoading(false); }
  }, [projectCode, search]);
  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [load, refreshKey, search]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const people = useMemo(() => (data?.people || []).filter((p) => filter === "all" || p.status === filter), [data, filter]);
  if (!data) return <div className="py-10 flex justify-center text-gray-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{data.isSupervisor ? "Who is doing what — today" : "Your work today"}</h2>
          <p className="text-xs text-gray-500">{fmtDate(data.today)} · every task counts, whether people made it themselves or it was given to them · updates every minute</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-2.5 py-1.5 hover:bg-gray-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* big numbers */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { k: "Working now", v: s.workingNow, cls: "text-emerald-700", f: "working" },
          { k: "Finished today", v: s.doneToday, cls: "text-blue-700", f: "all" },
          { k: "Overdue tasks", v: s.overdue, cls: s.overdue ? "text-red-600" : "text-gray-800", f: "all" },
          { k: "Blocked", v: s.blocked, cls: s.blocked ? "text-red-600" : "text-gray-800", f: "blocked" },
          { k: "No work", v: s.idle, cls: "text-gray-800", f: "idle" },
        ].map((x) => (
          <button key={x.k} onClick={() => setFilter(x.f)} className="text-left bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{x.k}</p>
            <p className={`text-2xl font-bold ${x.cls}`}>{x.v}</p>
          </button>
        ))}
      </div>

      {data.isSupervisor && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a person / emp code…"
              className="border border-gray-300 rounded-md pl-8 pr-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {FILTERS.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
              className={`text-xs px-3 py-1.5 rounded-full border ${filter === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>{label}</button>
          ))}
          <span className="text-xs text-gray-500 ml-auto">{people.length} of {s.people} people</span>
        </div>
      )}

      {people.length === 0 ? (
        <p className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">Nobody here.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {people.map((p) => {
            const st = STATUS[p.status];
            const blockedIds = new Set(p.blocked.map((t) => t.id));
            const next = [...p.onHold, ...p.toDo].filter((t) => !blockedIds.has(t.id));   // blocked ones show above
            const Icon = st.icon;
            return (
              <article key={p.userId} aria-label={p.name}
                className={`bg-white rounded-xl border p-3 space-y-2 ${p.status === "blocked" ? "border-red-300" : p.status === "working" ? "border-emerald-300" : "border-gray-200"}`}>
                <header className="flex items-center gap-2">
                  <UserAvatar id={p.userId} name={p.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-500">{p.empCode || ""}{p.lastActive ? ` · last update ${ago(p.lastActive)}` : ""}</p>
                  </div>
                  <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 inline-flex items-center gap-1 ${st.cls}`}><Icon size={12} /> {st.label}</span>
                </header>

                {p.working.length > 0 && (
                  <ul className="space-y-1 bg-emerald-50/50 rounded-lg px-2.5 py-2">
                    {p.working.map((t) => (
                      <TaskLine key={t.id} t={t} onOpen={onOpen}>
                        {t.type === "Task"
                          ? <span className="text-[11px] font-semibold text-emerald-700"> · {t.isRunning ? "⏱ " : ""}{fmtDuration(t.workedSeconds)}</span>
                          : <span className="text-[11px] text-emerald-700"> · {t.type === "Bug" ? "Snag" : "Activity"} in progress</span>}
                      </TaskLine>
                    ))}
                  </ul>
                )}
                {p.blocked.length > 0 && (
                  <ul className="space-y-1 bg-red-50/50 rounded-lg px-2.5 py-2">
                    {p.blocked.map((t) => (
                      <TaskLine key={t.id} t={t} onOpen={onOpen}>
                        {t.blockedReason && <span className="block text-[11px] text-red-700">Blocked: {t.blockedReason}</span>}
                      </TaskLine>
                    ))}
                  </ul>
                )}

                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 py-1.5"><dt className="text-[10px] text-gray-500 uppercase">Done today</dt><dd className="text-lg font-bold text-blue-700">{p.doneToday.length}</dd></div>
                  <div className="rounded-lg bg-gray-50 py-1.5"><dt className="text-[10px] text-gray-500 uppercase">To do</dt><dd className="text-lg font-bold text-gray-800">{p.toDo.length + p.onHold.length}</dd></div>
                  <div className="rounded-lg bg-gray-50 py-1.5"><dt className="text-[10px] text-gray-500 uppercase">Overdue</dt><dd className={`text-lg font-bold ${p.overdue ? "text-red-600" : "text-gray-800"}`}>{p.overdue}</dd></div>
                </dl>

                {p.doneToday.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Finished today</p>
                    <ul className="space-y-0.5 mt-0.5">{p.doneToday.slice(0, 3).map((t) => <TaskLine key={t.id} t={t} onOpen={onOpen} />)}</ul>
                    {p.doneToday.length > 3 && <p className="text-[11px] text-gray-500">+{p.doneToday.length - 3} more</p>}
                  </div>
                )}
                {next.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-600 inline-flex items-center gap-1"><ListTodo size={12} /> Next up</p>
                    <ul className="space-y-0.5 mt-0.5">
                      {next.slice(0, 2).map((t) => (
                        <TaskLine key={t.id} t={t} onOpen={onOpen}>
                          {t.isOverdue ? <span className="text-[11px] font-semibold text-red-600 inline-flex items-center gap-0.5"> · <AlertTriangle size={10} /> overdue {fmtDate(t.dueDate)}</span>
                            : t.dueDate ? <span className="text-[11px] text-gray-500"> · due {fmtDate(t.dueDate)}</span> : null}
                          {t.state === "On Hold" && <span className="text-[11px] text-amber-700"> · on hold</span>}
                        </TaskLine>
                      ))}
                    </ul>
                    {next.length > 2 && <p className="text-[11px] text-gray-500">+{next.length - 2} more</p>}
                  </div>
                )}
                {p.status === "idle" && <p className="text-xs text-gray-500">No open task and nothing finished today.</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
