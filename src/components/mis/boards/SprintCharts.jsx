"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Table2, LineChart } from "lucide-react";
import { toast } from "sonner";
import { boardsSprintApi, workItemApi } from "@/lib/misBoards";
import { fmtDate } from "@/lib/misTasks";

/*
 * Sprint reports: burndown (line), velocity (grouped columns), cumulative flow (stacked area).
 * Plain SVG. Colours are the validated categorical slots 1–4 (light surface), assigned in fixed
 * order by series identity; slots 3–4 sit below 3:1 on the surface, so every chart carries a
 * legend and a table view. Hover: crosshair + tooltip on line/area, per-bar tooltip on columns.
 */
const C = {
  surface: "#fcfcfb", grid: "#e7e6e2", axis: "#8a8984", ink: "#0b0b0b", ink2: "#52514e",
  s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", s4: "#eda100", ref: "#a3a29c",
};
const W = 640, H = 240, M = { t: 12, r: 16, b: 32, l: 44 };
const IW = W - M.l - M.r, IH = H - M.t - M.b;

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};
// counts / points get whole-number ticks; hours may use quarters
const ticks = (max, integer) => {
  if (!integer) return [0, 0.25, 0.5, 0.75, 1].map((f) => +(max * f).toFixed(2));
  const step = Math.max(1, Math.ceil(max / 4));
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
};
const niceInt = (v) => { const s = Math.max(1, Math.ceil(v / 4)); return s * Math.max(1, Math.ceil(v / s)); };
const short = (iso) => fmtDate(iso)?.slice(0, 5) || iso;

function Frame({ title, subtitle, legend, table, children }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4" aria-label={title}>
      <header className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
        </div>
        <button onClick={() => setShowTable((v) => !v)} className="inline-flex items-center gap-1 text-xs text-gray-600 border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-50"
          aria-pressed={showTable}>
          {showTable ? <><LineChart size={13} /> Chart</> : <><Table2 size={13} /> Table</>}
        </button>
      </header>
      {legend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-2" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-gray-700">
              {l.dash
                ? <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke={l.color} strokeWidth="2" strokeDasharray="4 3" /></svg>
                : l.line
                  ? <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke={l.color} strokeWidth="2" strokeLinecap="round" /></svg>
                  : <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} aria-hidden />}
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {showTable ? table : children}
    </section>
  );
}

function Axes({ yMax, unit, xLabels, integer = false }) {
  return (
    <g>
      {ticks(yMax, integer).map((v) => {
        const y = M.t + IH - (v / yMax) * IH;
        return (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y} y2={y} stroke={C.grid} strokeWidth="1" />
            <text x={M.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill={C.ink2}>{v}{unit}</text>
          </g>
        );
      })}
      {xLabels.map(({ x, label }, i) => (
        <text key={i} x={x} y={H - 10} textAnchor="middle" fontSize="10" fill={C.ink2}>{label}</text>
      ))}
    </g>
  );
}

function Tip({ x, y, rows, title }) {
  const left = x > W / 2;
  return (
    <foreignObject x={left ? x - 172 : x + 10} y={Math.max(0, y - 10)} width="162" height={28 + rows.length * 18} style={{ overflow: "visible", pointerEvents: "none" }}>
      <div className="bg-white border border-gray-200 rounded-md shadow-md px-2 py-1.5 text-[11px]">
        <p className="font-semibold text-gray-800 mb-0.5">{title}</p>
        {rows.map((r) => (
          <p key={r.label} className="flex items-center justify-between gap-2 text-gray-700">
            <span className="inline-flex items-center gap-1">
              <svg width="12" height="4" aria-hidden><line x1="0" y1="2" x2="12" y2="2" stroke={r.color} strokeWidth="2" strokeDasharray={r.dash ? "3 2" : undefined} /></svg>{r.label}
            </span>
            <b className="text-gray-900">{r.value}</b>
          </p>
        ))}
      </div>
    </foreignObject>
  );
}

// ── burndown ─────────────────────────────────────────────────────────────

function Burndown({ data }) {
  const [hover, setHover] = useState(null);
  const days = data.days || [];
  const yMax = niceMax(Math.max(1, ...days.map((d) => Math.max(d.idealHours || 0, d.remainingHours ?? 0))));
  const x = (i) => M.l + (days.length <= 1 ? IW / 2 : (i / (days.length - 1)) * IW);
  const y = (v) => M.t + IH - (v / yMax) * IH;
  const actual = days.map((d, i) => (d.remainingHours != null ? [x(i), y(d.remainingHours)] : null));
  const segs = [];
  actual.forEach((p) => { if (!p) segs.push([]); else { if (!segs.length) segs.push([]); segs[segs.length - 1].push(p); } });
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const step = Math.max(1, Math.ceil(days.length / 8));
  const last = [...days].reverse().find((d) => d.remainingHours != null);

  const table = (
    <table className="w-full text-xs"><thead><tr className="text-left text-gray-500"><th className="py-1">Day</th><th>Remaining (h)</th><th>Ideal (h)</th><th>Points done</th></tr></thead>
      <tbody>{days.map((d) => <tr key={d.date} className="border-t border-gray-100"><td className="py-1">{fmtDate(d.date)}</td><td>{d.remainingHours ?? "—"}</td><td>{d.idealHours}</td><td>{d.donePoints ?? "—"}</td></tr>)}</tbody></table>
  );
  return (
    <Frame title="Burndown" subtitle={`Remaining work (hours) per working day${last ? ` · now ${last.remainingHours} h` : ""}`} table={table}
      legend={[{ label: "Remaining work", color: C.s1, line: true }, { label: "Ideal", color: C.ref, dash: true }]}>
      {!days.length ? <p className="text-xs text-gray-500 py-8 text-center">No working days in this sprint.</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Burndown chart"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((px - M.l) / IW) * (days.length - 1));
            setHover(Math.min(days.length - 1, Math.max(0, i)));
          }}>
          <Axes yMax={yMax} unit="h" xLabels={days.map((d, i) => (i % step === 0 || i === days.length - 1 ? { x: x(i), label: short(d.date) } : null)).filter(Boolean)} />
          <path d={path(days.map((d, i) => [x(i), y(d.idealHours || 0)]))} fill="none" stroke={C.ref} strokeWidth="2" strokeDasharray="5 4" />
          {segs.filter((s) => s.length).map((s, i) => (
            <path key={i} d={path(s)} fill="none" stroke={C.s1} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {actual.map((p, i) => p && (days[i].live || i === days.length - 1 || !actual[i + 1]) && (
            <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={C.s1} stroke={C.surface} strokeWidth="2" />
          ))}
          <line x1={M.l} x2={W - M.r} y1={M.t + IH} y2={M.t + IH} stroke={C.axis} strokeWidth="1" />
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + IH} stroke={C.axis} strokeWidth="1" />
              <Tip x={x(hover)} y={M.t} title={fmtDate(days[hover].date)} rows={[
                { label: "Remaining", value: days[hover].remainingHours != null ? `${days[hover].remainingHours} h` : "—", color: C.s1 },
                { label: "Ideal", value: `${days[hover].idealHours} h`, color: C.ref, dash: true },
              ]} />
            </g>
          )}
        </svg>
      )}
    </Frame>
  );
}

// ── velocity ─────────────────────────────────────────────────────────────

function roundedTop(x, y, w, h, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function Velocity({ data }) {
  const [hover, setHover] = useState(null);
  const rows = data?.sprints || [];
  const yMax = niceInt(Math.max(1, ...rows.flatMap((r) => [r.committedPoints, r.donePoints])));
  const band = rows.length ? IW / rows.length : IW;
  const bw = Math.min(24, (band - 12) / 2);
  const y = (v) => M.t + IH - (v / yMax) * IH;
  const table = (
    <table className="w-full text-xs"><thead><tr className="text-left text-gray-500"><th className="py-1">Sprint</th><th>Status</th><th>Committed (pt)</th><th>Done (pt)</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.sprintId} className="border-t border-gray-100"><td className="py-1">{r.name}</td><td>{r.status}</td><td>{r.committedPoints}</td><td>{r.donePoints}</td></tr>)}</tbody></table>
  );
  return (
    <Frame title="Velocity" table={table}
      subtitle={data?.averageVelocity != null ? `Average done per closed sprint: ${data.averageVelocity} pt` : "Story points per sprint (closed sprints + the active one)"}
      legend={[{ label: "Committed", color: C.s1 }, { label: "Done", color: C.s2 }]}>
      {!rows.length ? <p className="text-xs text-gray-500 py-8 text-center">No sprint has story points yet.</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Velocity chart" onMouseLeave={() => setHover(null)}>
          <Axes yMax={yMax} unit="" integer xLabels={rows.map((r, i) => {
            const n = r.name.split(" · ")[0];                // "Week 46 · 9 Nov 2026" → "Week 46"
            return { x: M.l + band * i + band / 2, label: n.length > 14 ? `${n.slice(0, 13)}…` : n };
          })} />
          {rows.map((r, i) => {
            const cx = M.l + band * i + band / 2;
            const bars = [{ v: r.committedPoints, c: C.s1, x: cx - bw - 1 }, { v: r.donePoints, c: C.s2, x: cx + 1 }];
            return (
              <g key={r.sprintId} onMouseEnter={() => setHover(i)} opacity={hover == null || hover === i ? 1 : 0.55}>
                <rect x={cx - band / 2} y={M.t} width={band} height={IH} fill="transparent" />
                {bars.map((b, j) => <path key={j} d={roundedTop(b.x, y(b.v), bw, M.t + IH - y(b.v))} fill={b.c} />)}
                {r.status === "Active" && <text x={cx} y={M.t + 10} textAnchor="middle" fontSize="9" fill={C.ink2}>active</text>}
              </g>
            );
          })}
          <line x1={M.l} x2={W - M.r} y1={M.t + IH} y2={M.t + IH} stroke={C.axis} strokeWidth="1" />
          {hover != null && (
            <Tip x={M.l + band * hover + band / 2} y={M.t} title={rows[hover].name} rows={[
              { label: "Committed", value: `${rows[hover].committedPoints} pt`, color: C.s1 },
              { label: "Done", value: `${rows[hover].donePoints} pt`, color: C.s2 },
            ]} />
          )}
        </svg>
      )}
    </Frame>
  );
}

// ── cumulative flow ──────────────────────────────────────────────────────

const CFD_STATES = [
  { state: "Done", color: C.s4 }, { state: "Committed", color: C.s3 },
  { state: "Approved", color: C.s2 }, { state: "New", color: C.s1 },
];

function CumulativeFlow({ data }) {
  const [hover, setHover] = useState(null);
  const days = (data.days || []).filter((d) => d.stateCounts);
  const counts = days.map((d) => {
    const pbi = d.stateCounts.PBI || {}, bug = d.stateCounts.Bug || {};
    return Object.fromEntries(CFD_STATES.map(({ state }) => [state, (pbi[state] || 0) + (bug[state] || 0)]));
  });
  const totals = counts.map((c) => CFD_STATES.reduce((a, s) => a + c[s.state], 0));
  const yMax = niceInt(Math.max(1, ...totals));
  const x = (i) => M.l + (days.length <= 1 ? IW / 2 : (i / (days.length - 1)) * IW);
  const y = (v) => M.t + IH - (v / yMax) * IH;
  // bottom-up stack: Done at the bottom, New on top (the usual CFD reading)
  const layers = CFD_STATES.map((s, k) => {
    const lo = counts.map((c) => CFD_STATES.slice(0, k).reduce((a, t) => a + c[t.state], 0));
    const hi = counts.map((c, i) => lo[i] + c[s.state]);
    return { ...s, lo, hi };
  });
  const area = (l) => {
    if (days.length === 1) {
      const w = 24;
      return `M${x(0) - w},${y(l.hi[0])} H${x(0) + w} V${y(l.lo[0])} H${x(0) - w} Z`;
    }
    const top = l.hi.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
    const bot = l.lo.map((v, i) => `L${x(i)},${y(v)}`).reverse().join(" ");
    return `${top} ${bot} Z`;
  };
  const step = Math.max(1, Math.ceil(days.length / 8));
  const table = (
    <table className="w-full text-xs"><thead><tr className="text-left text-gray-500"><th className="py-1">Day</th>{[...CFD_STATES].reverse().map((s) => <th key={s.state}>{s.state}</th>)}</tr></thead>
      <tbody>{days.map((d, i) => <tr key={d.date} className="border-t border-gray-100"><td className="py-1">{fmtDate(d.date)}</td>{[...CFD_STATES].reverse().map((s) => <td key={s.state}>{counts[i][s.state]}</td>)}</tr>)}</tbody></table>
  );
  return (
    <Frame title="Cumulative flow" subtitle="PBIs + Bugs in this sprint by state, per snapshot day" table={table}
      legend={[...CFD_STATES].reverse().map((s) => ({ label: s.state, color: s.color }))}>
      {!days.length ? <p className="text-xs text-gray-500 py-8 text-center">No daily snapshots yet — the first one is saved tonight (and on sprint close).</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Cumulative flow chart"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.min(days.length - 1, Math.max(0, Math.round(((px - M.l) / IW) * Math.max(1, days.length - 1)))));
          }}>
          <Axes yMax={yMax} unit="" integer xLabels={days.map((d, i) => (i % step === 0 || i === days.length - 1 ? { x: x(i), label: short(d.date) } : null)).filter(Boolean)} />
          {layers.map((l) => <path key={l.state} d={area(l)} fill={l.color} stroke={C.surface} strokeWidth="2" strokeLinejoin="round" />)}
          <line x1={M.l} x2={W - M.r} y1={M.t + IH} y2={M.t + IH} stroke={C.axis} strokeWidth="1" />
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + IH} stroke={C.ink} strokeOpacity="0.5" strokeWidth="1" />
              <Tip x={x(hover)} y={M.t} title={fmtDate(days[hover].date)}
                rows={[...CFD_STATES].reverse().map((s) => ({ label: s.state, value: counts[hover][s.state], color: s.color }))} />
            </g>
          )}
        </svg>
      )}
    </Frame>
  );
}

export default function SprintCharts({ sprint, projectCode, refreshKey }) {
  const [bd, setBd] = useState(null);
  const [vel, setVel] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sprint) return;
    setLoading(true);
    try {
      const [b, v] = await Promise.all([boardsSprintApi.burndown(sprint.id), workItemApi.velocity(projectCode || "company", 8)]);
      setBd(b?.data || null);
      setVel(v?.data || null);
    } catch (e) {
      toast.error(e?.message || "Could not load the reports");
    } finally {
      setLoading(false);
    }
  }, [sprint, projectCode]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const current = useMemo(() => bd?.current, [bd]);
  if (!sprint) return <p className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">Choose a sprint.</p>;
  if (loading && !bd) return <div className="py-10 flex justify-center text-gray-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (!bd) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: "Remaining work", v: `${current?.remainingHours ?? 0} h` },
          { k: "Committed", v: `${current?.committedPoints ?? 0} pt` },
          { k: "Done", v: `${current?.donePoints ?? 0} pt` },
          { k: "Average velocity", v: vel?.averageVelocity != null ? `${vel.averageVelocity} pt` : "—" },
        ].map((t) => (
          <div key={t.k} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{t.k}</p>
            <p className="text-xl font-bold text-gray-800">{t.v}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Burndown data={bd} />
        <Velocity data={vel} />
        <CumulativeFlow data={bd} />
      </div>
    </div>
  );
}
