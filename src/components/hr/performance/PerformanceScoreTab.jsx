"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, X, ArrowUp, ArrowDown, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import ScoreCard, { GradePill, ScoreBar } from "./ScoreCard";

const P = API_ENDPOINTS.HR.PERFORMANCE;
const GRADES = ["Excellent", "Good", "Average", "Needs Improvement", "No data"];

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

function shift(anchor, period, dir) {
  const d = parse(anchor);
  if (period === "week") d.setDate(d.getDate() + 7 * dir);
  else { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  return iso(d);
}

function Change({ v }) {
  if (v == null) return <span className="text-gray-400 text-xs">—</span>;
  if (v === 0) return <span className="text-xs text-gray-500">0</span>;
  const up = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-emerald-700" : "text-red-600"}`}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(v)}
    </span>
  );
}

/** HR → Performance Appraisal → "Performance Score" tab. */
export default function PerformanceScoreTab() {
  const [departments, setDepartments] = useState([]);
  const [period, setPeriod] = useState("month");
  const [anchor, setAnchor] = useState(() => iso(new Date()));
  const [dept, setDept] = useState("");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);       // { key, row }

  useEffect(() => { const t = setTimeout(() => setQ(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.HR.EMPLOYEE.DEPARTMENTS }).then((r) => setDepartments(r?.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiRequest({ url: P.SCORE_LIST, params: Object.fromEntries(Object.entries({ period, date: anchor, department: dept, grade, search: q }).filter(([, v]) => v)) });
      setData(r?.data || null);
    } catch (e) {
      setData(null);
      if (!/permission/i.test(e?.message || "")) toast.error(e?.message || "Could not load scores");
    } finally {
      setLoading(false);
    }
  }, [period, anchor, dept, grade, q]);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (row) => {
    setDetail({ key: row.key, row: null });
    try {
      const r = await apiRequest({ url: `${P.SCORE_SUBJECT}${row.key}`, params: { period, date: anchor } });
      setDetail({ key: row.key, row: r?.data });
    } catch (e) {
      toast.error(e?.message || "Could not load");
      setDetail(null);
    }
  };

  const recompute = async () => {
    setBusy(true);
    try {
      await apiRequest({ url: P.SCORE_RECOMPUTE, method: "POST", params: { period, date: anchor } });
      toast.success("Scores recalculated");
      load();
    } catch (e) {
      toast.error(e?.message || "Could not recalculate");
    } finally {
      setBusy(false);
    }
  };

  const isCurrent = data && data.periodEnd >= iso(new Date()) && data.periodStart <= iso(new Date());
  const s = data?.summary;
  const items = useMemo(() => data?.items || [], [data]);
  const selectCls = "border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-4">
      {/* period + filters in one row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-gray-300 overflow-hidden" role="radiogroup" aria-label="Period">
          {[["month", "Monthly"], ["week", "Weekly"]].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={period === v} onClick={() => setPeriod(v)}
              className={`px-3 py-2 text-sm ${period === v ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor((a) => shift(a, period, -1))} aria-label="Previous period" className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"><ChevronLeft size={15} /></button>
          <span className="min-w-[130px] text-center text-sm font-semibold text-gray-800">{data?.periodLabel || "…"}{isCurrent ? <span className="ml-1 text-[10px] font-medium text-blue-600">(live)</span> : null}</span>
          <button onClick={() => setAnchor((a) => shift(a, period, 1))} disabled={!!isCurrent} aria-label="Next period" className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={15} /></button>
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={selectCls} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className={selectCls} aria-label="Grade">
          <option value="">All grades</option>
          {GRADES.map((g) => <option key={g}>{g}</option>)}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input data-shortcut="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / code…"
            className="border border-gray-300 rounded-md pl-8 pr-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex-1" />
        <button onClick={recompute} disabled={busy} title="Recalculate and save this period" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Recalculate
        </button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Average</p>
          <p className="text-2xl font-bold mt-1 text-blue-700">{s?.average ?? "—"}</p>
          <p className="text-[11px] text-gray-500">{s ? `${s.scored} of ${s.people} scored` : ""}</p>
        </div>
        {GRADES.map((g) => (
          <button key={g} onClick={() => setGrade((cur) => (cur === g ? "" : g))}
            className={`text-left bg-white rounded-xl border p-4 transition ${grade === g ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200 hover:border-blue-300"}`}>
            <GradePill grade={g} />
            <p className="text-2xl font-bold mt-1.5 text-gray-800">{s?.byGrade?.[g] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* table */}
      <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${loading && data ? "opacity-60" : ""}`}>
        {loading && !data ? (
          <div className="py-16 flex justify-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Calculating…</div>
        ) : items.length === 0 ? (
          <p className="py-14 text-center text-sm text-gray-500">No one matches these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["#", "Emp Code", "Employee", "Department", "Score", "Grade", "Change", "On time", "Quality", "Done", ""].map((h, i) => (
                    <th key={`${h}${i}`} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((r, i) => (
                  <tr key={r.key} tabIndex={0} onClick={() => openDetail(r)} onKeyDown={(e) => e.key === "Enter" && openDetail(r)}
                    className="hover:bg-blue-50/40 cursor-pointer focus:outline-none focus:bg-blue-50/60">
                    <td className="px-4 py-2.5 text-xs text-gray-400 tabular-nums">{r.score == null ? "" : i + 1}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{r.empCode || "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <p className="font-medium text-gray-800">{r.name}</p>
                      {r.designation && <p className="text-[11px] text-gray-500">{r.designation}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.department || "—"}</td>
                    <td className="px-4 py-2.5"><ScoreBar value={r.score} /></td>
                    <td className="px-4 py-2.5"><GradePill grade={r.grade} /></td>
                    <td className="px-4 py-2.5"><Change v={r.change} /></td>
                    <td className="px-4 py-2.5 text-gray-700 tabular-nums whitespace-nowrap">{r.counts?.due ? `${r.counts.onTime}/${r.counts.due}` : "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700 tabular-nums">{r.components?.quality?.score ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700 tabular-nums">{r.counts?.done ?? 0}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.lowData && <span title="Little data this period" className="inline-flex text-amber-600 mr-1"><Info size={14} /></span>}
                      {r.deduction?.points > 0 && <span title={`${r.deduction.openCases} open discipline case(s): −${r.deduction.points}`} className="inline-flex text-red-600"><AlertTriangle size={14} /></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-500">
        Worked out from MIS self tasks and follow-up hand-offs (on time, quality, work done, overdue, pick-up speed), the latest HR review rating, and open discipline cases.
        {isCurrent ? " This period is live and changes as work is done." : " Finished periods are saved; use Recalculate if old data was corrected."}
      </p>

      {/* detail panel */}
      {detail && (
        <div className="fixed inset-0 z-[9994] flex justify-end" role="dialog" data-state="open" aria-modal="true" aria-label="Score details">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <aside className="relative h-full w-full max-w-[560px] bg-gray-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#c4d1df] bg-gradient-to-b from-[#f4f4f4] to-[#e3e3e3]">
              <div>
                <p className="text-[11px] font-semibold text-gray-500">{detail.row?.empCode || ""}{detail.row?.department ? ` · ${detail.row.department}` : ""}</p>
                <h2 className="text-sm font-bold text-gray-800">{detail.row?.name || "Loading…"}</h2>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Close" className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-white"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detail.row ? <ScoreCard row={detail.row} /> : <div className="py-16 flex justify-center text-gray-500"><Loader2 size={16} className="animate-spin" /></div>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
