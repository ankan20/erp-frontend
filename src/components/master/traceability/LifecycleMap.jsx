"use client";

import { MapPin } from "lucide-react";
import { STAGE_STYLE, fmtAmt, fmtDate, formatWorkflowStatus, isRejected, statusClass } from "./wbUtils";
import { nodeQty } from "./FlowTree";
import DocIcon from "./DocIcon";

function Card({ n, selected, dim, onSelect }) {
  const style = STAGE_STYLE[n.stage];
  return (
    <button
      type="button"
      onClick={() => onSelect(n.key)}
      className={`w-full rounded-md border px-2 py-1.5 text-left shadow-sm transition ${
        selected ? "border-amber-400 bg-[#fff6cc] ring-2 ring-amber-200" : n.isStart ? "border-[#2f6f9f] bg-[#eef6ff]" : "border-[#d7dce3] bg-white hover:border-[#2f6f9f]"
      } ${dim ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${n.restricted ? "bg-gray-400" : style.dot}`}>
          <DocIcon node={n} className="h-3 w-3" />
        </span>
        <span className={`truncate text-[12px] font-semibold ${n.restricted ? "italic text-gray-500" : isRejected(n.status) ? "text-gray-400 line-through" : "text-[#144664]"}`}>
          {n.restricted ? "Restricted" : n.docNo}
        </span>
        {n.isStart && <MapPin className="h-3 w-3 shrink-0 text-[#144664]" />}
      </div>
      <div className="mt-0.5 truncate text-[10.5px] text-gray-500">{n.typeLabel}</div>
      {!n.restricted && (
        <>
          <div className="mt-1 flex items-center justify-between gap-1">
            <span className={`rounded border px-1 text-[9.5px] font-semibold ${statusClass(n.status)}`}>{formatWorkflowStatus(n.status)}</span>
            <span className="text-[10.5px] text-gray-500">{fmtDate(n.date)}</span>
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-gray-700">
            {n.amount !== null && n.amount !== undefined ? `₹ ${fmtAmt(n.amount)}` : nodeQty(n)}
          </div>
        </>
      )}
    </button>
  );
}

export default function LifecycleMap({ stages, nodes, selectedKey, related, onSelect }) {
  const byStage = {};
  for (const n of nodes) (byStage[n.stage] ||= []).push(n);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[1100px] grid-cols-8 gap-2">
        {stages.map((s, i) => {
          const list = byStage[s.key] || [];
          const style = STAGE_STYLE[s.key];
          return (
            <div key={s.key} className="flex min-w-0 flex-col rounded-md border border-[#e3e8ee] bg-[#fafbfd]">
              <div className="flex items-center gap-1.5 border-b border-[#e3e8ee] px-2 py-1.5">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${style.dot}`}>{i + 1}</span>
                <span className="truncate text-[11.5px] font-semibold text-gray-700">{s.label}</span>
                <span className="ml-auto rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold text-gray-600">{list.length}</span>
              </div>
              <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto p-1.5">
                {list.length ? (
                  list.map((n) => (
                    <Card key={n.key} n={n} selected={n.key === selectedKey} dim={related && !related.has(n.key)} onSelect={onSelect} />
                  ))
                ) : (
                  <div className="py-4 text-center text-[11px] text-gray-400">No documents</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
