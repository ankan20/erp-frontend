"use client";

import LogisticsStatusBadge from "./LogisticsStatusBadge";

// ─────────────────────────────────────────────────────────────────────────────
// Document header for TR / DC / LB detail pages.
//
// Reads like a shipping manifest banner: big mono doc number anchored left,
// status chips on a vertical rail next to it, a single line of meta facts
// underneath, and (optionally) one action button on the right.
//
// Props
//   number      "TR23/1234"          — big mono string, leading identity
//   kind        "Transit Request"    — small label above the number
//   statuses    [{label, value}]     — the badges to show on the right of the number
//   meta        [{label, value}]     — one-line facts (date · priority · carrier)
//   action      { label, icon, onClick } — optional CTA, pinned top-right
// ─────────────────────────────────────────────────────────────────────────────

export default function LogisticsDocHeader({
  number,
  kind,
  statuses = [],
  meta = [],
  action,
}) {
  return (
    <header className="bg-white border border-[#CBD5DD] border-l-[3px] border-l-[#C97B2E]">
      <div className="flex items-start justify-between gap-4 px-4 py-3">

        {/* Left: identity + statuses */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            {kind && (
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#C97B2E]">
                {kind}
              </div>
            )}
            <div className="font-mono text-[20px] leading-tight font-bold text-[#0F2A3C] tabular-nums tracking-tight truncate">
              {number || "—"}
            </div>
          </div>

          {statuses.length > 0 && (
            <>
              <span className="h-10 w-px bg-[#CBD5DD] shrink-0" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                {statuses.map(({ label, value }, i) => (
                  <div key={i} className="flex items-center gap-2 min-h-[18px]">
                    <span className="text-[9.5px] uppercase tracking-[0.15em] font-semibold text-[#4B5A66] w-[70px] shrink-0">
                      {label}
                    </span>
                    <LogisticsStatusBadge status={value} size="xs" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: single CTA */}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 inline-flex items-center gap-1.5 bg-[#0F2A3C] hover:bg-[#1E4968] text-white text-[12px] font-medium px-3 py-2 transition-colors border-b-2 border-[#C97B2E]"
          >
            {action.icon ? <action.icon className="w-3.5 h-3.5" /> : null}
            {action.label}
          </button>
        )}
      </div>

      {/* Meta row — single line of facts */}
      {meta.length > 0 && (
        <div className="px-4 py-1.5 border-t border-dashed border-[#CBD5DD] bg-[#FBFAF6] flex items-center gap-x-5 gap-y-1 flex-wrap">
          {meta.map(({ label, value }, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-[11.5px]">
              <span className="uppercase tracking-wide text-[9.5px] font-semibold text-[#4B5A66]">
                {label}
              </span>
              <span className="font-medium text-[#0F2A3C]">
                {value ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
