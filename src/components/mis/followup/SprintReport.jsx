"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Table2, LineChart } from "lucide-react";
import { sprintApi } from "@/lib/misFollowups";
import { fmtDate } from "@/lib/misTasks";

// chart tokens — actual = ERP primary blue (validated: L band, chroma, 3:1 on white); ideal = neutral reference
const num = (v) => (v == null ? "—" : Number.isInteger(v) ? v : Number(v).toFixed(1));

const C = { actual: "#2563eb", ideal: "#9ca3af", grid: "#eef0f3", axis: "#6b7280", ink: "#1f2937", surface: "#ffffff" };

function Stat({ label, value, sub, tone = "text-gray-800" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Burndown: remaining work per day vs the ideal straight line. One y-axis. */
function Burndown({ data, unit }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 240, M = { t: 16, r: 64, b: 28, l: 36 };
  const iw = w - M.l - M.r, ih = H - M.t - M.b;
  const key = unit === "points" ? { act: "remainingPoints", ideal: "idealPoints" } : { act: "remainingItems", ideal: "idealItems" };
  const n = data.length;
  const maxY = Math.max(1, ...data.map((d) => Math.max(d[key.act] ?? 0, d[key.ideal] ?? 0)),
    ...(n ? [unit === "points" ? (data[0].idealPoints ?? 0) : (data[0].idealItems ?? 0)] : []));
  const x = (i) => M.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => M.t + ih - (v / maxY) * ih;
  const ticks = Array.from(new Set([0, Math.round(maxY / 2), Math.round(maxY)]));

  const actualPts = data.map((d, i) => (d[key.act] == null ? null : [x(i), y(d[key.act])])).filter(Boolean);
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const idealPts = data.map((d, i) => [x(i), y(d[key.ideal])]);
  const lastActual = actualPts[actualPts.length - 1];
  const lastIdx = data.reduce((acc, d, i) => (d[key.act] != null ? i : acc), -1);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - M.l;
    const i = Math.round(n <= 1 ? 0 : (px / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const hd = hover != null ? data[hover] : null;

  return (
    <div ref={wrapRef} className="relative">
      <svg width={w} height={H} role="img" aria-label={`Burndown of remaining ${unit}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={M.l + iw} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={M.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill={C.axis}>{t}</text>
          </g>
        ))}
        {data.map((d, i) => (n <= 10 || i % Math.ceil(n / 8) === 0 || i === n - 1) && (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={C.axis}>{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</text>
        ))}
        <path d={path(idealPts)} fill="none" stroke={C.ideal} strokeWidth="2" strokeDasharray="5 4" />
        {actualPts.length > 0 && <path d={path(actualPts)} fill="none" stroke={C.actual} strokeWidth="2" strokeLinejoin="round" />}
        {lastActual && <circle cx={lastActual[0]} cy={lastActual[1]} r="4" fill={C.actual} stroke={C.surface} strokeWidth="2" />}
        {/* direct labels at line ends */}
        {lastActual && (
          <text x={lastActual[0] + 8} y={lastActual[1]} dominantBaseline="middle" fontSize="11" fill={C.ink} fontWeight="600">
            {data[lastIdx][key.act]} left
          </text>
        )}
        {/* ideal label sits just above its end point so it never touches the x-axis dates or the actual label */}
        <text x={x(n - 1) + 8} y={y(data[n - 1]?.[key.ideal] ?? 0) - 10} dominantBaseline="middle" fontSize="10" fill={C.axis}>ideal</text>
        {hd && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} stroke={C.axis} strokeWidth="1" opacity="0.5" />
            {hd[key.act] != null && <circle cx={x(hover)} cy={y(hd[key.act])} r="4" fill={C.actual} stroke={C.surface} strokeWidth="2" />}
          </g>
        )}
      </svg>
      {hd && (
        <div className="absolute pointer-events-none bg-white border border-gray-200 shadow-lg rounded-md px-2.5 py-1.5 text-xs"
          style={{ left: Math.min(x(hover) + 10, w - 150), top: 8 }}>
          <p className="text-gray-500 mb-0.5">{fmtDate(hd.date)}</p>
          <p className="flex items-center gap-2"><span className="w-3 h-0.5" style={{ background: C.actual }} />
            <b className="text-gray-900">{hd[key.act] ?? "—"}</b><span className="text-gray-500">remaining</span></p>
          <p className="flex items-center gap-2"><span className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: C.ideal }} />
            <b className="text-gray-900">{num(hd[key.ideal])}</b><span className="text-gray-500">ideal</span></p>
        </div>
      )}
    </div>
  );
}

export default function SprintReport({ sprintId }) {
  // { id, data } — loading = the stored report is not for the current sprint (no setState in the effect body)
  const [state, setState] = useState({ id: null, data: null });
  const [unitPick, setUnit] = useState("items");
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    if (!sprintId) return;
    let alive = true;
    sprintApi.report(sprintId)
      .then((r) => alive && setState({ id: sprintId, data: r?.data || null }))
      .catch(() => alive && setState({ id: sprintId, data: null }));
    return () => { alive = false; };
  }, [sprintId]);

  const loading = state.id !== sprintId;
  const rep = state.data;
  const s = rep?.summary;
  const hasPoints = (s?.points ?? 0) > 0;
  const unit = hasPoints ? unitPick : "items";
  const people = useMemo(() => rep?.people || [], [rep]);

  if (!sprintId) return <p className="text-sm text-gray-500 py-10 text-center">Choose a sprint to see its report.</p>;
  if (loading && !rep) return <div className="py-16 flex justify-center text-gray-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (!rep) return <p className="text-sm text-gray-500 py-10 text-center">Report not available.</p>;

  return (
    <div className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Completed" value={`${s.completionPct}%`} sub={`${s.doneItems} of ${s.items} items`} tone="text-emerald-600" />
        <Stat label="Story points" value={`${s.donePoints} / ${s.points}`} sub="done / planned" tone="text-blue-700" />
        <Stat label="In review" value={s.byStatus.Review} sub={`${s.byStatus["In Progress"]} in progress`} tone="text-violet-700" />
        <Stat label="Overdue" value={s.overdue} tone={s.overdue ? "text-red-600" : "text-gray-800"} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Burndown</h3>
            <p className="text-[11px] text-gray-500">Work left at the end of each day</p>
          </div>
          <div className="flex items-center gap-3">
            {/* legend */}
            <span className="flex items-center gap-1.5 text-[11px] text-gray-600"><span className="w-4 h-0.5" style={{ background: C.actual }} /> Remaining</span>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-600"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: C.ideal }} /> Ideal</span>
            {hasPoints && (
              <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit"
                className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white">
                <option value="items">Items</option><option value="points">Points</option>
              </select>
            )}
            <button onClick={() => setAsTable((v) => !v)} title={asTable ? "Show chart" : "Show table"} aria-label={asTable ? "Show chart" : "Show table"}
              className="p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">
              {asTable ? <LineChart size={14} /> : <Table2 size={14} />}
            </button>
          </div>
        </div>
        {asTable ? (
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase"><tr>
                <th className="px-3 py-1.5 text-left">Date</th><th className="px-3 py-1.5 text-right">Remaining</th><th className="px-3 py-1.5 text-right">Ideal</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rep.burndown.map((d) => (
                  <tr key={d.date}>
                    <td className="px-3 py-1">{fmtDate(d.date)}</td>
                    <td className="px-3 py-1 text-right font-medium">{(unit === "points" ? d.remainingPoints : d.remainingItems) ?? "—"}</td>
                    <td className="px-3 py-1 text-right text-gray-500">{num(unit === "points" ? d.idealPoints : d.idealItems)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Burndown data={rep.burndown} unit={unit} />}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">People</h3>
          <p className="text-[11px] text-gray-500">Steps each person handled in this sprint</p>
        </div>
        {people.length === 0 ? <p className="text-sm text-gray-500 p-4">No steps yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                {["Person", "Assigned", "Done", "Open", "On time", "Rework", "Avg pick-up"].map((h, i) => (
                  <th key={h} className={`px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide ${i ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {people.map((p) => (
                  <tr key={p.userId}>
                    <td className="px-4 py-2 text-gray-800 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-right">{p.assigned}</td>
                    <td className="px-4 py-2 text-right">{p.done}</td>
                    <td className="px-4 py-2 text-right">{p.open}</td>
                    <td className="px-4 py-2 text-right">{p.onTimePct == null ? "—" : `${p.onTimePct}%`}</td>
                    <td className={`px-4 py-2 text-right ${p.rework ? "text-purple-700 font-semibold" : ""}`}>{p.rework}</td>
                    <td className="px-4 py-2 text-right">{p.avgPickupHours == null ? "—" : `${p.avgPickupHours} h`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
