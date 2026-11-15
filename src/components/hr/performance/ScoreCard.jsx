"use client";

import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

// Grade = a state → always shown as text + colour, never colour alone.
export const GRADE_STYLE = {
  Excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Good: "bg-blue-50 text-blue-700 border-blue-200",
  Average: "bg-amber-50 text-amber-700 border-amber-200",
  "Needs Improvement": "bg-red-50 text-red-700 border-red-200",
  "No data": "bg-gray-50 text-gray-500 border-gray-200",
};
const GRADE_INK = {
  Excellent: "text-emerald-700", Good: "text-blue-700", Average: "text-amber-700", "Needs Improvement": "text-red-700", "No data": "text-gray-400",
};
const BAR = "#2563eb";          // single-hue magnitude (ERP primary, validated)
const TRACK = "#eef0f3";

export function GradePill({ grade, className = "" }) {
  return <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full border font-medium whitespace-nowrap ${GRADE_STYLE[grade] || GRADE_STYLE["No data"]} ${className}`}>{grade}</span>;
}

/** 0–100 bar with the value written next to it (never colour-only). */
export function ScoreBar({ value, width = 120 }) {
  if (value == null) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 rounded-full overflow-hidden" style={{ width, background: TRACK }}>
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, value)}%`, background: BAR }} />
      </span>
      <span className="text-sm font-semibold text-gray-800 tabular-nums w-10 text-right">{Number(value).toFixed(0)}</span>
    </span>
  );
}

/** Small trend line, one series. Hover / focus a point to read it. */
export function Trend({ points = [], height = 64 }) {
  const [hover, setHover] = useState(null);
  const W = 260, H = height, P = { l: 8, r: 8, t: 10, b: 18 };
  const n = points.length;
  if (!n) return null;
  const x = (i) => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (n - 1));
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / 100);
  const pts = points.map((p, i) => (p.score == null ? null : [x(i), y(p.score)]));
  // draw segments only between consecutive periods that have a score
  const segs = [];
  pts.forEach((p, i) => { if (p && pts[i - 1]) segs.push(`M${pts[i - 1][0]},${pts[i - 1][1]}L${p[0]},${p[1]}`); });
  const h = hover != null ? points[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
        aria-label={`Score trend: ${points.map((p) => `${p.periodLabel} ${p.score ?? "no data"}`).join(", ")}`}>
        <line x1={P.l} x2={W - P.r} y1={y(50)} y2={y(50)} stroke={TRACK} />
        <path d={segs.join("")} fill="none" stroke={BAR} strokeWidth="2" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.periodStart} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
            <rect x={x(i) - 14} y={0} width={28} height={H} fill="transparent" />
            {pts[i] ? <circle cx={pts[i][0]} cy={pts[i][1]} r={i === n - 1 ? 4.5 : 3.5} fill={BAR} stroke="#fff" strokeWidth="2" />
              : <circle cx={x(i)} cy={y(0) - 2} r="2" fill="#d1d5db" />}
            <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{p.periodLabel.split(" ")[0]}</text>
          </g>
        ))}
      </svg>
      {h && (
        <div className="absolute -top-1 pointer-events-none bg-white border border-gray-200 shadow rounded px-2 py-1 text-[11px]"
          style={{ left: `${Math.min(70, (x(hover) / W) * 100)}%` }}>
          <b className="text-gray-900">{h.score ?? "—"}</b> <span className="text-gray-500">{h.periodLabel}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Full score card: big number, grade, trend, and every part with its reason.
 *   row — one score row from the API (with .trend)
 */
export default function ScoreCard({ row, title = "Performance score", compact = false }) {
  if (!row) return null;
  // biggest weight first (the API's JSON keys arrive alphabetically)
  const parts = Object.entries(row.components || {}).sort((a, b) => (b[1]?.weight ?? 0) - (a[1]?.weight ?? 0));
  const ded = row.deduction?.points || 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-start gap-5 p-4">
        <div className="min-w-[140px]">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
          <p className={`text-4xl font-bold mt-1 tabular-nums ${GRADE_INK[row.grade] || "text-gray-800"}`}>
            {row.score == null ? "—" : Number(row.score).toFixed(0)}<span className="text-base text-gray-400 font-semibold">/100</span>
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <GradePill grade={row.grade} />
            <span className="text-[11px] text-gray-500">{row.periodLabel}</span>
          </div>
          {row.lowData && (
            <p className="mt-2 text-[11px] text-amber-700 inline-flex items-center gap-1"><Info size={12} /> Little data this period</p>
          )}
        </div>
        {row.trend?.length > 0 && (
          <div className="flex-1 min-w-[220px]">
            <p className="text-[11px] text-gray-500 mb-1">Last {row.trend.length} {row.period === "week" ? "weeks" : "months"}</p>
            <Trend points={row.trend} />
          </div>
        )}
      </div>

      {!compact && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">How it is worked out</p>
          <ul className="space-y-2">
            {parts.map(([k, p]) => (
              <li key={k} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[180px_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5">
                <span className="text-sm text-gray-700">{p.label} <span className="text-[10px] text-gray-400">· {p.weight}%</span></span>
                <ScoreBar value={p.score} width={110} />
                <span className="text-[11px] text-gray-500 col-span-2 sm:col-span-1 truncate" title={p.detail}>{p.detail}</span>
              </li>
            ))}
            {ded > 0 && (
              <li className="flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle size={14} /> −{ded} points for {row.deduction.openCases} open discipline case{row.deduction.openCases > 1 ? "s" : ""}
              </li>
            )}
          </ul>
          <p className="mt-2 text-[10px] text-gray-400">Parts with no data are left out and the others count for more.</p>
        </div>
      )}
    </div>
  );
}
