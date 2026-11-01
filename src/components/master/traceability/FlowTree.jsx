"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CornerDownRight, MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LINK_KIND,
  STAGE_STYLE,
  buildTreeRows,
  fmtAmt,
  fmtDate,
  fmtQty,
  formatWorkflowStatus,
  isRejected,
  statusClass,
} from "./wbUtils";
import DocIcon from "./DocIcon";

export function LinkChip({ edge }) {
  if (!edge) return null;
  const k = LINK_KIND[edge.kind] || LINK_KIND.HEADER;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex cursor-help items-center whitespace-nowrap rounded border px-1.5 text-[10px] font-semibold ${k.cls}`}>
          {edge.meaning}
          {edge.qty !== null && edge.qty !== undefined ? ` ${fmtQty(edge.qty)}` : ""}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" variant="text" className="max-w-[min(300px,90vw)]">
        <b>{k.label}.</b> {k.help}
        {edge.lineCount ? ` ${edge.lineCount} line(s).` : ""}
        {edge.kind === "ITEM" && edge.qty === null ? " Several items — quantities are not added together." : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export function nodeQty(node) {
  if (!node || node.restricted) return "—";
  if (node.qty !== undefined && node.qty !== null) return `${fmtQty(node.qty)} ${node.unit || ""}`;
  if (node.lineCount) return `${node.lineCount} line${node.lineCount > 1 ? "s" : ""} · ${node.itemCount || 0} item${node.itemCount === 1 ? "" : "s"}`;
  return "—";
}

export default function FlowTree({ nodes, edges, selectedKey, related, onSelect }) {
  const { rows } = useMemo(() => buildTreeRows(nodes, edges), [nodes, edges]);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const visible = rows.filter((r) => ![...collapsed].some((c) => r.path === c || r.path.startsWith(`${c}/`)));
  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="overflow-auto rounded-md border border-[#9e9e9e]">
      <table className="w-full min-w-[820px] border-collapse text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-[#144664] text-white">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">Document</th>
            <th className="px-2 py-1.5 text-left font-semibold">Link from parent</th>
            <th className="px-2 py-1.5 text-left font-semibold">Date</th>
            <th className="px-2 py-1.5 text-left font-semibold">Status</th>
            <th className="hidden px-2 py-1.5 text-left font-semibold 2xl:table-cell">Party / Project</th>
            <th className="px-2 py-1.5 text-right font-semibold">Qty in flow</th>
            <th className="px-2 py-1.5 text-right font-semibold">Doc Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const n = r.node;
            const style = STAGE_STYLE[n.stage] || STAGE_STYLE.REQUISITION;
            const selected = n.key === selectedKey;
            const dim = related && !related.has(n.key);
            const isOpen = !collapsed.has(r.id);
            return (
              <tr
                key={r.id}
                onClick={() => onSelect(n.key)}
                className={`cursor-pointer border-b border-[#e3e8ee] transition-colors ${
                  selected ? "bg-[#fff6cc]" : n.isStart ? "bg-[#eef6ff]" : "bg-white hover:bg-[#f5f9ff]"
                } ${dim ? "opacity-45" : ""}`}
              >
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1.5" style={{ paddingLeft: r.depth * 20 }}>
                    {r.hasChildren ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(r.id);
                        }}
                        className="text-gray-500 hover:text-gray-800"
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    ) : (
                      <span className="w-3.5" />
                    )}
                    {r.isRef && <CornerDownRight className="h-3.5 w-3.5 text-gray-400" />}
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${n.restricted ? "bg-gray-400" : style.dot}`}>
                      <DocIcon node={n} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className={`font-semibold ${n.restricted ? "italic text-gray-500" : isRejected(n.status) ? "text-gray-400 line-through" : "text-[#144664]"}`}>
                          {n.restricted ? "Restricted document" : n.docNo}
                        </span>
                        {n.isStart && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-[#144664] px-1 text-[9.5px] font-bold uppercase text-white">
                            <MapPin className="h-2.5 w-2.5" /> Start
                          </span>
                        )}
                        {n.legacy && <span className="rounded bg-gray-200 px-1 text-[9.5px] font-bold uppercase text-gray-600">Legacy</span>}
                        {r.isRef && <span className="text-[10.5px] italic text-gray-500">also linked here</span>}
                      </span>
                      <span className="block text-[10.5px] text-gray-500">{n.typeLabel}</span>
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1">{r.edge ? <LinkChip edge={r.edge} /> : <span className="text-[11px] text-gray-400">origin</span>}</td>
                <td className="whitespace-nowrap px-2 py-1">{n.restricted ? "—" : fmtDate(n.date)}</td>
                <td className="px-2 py-1">
                  {n.restricted ? (
                    "—"
                  ) : (
                    <span className={`whitespace-nowrap rounded-md border px-1.5 py-[1px] text-[10.5px] font-semibold ${statusClass(n.status)}`}>
                      {formatWorkflowStatus(n.status)}
                    </span>
                  )}
                </td>
                <td className="hidden max-w-[220px] truncate px-2 py-1 text-gray-700 2xl:table-cell" title={n.party || ""}>
                  {n.restricted ? "—" : `${n.party || "—"}${n.projectCode ? ` · ${n.projectCode}` : ""}`}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{nodeQty(n)}</td>
                <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">
                  {n.amount !== null && n.amount !== undefined ? fmtAmt(n.amount) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
