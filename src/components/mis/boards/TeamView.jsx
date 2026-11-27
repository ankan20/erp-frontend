"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, Search, Timer, Ban, CheckCircle2, AlertTriangle, PauseCircle, ListTodo, Coffee, RefreshCw,
  List as ListIcon, LayoutGrid, ChevronRight, ChevronDown,
} from "lucide-react";
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

const dueBits = (t) => (
  <>
    {t.isOverdue ? <span className="text-[11px] font-semibold text-red-600 inline-flex items-center gap-0.5"> · <AlertTriangle size={10} /> overdue {fmtDate(t.dueDate)}</span>
      : t.dueDate ? <span className="text-[11px] text-gray-500"> · due {fmtDate(t.dueDate)}</span> : null}
    {t.state === "On Hold" && <span className="text-[11px] text-amber-700"> · on hold</span>}
  </>
);

function Section({ title, icon: Icon, cls, box, items, empty, render }) {
  return (
    <div className={`rounded-lg border px-3 py-1.5 ${box}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide inline-flex items-center gap-1 ${cls}`}><Icon size={12} /> {title} ({items.length})</p>
      {items.length ? <ul className="space-y-1 mt-1 max-h-40 overflow-y-auto">{items.map(render)}</ul> : <p className="text-xs text-gray-400">{empty}</p>}
    </div>
  );
}

/** Everything one person has — shown when a row of the list is opened. */
function PersonDetail({ p, onOpen }) {
  const blockedIds = new Set(p.blocked.map((t) => t.id));
  const next = [...p.onHold, ...p.toDo].filter((t) => !blockedIds.has(t.id));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      <Section title="Working now" icon={Timer} cls="text-emerald-700" box="bg-emerald-50/50 border-emerald-100" items={p.working} empty="Nothing running"
        render={(t) => (
          <TaskLine key={t.id} t={t} onOpen={onOpen}>
            {t.type === "Task"
              ? <span className="text-[11px] font-semibold text-emerald-700"> · {t.isRunning ? "⏱ " : ""}{fmtDuration(t.workedSeconds)}</span>
              : <span className="text-[11px] text-emerald-700"> · {t.type === "Bug" ? "Snag" : "Activity"} in progress</span>}
          </TaskLine>
        )} />
      <Section title="Blocked" icon={Ban} cls="text-red-700" box="bg-red-50/50 border-red-100" items={p.blocked} empty="Nothing blocked"
        render={(t) => (
          <TaskLine key={t.id} t={t} onOpen={onOpen}>
            {t.blockedReason && <span className="block text-[11px] text-red-700">Blocked: {t.blockedReason}</span>}
          </TaskLine>
        )} />
      <Section title="Finished today" icon={CheckCircle2} cls="text-blue-700" box="bg-blue-50/40 border-blue-100" items={p.doneToday} empty="Nothing finished today"
        render={(t) => <TaskLine key={t.id} t={t} onOpen={onOpen} />} />
      <Section title="To do / on hold" icon={ListTodo} cls="text-gray-700" box="bg-gray-50 border-gray-200" items={next} empty="No open task"
        render={(t) => <TaskLine key={t.id} t={t} onOpen={onOpen}>{dueBits(t)}</TaskLine>} />
    </div>
  );
}

function PeopleList({ people, onOpen }) {
  const [openId, setOpenId] = useState(null);
  const th = "px-3 py-2.5 text-left text-[11px] font-semibold text-blue-900 uppercase tracking-wide whitespace-nowrap border-r border-blue-200";
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* the table scrolls on its own (header stays put) — the page does not */}
      <div className="overflow-auto max-h-[calc(100vh-340px)] min-h-[240px]">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-blue-100 sticky top-0 z-10 shadow-[inset_0_-2px_0_#93c5fd]">
            <tr>
              <th className="w-8" />
              <th className={th}>Person</th>
              <th className={th}>Status</th>
              <th className={th}>Working on</th>
              <th className={`${th} text-center`}>Done today</th>
              <th className={`${th} text-center`}>To do</th>
              <th className={`${th} text-center`}>Overdue</th>
              <th className={`${th} text-center`}>Blocked</th>
              <th className={th}>Last update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {people.map((p) => {
              const st = STATUS[p.status];
              const Icon = st.icon;
              const open = openId === p.userId;
              const cur = p.working[0];
              return (
                <Fragment key={p.userId}>
                  <tr onClick={() => setOpenId(open ? null : p.userId)} tabIndex={0} aria-expanded={open}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(open ? null : p.userId)}
                    className={`cursor-pointer focus:outline-none focus:bg-blue-50/60 ${open ? "bg-blue-50/60" : "hover:bg-blue-50/40"}`}>
                    <td className="pl-3 text-gray-400">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar id={p.userId} name={p.name} size={28} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-500">{p.empCode || ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2"><span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 inline-flex items-center gap-1 whitespace-nowrap ${st.cls}`}><Icon size={12} /> {st.label}</span></td>
                    <td className="px-3 py-2 text-gray-700 max-w-[320px] truncate">
                      {cur ? <>{cur.title}{p.working.length > 1 && <span className="text-[11px] text-gray-500"> +{p.working.length - 1}</span>}</> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-blue-700">{p.doneToday.length}</td>
                    <td className="px-3 py-2 text-center font-semibold text-gray-800">{p.toDo.length + p.onHold.length}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${p.overdue ? "text-red-600" : "text-gray-800"}`}>{p.overdue}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${p.blocked.length ? "text-red-600" : "text-gray-800"}`}>{p.blocked.length}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{p.lastActive ? ago(p.lastActive) : "—"}</td>
                  </tr>
                  {open && (
                    <tr className="bg-blue-50/30">
                      <td colSpan={9} className="px-4 py-2"><PersonDetail p={p} onOpen={onOpen} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TeamView({ projectCode, onOpen, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [layout, setLayout] = useState("list");
  useEffect(() => { try { setLayout(sessionStorage.getItem("mis-team-layout") || "list"); } catch {} }, []);
  const changeLayout = (v) => { setLayout(v); try { sessionStorage.setItem("mis-team-layout", v); } catch {} };

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
        <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-gray-300 overflow-hidden" role="group" aria-label="Layout">
          <button onClick={() => changeLayout("list")} aria-pressed={layout === "list"} title="List"
            className={`px-2.5 py-1.5 ${layout === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}><ListIcon size={14} /></button>
          <button onClick={() => changeLayout("cards")} aria-pressed={layout === "cards"} title="Cards"
            className={`px-2.5 py-1.5 border-l border-gray-300 ${layout === "cards" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}><LayoutGrid size={14} /></button>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-2.5 py-1.5 hover:bg-gray-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
        </div>
      </div>

      {/* big numbers */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { k: "Working now", v: s.workingNow, cls: "text-emerald-700", f: "working" },
          { k: "Finished today", v: s.doneToday, cls: "text-blue-700", f: "all" },
          { k: "Overdue tasks", v: s.overdue, cls: s.overdue ? "text-red-600" : "text-gray-800", f: "all" },
          { k: "Blocked", v: s.blocked, cls: s.blocked ? "text-red-600" : "text-gray-800", f: "blocked" },
          { k: "No work", v: s.idle, cls: "text-gray-800", f: "idle" },
        ].map((x) => (
          <button key={x.k} onClick={() => setFilter(x.f)}
            className="flex items-center justify-between gap-2 text-left bg-white rounded-lg border border-gray-200 px-3 py-1.5 hover:border-blue-300">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{x.k}</span>
            <span className={`text-lg font-bold leading-none ${x.cls}`}>{x.v}</span>
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
      ) : layout === "list" ? (
        <PeopleList people={people} onOpen={onOpen} />
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
