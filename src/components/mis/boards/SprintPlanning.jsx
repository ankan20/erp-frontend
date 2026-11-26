"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, Users, Gauge } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar, btnPrimary } from "@/components/mis/MisModal";
import { fmtDate } from "@/lib/misTasks";
import { boardsSprintApi, workItemApi, flattenTree, sumPoints } from "@/lib/misBoards";
import BacklogTree from "./BacklogTree";

const dayLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return { dow: d.toLocaleDateString("en-IN", { weekday: "short" }), dm: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) };
};

function Bar({ used, total, label }) {
  const pct = total > 0 ? Math.min(100, (100 * used) / total) : used > 0 ? 100 : 0;
  const over = used > total;
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={used} aria-valuemax={total} aria-label={label}>
        <div className={`h-full rounded-full ${over ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] whitespace-nowrap ${over ? "text-red-600 font-semibold" : "text-gray-600"}`}>{used} / {total} h</span>
    </div>
  );
}

/** Sprint planning: sprint backlog (tree) + capacity per member (Azure "Capacity" tab). */
export default function SprintPlanning({ sprint, projectCode, sprints, users, onOpen, onAddChild, dragging, setDragging, refreshKey, onChanged }) {
  const [roots, setRoots] = useState([]);
  const [cap, setCap] = useState(null);
  const [edit, setEdit] = useState({});           // userId → { hoursPerDay, daysOff:Set }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!sprint) return;
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        workItemApi.tree({ projectCode: projectCode || "company", sprintId: sprint.id, includeDone: 1 }),
        boardsSprintApi.capacity(sprint.id),
      ]);
      setRoots(t?.data || []);
      setCap(c?.data || null);
      setEdit({});
    } catch (e) {
      toast.error(e?.message || "Could not load the sprint");
    } finally {
      setLoading(false);
    }
  }, [sprint, projectCode]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const all = useMemo(() => flattenTree(roots, new Set()), [roots]);
  const inSprint = all.filter((r) => r.sprintId === sprint?.id);
  const pts = sumPoints(inSprint);
  const donePts = sumPoints(inSprint.filter((r) => r.state === "Done"));

  if (!sprint) return <p className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">Choose or create a sprint.</p>;

  const canManage = cap?.canManage && sprint.status !== "Closed";
  const row = (m) => edit[m.userId] || { hoursPerDay: m.hoursPerDay, daysOff: new Set(m.daysOff) };
  const setRow = (m, patch) => setEdit((e) => ({ ...e, [m.userId]: { ...row(m), ...patch } }));
  const toggleOff = (m, d) => { const s = new Set(row(m).daysOff); s.has(d) ? s.delete(d) : s.add(d); setRow(m, { daysOff: s }); };
  const dirty = Object.keys(edit).length > 0;

  const saveCap = async () => {
    setSaving(true);
    try {
      const members = Object.entries(edit).map(([uid, v]) => ({ userId: Number(uid), hoursPerDay: Number(v.hoursPerDay) || 0, daysOff: [...v.daysOff] }));
      const r = await boardsSprintApi.setCapacity(sprint.id, members);
      setCap(r?.data || null);
      setEdit({});
      toast.success("Capacity saved");
    } catch (e) {
      toast.error(e?.message || "Could not save capacity");
    } finally {
      setSaving(false);
    }
  };

  const t = cap?.totals || {};
  return (
    <div className="space-y-4">
      {/* summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: "Committed", v: `${pts} pt`, s: `${donePts} pt done` },
          { k: "Work items", v: inSprint.length, s: `${inSprint.filter((r) => r.workItemType === "Task").length} tasks` },
          { k: "Remaining work", v: `${t.assignedHours ?? 0} h`, s: t.unassignedHours ? `${t.unassignedHours} h unassigned` : "all assigned" },
          { k: "Capacity left", v: `${t.remainingCapacityHours ?? 0} h`, s: `of ${t.capacityHours ?? 0} h in the sprint` },
        ].map((x) => (
          <div key={x.k} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{x.k}</p>
            <p className="text-xl font-bold text-gray-800">{x.v}</p>
            <p className="text-[11px] text-gray-500">{x.s}</p>
          </div>
        ))}
      </div>
      {cap && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
          <Gauge size={16} className="text-gray-500" />
          <span className="text-xs text-gray-600 w-28">Team load</span>
          <div className="flex-1 max-w-md"><Bar used={t.assignedHours ?? 0} total={t.remainingCapacityHours ?? 0} label="Team load" /></div>
          <span className="text-[11px] text-gray-500">{fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)} · {cap.workingDays.length} working days</span>
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-5 gap-4 items-start">
        {/* sprint backlog */}
        <section className="2xl:col-span-3 space-y-2" aria-label="Sprint backlog">
          <h3 className="text-sm font-semibold text-gray-800">Sprint backlog</h3>
          <BacklogTree roots={roots} loading={loading} onOpen={onOpen} onAddChild={onAddChild} sprints={sprints} users={users}
            dragging={dragging} setDragging={setDragging} onChanged={() => { load(); onChanged?.(); }} compact
            emptyText="Nothing planned yet — drag Activities onto this sprint from the Backlog tab." />
        </section>

        {/* capacity */}
        <section className="2xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden" aria-label="Capacity">
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-1.5"><Users size={15} /> Capacity</h3>
            {canManage && (
              <button onClick={saveCap} disabled={!dirty || saving} className={`${btnPrimary} py-1.5`}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            )}
          </header>
          {!cap ? (
            <div className="py-8 flex justify-center text-gray-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Member</th>
                    <th className="px-2 py-2 text-left w-20">h / day</th>
                    <th className="px-2 py-2 text-left">Days off</th>
                    <th className="px-3 py-2 text-left">Work vs capacity left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cap.members.map((m) => {
                    const r = row(m);
                    const hpd = Number(r.hoursPerDay) || 0;
                    const leftDays = cap.workingDays.filter((d) => d >= new Date().toISOString().slice(0, 10) && !r.daysOff.has(d)).length;
                    const left = edit[m.userId] ? +(hpd * leftDays).toFixed(2) : m.remainingCapacityHours;
                    return (
                      <tr key={m.userId} className={m.overAllocated && !edit[m.userId] ? "bg-red-50/40" : ""}>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5"><UserAvatar id={m.userId} name={m.name} size={22} />
                            <span className="text-xs text-gray-800">{m.name}</span>
                            {!m.isSet && !edit[m.userId] && <span className="text-[10px] text-gray-400">(default)</span>}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" max="24" step="0.5" value={r.hoursPerDay} disabled={!canManage}
                            onChange={(e) => setRow(m, { hoursPerDay: e.target.value })} aria-label={`Hours per day for ${m.name}`}
                            className="w-16 border border-gray-300 rounded px-1.5 py-1 text-xs disabled:bg-gray-50" />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-0.5 max-w-[260px]">
                            {cap.workingDays.map((d) => {
                              const off = r.daysOff.has(d);
                              const { dow, dm } = dayLabel(d);
                              return (
                                <button key={d} type="button" disabled={!canManage} onClick={() => toggleOff(m, d)}
                                  title={`${dow} ${dm}${off ? " — day off" : ""}`} aria-pressed={off} aria-label={`${m.name} ${dow} ${dm} day off`}
                                  className={`w-6 h-6 rounded text-[9px] leading-none border ${off ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"} disabled:cursor-default`}>
                                  {dm.slice(0, 2)}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2"><Bar used={m.assignedHours} total={left} label={`${m.name} load`} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!canManage && <p className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-100">Only a sprint manager can change capacity.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
