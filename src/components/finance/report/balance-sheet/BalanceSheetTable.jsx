"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import { formatAmount } from "@/helper/numberFormatter";
import { useColumnResize } from "@/hooks/useColumnResize";
import { buildELRows, buildAssetsRows } from "./buildBalanceSheetRows";

// ─── Row styling ──────────────────────────────────────────────────────────────

const EL_DEPTH_BG = [
  "bg-[#cfe4d4] text-[#14532d] font-semibold",
  "bg-[#dff0e5] text-[#1a6b3a] font-semibold",
  "bg-[#ecf7ef] text-[#286b42] font-semibold",
];
const AS_DEPTH_BG = [
  "bg-[#c8dff0] text-[#0d2f4d] font-semibold",
  "bg-[#dceef8] text-[#1a4d70] font-semibold",
  "bg-[#ebf3fc] text-[#2e5a72] font-semibold",
];

function rowBg(type, depth, side) {
  const palette = side === "el" ? EL_DEPTH_BG : AS_DEPTH_BG;
  if (type === "grand-total") return "bg-[#144664] text-white font-bold";
  if (type === "section-total") return palette[0];
  if (type === "subtotal")     return palette[Math.min(depth, palette.length - 1)];
  if (type === "group")        return palette[Math.min(depth, palette.length - 1)];
  return "bg-white text-gray-800";
}

// ─── Amount cell ──────────────────────────────────────────────────────────────

function Amount({ value, bold }) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
  const neg = value < 0;
  return (
    <span className={`tabular-nums ${bold ? "font-semibold" : ""} ${neg ? "text-red-600" : ""}`}>
      {formatAmount(value)}
    </span>
  );
}

// ─── Single panel table ───────────────────────────────────────────────────────

function Panel({ title, rows, side, headerBg = "#144664" }) {
  const { tableRef } = useColumnResize();

  const groupIds = useMemo(() => rows.filter((r) => r.type === "group").map((r) => r.id), [rows]);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const collapseAll = () => setCollapsed(new Set(groupIds));
  const expandAll   = () => setCollapsed(new Set());
  const allCollapsed = groupIds.length > 0 && collapsed.size === groupIds.length;

  const visible = useMemo(
    () => rows.filter((r) => !(r.ancestors || []).some((a) => collapsed.has(a))),
    [rows, collapsed],
  );

  return (
    <div className="flex flex-col flex-1 min-w-0 border border-[#b5b5b5] rounded-sm overflow-hidden">
      {/* Panel header */}
      <div
        className="px-3 py-2 text-white text-[13px] font-bold tracking-wide flex items-center justify-between"
        style={{ background: headerBg }}
      >
        <span>{title}</span>
        <button
          onClick={allCollapsed ? expandAll : collapseAll}
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-sm bg-white/15 hover:bg-white/25 transition-colors"
        >
          {allCollapsed ? <ChevronsUpDown size={12} /> : <ChevronsDownUp size={12} />}
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full min-w-[360px] border-collapse text-[12px]">
          <thead className="sticky top-0 z-20">
            <tr style={{ background: headerBg }} className="text-white text-[11px]">
              <th className="border border-[#2e5a72] px-2 py-1.5 text-left w-[60px] min-w-[60px]">Code</th>
              <th className="border border-[#2e5a72] px-2 py-1.5 text-left min-w-[200px]">Particulars</th>
              <th className="border border-[#2e5a72] px-2 py-1.5 text-right w-[130px] min-w-[130px]">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const band   = rowBg(row.type, row.depth, side);
              const isOpen = !collapsed.has(row.id);
              const isG    = row.type === "group";
              const isBold = row.type !== "item";

              return (
                <tr
                  key={row.id}
                  className={`${band} ${isG ? "cursor-pointer hover:brightness-[0.97]" : ""}`}
                  onClick={isG ? () => toggle(row.id) : undefined}
                >
                  {/* Code */}
                  <td className="border border-[#d0d0d0] px-2 py-[3px] whitespace-nowrap align-top text-[11px]">
                    {row.code || ""}
                  </td>

                  {/* Particulars */}
                  <td
                    className="border border-[#d0d0d0] px-2 py-[3px]"
                    style={{ paddingLeft: `${8 + (row.depth || 0) * 14}px` }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isG ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggle(row.id); }}
                          className="p-0.5 rounded hover:bg-black/10 transition shrink-0"
                        >
                          {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </button>
                      ) : (
                        <span className="inline-block w-[15px] shrink-0" />
                      )}
                      <span>{row.label}</span>
                      {isG && !isOpen && (
                        <span className="ml-1 text-[10px] font-normal opacity-60">(collapsed)</span>
                      )}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="border border-[#d0d0d0] px-2 py-[3px] text-right align-top">
                    {/* Groups show no value (sub-total row below does); section-total + subtotal + item show value */}
                    {row.type !== "group" ? (
                      <Amount value={row.value} bold={isBold} />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Grand total bar ──────────────────────────────────────────────────────────

function GrandTotalBar({ elTotal, assetsTotal }) {
  const diff = (assetsTotal ?? 0) - (elTotal ?? 0);
  const balanced = Math.abs(diff) < 0.005;
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-1 text-[12px]">
      <div className="flex-1 flex items-center justify-between bg-[#144664] text-white px-3 py-2 rounded-sm">
        <span className="font-semibold">Grand Total — Equity &amp; Liabilities</span>
        <span className="tabular-nums font-bold text-[13px]">{formatAmount(elTotal ?? 0)}</span>
      </div>
      <div className="flex-1 flex items-center justify-between bg-[#144664] text-white px-3 py-2 rounded-sm">
        <span className="font-semibold">Grand Total — Assets</span>
        <span className="tabular-nums font-bold text-[13px]">{formatAmount(assetsTotal ?? 0)}</span>
      </div>
      {!balanced && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-sm text-red-700">
          <span className="font-semibold">Difference</span>
          <span className="tabular-nums font-bold">{formatAmount(Math.abs(diff))}</span>
          <span className="text-[10px]">(sheet is not balanced)</span>
        </div>
      )}
      {balanced && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-300 rounded-sm text-green-700">
          <span className="font-semibold text-[12px]">✓ Balanced</span>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function BalanceSheetTable({ data }) {
  const elRows     = useMemo(() => buildELRows(data?.equityAndLiabilities), [data]);
  const assetRows  = useMemo(() => buildAssetsRows(data?.assets), [data]);

  if (!data) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-col lg:flex-row gap-3">
        <Panel
          title="Equity & Liabilities"
          rows={elRows}
          side="el"
          headerBg="#144664"
        />
        <Panel
          title="Assets"
          rows={assetRows}
          side="assets"
          headerBg="#1a4d70"
        />
      </div>
      <GrandTotalBar
        elTotal={data.equityAndLiabilities?.grandTotal}
        assetsTotal={data.assets?.grandTotal}
      />
    </div>
  );
}
