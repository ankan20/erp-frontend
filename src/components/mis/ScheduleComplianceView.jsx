"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Info } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import SearchableSelect from "@/components/common/SearchableSelect";
import { ScoreBar, Trend } from "@/components/hr/performance/ScoreCard";
import { currentProject } from "@/lib/misTasks";

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
function shift(anchor, period, dir) {
  const d = parse(anchor);
  if (period === "week") d.setDate(d.getDate() + 7 * dir);
  else { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  return iso(d);
}

// on-time % → text state (always printed with the number, never colour alone)
const band = (pct) => (pct == null ? "—" : pct >= 90 ? "On track" : pct >= 80 ? "Watch" : "Behind");
const BAND_STYLE = {
  "On track": "bg-emerald-50 text-emerald-700 border-emerald-200",
  Watch: "bg-amber-50 text-amber-700 border-amber-200",
  Behind: "bg-red-50 text-red-700 border-red-200",
  "—": "bg-gray-50 text-gray-500 border-gray-200",
};
function Band({ pct }) {
  const b = band(pct);
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${BAND_STYLE[b]}`}>{b}</span>;
}

function Stat({ label, value, sub, tone = "text-gray-800" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

const TH = "px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap";

/** MIS → Schedule Compliance: share of work finished by its due date, per person and department. */
export default function ScheduleComplianceView() {
  const [period, setPeriod] = useState("month");
  const [anchor, setAnchor] = useState(() => iso(new Date()));
  const [project, setProject] = useState("all");
  const [dept, setDept] = useState("");
  const [state, setState] = useState({ key: null, data: null, error: "" });

  const key = `${period}|${anchor}|${project}|${dept}`;
  const load = useCallback(() => {
    const params = { period, date: anchor, ...(project !== "all" ? { projectCode: project } : {}), ...(dept ? { department: dept } : {}) };
    apiRequest({ url: API_ENDPOINTS.MIS.COMPLIANCE, params })
      .then((r) => setState({ key, data: r?.data || null, error: "" }))
      .catch((e) => setState({ key, data: null, error: e?.message || "Could not load" }));
  }, [period, anchor, project, dept, key]);
  useEffect(() => { load(); }, [load]);

  const loading = state.key !== key;
  const d = state.data;
  const cp = currentProject();
  const projectOptions = [{ value: "all", label: "All projects" }, ...(cp ? [{ value: cp.code, label: `${cp.code} : ${cp.name}` }] : [])];
  const deptOptions = useMemo(() => {
    const names = new Set((d?.departments || []).map((x) => x.department));
    if (dept) names.add(dept);
    return [{ value: "", label: "All departments" }, ...[...names].sort().map((n) => ({ value: n, label: n }))];
  }, [d, dept]);
  const trendPts = (d?.trend || []).map((t) => ({ periodStart: t.periodStart, periodLabel: t.periodLabel, score: t.pct }));
  const s = d?.summary;

  if (state.error && !d && !loading) {
    return <p className="py-16 text-center text-sm text-gray-600">{/permission/i.test(state.error) ? "You do not have access to Schedule Compliance. Ask your admin for the permission." : state.error}</p>;
  }

  return (
    <div className="space-y-4">
      {/* filters — one row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-gray-300 overflow-hidden" role="radiogroup" aria-label="Period">
          {[["month", "Monthly"], ["week", "Weekly"]].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={period === v} onClick={() => setPeriod(v)}
              className={`px-3 py-2 text-sm ${period === v ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor((a) => shift(a, period, -1))} aria-label="Previous period" className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"><ChevronLeft size={15} /></button>
          <span className="min-w-[130px] text-center text-sm font-semibold text-gray-800">{d?.periodLabel || "…"}{d?.isLive && <span className="ml-1 text-[10px] font-medium text-blue-600">(live)</span>}</span>
          <button onClick={() => setAnchor((a) => shift(a, period, 1))} disabled={!!d?.isLive} aria-label="Next period" className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={15} /></button>
        </div>
        <div className="w-56"><SearchableSelect options={projectOptions} value={project} onChange={(v) => setProject(v || "all")} /></div>
        <div className="w-52"><SearchableSelect options={deptOptions} value={dept} onChange={(v) => setDept(v || "")} placeholder="All departments" /></div>
      </div>

      {!d ? (
        <div className="py-16 flex justify-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="On-time" value={s.pct == null ? "—" : `${s.pct}%`} sub={`${s.onTime} of ${s.due} due items`} tone="text-blue-700" />
            <Stat label="Late" value={s.late} sub="finished after the due date" tone={s.late ? "text-amber-700" : "text-gray-800"} />
            <Stat label="Missed" value={s.missed} sub="still open past the due date" tone={s.missed ? "text-red-600" : "text-gray-800"} />
            <Stat label="People" value={s.people} sub="with work due" />
            <Stat label="Below 80%" value={s.below80} sub="people behind schedule" tone={s.below80 ? "text-red-600" : "text-gray-800"} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">On-time trend</h3>
              <p className="text-[11px] text-gray-500 mb-2">% of due work finished on time, last 6 {period === "week" ? "weeks" : "months"}</p>
              <Trend points={trendPts} height={90} />
            </div>
            <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-800">By department</h3></div>
              {d.departments.length === 0 ? <p className="p-4 text-sm text-gray-500">Nothing was due in this period.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200"><tr>
                      {["Department", "On-time", "", "Due", "Late", "Missed", "People"].map((h, i) => <th key={i} className={TH}>{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {d.departments.map((x) => (
                        <tr key={x.department} onClick={() => setDept(x.department === dept ? "" : x.department)} className="hover:bg-blue-50/40 cursor-pointer">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{x.department}</td>
                          <td className="px-4 py-2.5"><ScoreBar value={x.pct} width={100} /></td>
                          <td className="px-2 py-2.5"><Band pct={x.pct} /></td>
                          <td className="px-4 py-2.5 tabular-nums">{x.due}</td>
                          <td className="px-4 py-2.5 tabular-nums">{x.late}</td>
                          <td className={`px-4 py-2.5 tabular-nums ${x.missed ? "text-red-600 font-semibold" : ""}`}>{x.missed}</td>
                          <td className="px-4 py-2.5 tabular-nums">{x.people}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">By person <span className="text-gray-400 font-normal">(most behind first)</span></h3>
            </div>
            {d.people.length === 0 ? <p className="p-4 text-sm text-gray-500">Nothing was due in this period.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200"><tr>
                    {["Emp Code", "Person", "Department", "On-time", "", "Due", "On time", "Late", "Missed"].map((h, i) => <th key={i} className={TH}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.people.map((p) => (
                      <tr key={p.userId}>
                        <td className="px-4 py-2.5 text-xs font-semibold text-gray-500">{p.empCode || "—"}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{p.name}</td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{p.department}</td>
                        <td className="px-4 py-2.5"><ScoreBar value={p.pct} width={100} /></td>
                        <td className="px-2 py-2.5"><Band pct={p.pct} /></td>
                        <td className="px-4 py-2.5 tabular-nums">{p.due}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.onTime}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.late}</td>
                        <td className={`px-4 py-2.5 tabular-nums ${p.missed ? "text-red-600 font-semibold" : ""}`}>{p.missed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-500 inline-flex items-start gap-1">
            <Info size={12} className="mt-0.5 shrink-0" />
            Counts MIS self tasks and follow-up hand-off steps. Work that is not due yet is never counted as late. “Missed” includes older work still open in this period.
          </p>
        </div>
      )}
    </div>
  );
}
