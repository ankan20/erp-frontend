"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import { PL_COLUMNS } from "@/config/profitLoss.config";
import { formatAmount } from "@/helper/numberFormatter";

/**
 * ProfitLossTable — read-only rendering of the P&L statement.
 *
 * Colour: Sale and Expenses each get their own family, and a nested group is a
 * lighter shade of its parent — B (darkest) → B.1 / B.2 → B.2.1 / B.2.2 / B.2.3.
 * Leaf rows stay white so the figures read cleanly.
 *
 * Collapse: every group row folds away its descendants at any level. The group's
 * own subtotal stays visible, so collapsing summarises rather than hides.
 *
 * Ref / Code / Particulars stay pinned while the 10 value columns scroll.
 */

// family → shade by depth (0 = outermost). Last entry repeats for deeper levels.
const FAMILY = {
  sale: {
    shades: ["bg-[#cfe8d4]"],
    text:   "text-[#14532d]",
    accent: "text-[#2f7a45]",
  },
  expense: {
    shades: ["bg-[#f7d4d4]", "bg-[#fae4e4]", "bg-[#fdf0f0]"],
    text:   "text-[#7f1d1d]",
    accent: "text-[#a34444]",
  },
  result: {
    shades: ["bg-[#bcd6ec]"],
    text:   "text-[#0d2f4d]",
    accent: "text-[#2e5a72]",
  },
};

function rowStyle(row) {
  if (!row.family) return { bg: "bg-white", text: "text-gray-800" };
  const fam = FAMILY[row.family] || FAMILY.result;
  // Leaves stay white — only groups and the bottom line carry a band
  if (!row.isGroup && row.family !== "result") {
    return { bg: "bg-white", text: "text-gray-800" };
  }
  const shade = fam.shades[Math.min(row.depth, fam.shades.length - 1)];
  return { bg: shade, text: fam.text, accent: fam.accent };
}

// Pinned-column offsets must match the widths below
const STICKY = {
  ref:   "sticky left-0 z-20 w-[92px] min-w-[92px]",
  code:  "sticky left-[92px] z-20 w-[62px] min-w-[62px]",
  title: "sticky left-[154px] z-20 min-w-[240px]",
};

function Amount({ value, bold }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-300">—</span>;
  }
  const negative = value < 0;
  return (
    <span className={`tabular-nums ${bold ? "font-semibold" : ""} ${negative ? "text-red-600" : ""}`}>
      {formatAmount(value)}
    </span>
  );
}

function Percent({ value }) {
  if (value === null || value === undefined || !isFinite(value)) {
    return <span className="text-gray-300">—</span>;
  }
  return <span className="tabular-nums text-[11px] text-gray-600">{value.toFixed(2)}%</span>;
}

export default function ProfitLossTable({ rows = [] }) {
  const groupRefs = useMemo(
    () => rows.filter((r) => r.isGroup).map((r) => r.ref),
    [rows],
  );

  // Opens fully collapsed — A / B / C only — so the statement reads as a summary
  // first and you drill into whichever branch you care about.
  const [collapsed, setCollapsed] = useState(() => new Set(groupRefs));

  // A fresh fetch starts collapsed again (no effect needed — derive on render)
  const [renderedRows, setRenderedRows] = useState(rows);
  if (renderedRows !== rows) {
    setRenderedRows(rows);
    setCollapsed(new Set(groupRefs));
  }

  const toggle = (ref) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  const collapseAll = () => setCollapsed(new Set(groupRefs));
  const expandAll   = () => setCollapsed(new Set());

  // A row disappears when any of its enclosing groups is collapsed
  const visible = useMemo(
    () => rows.filter((r) => !(r.ancestors || []).some((a) => collapsed.has(a))),
    [rows, collapsed],
  );

  const allCollapsed = groupRefs.length > 0 && collapsed.size === groupRefs.length;

  return (
    <div className="border border-[#b5b5b5] rounded-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-[#eef3f7] border-b border-[#b5b5b5]">
        <button
          onClick={allCollapsed ? expandAll : collapseAll}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] rounded-sm border border-[#8f8f8f] bg-white text-gray-700 hover:bg-gray-100 transition-colors"
        >
          {allCollapsed ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />}
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>
        <span className="text-[11px] text-gray-500">
          Click any group row to fold or unfold its lines
        </span>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-gray-600">
          <Legend swatch="bg-[#cfe8d4]" label="Sale" />
          <Legend swatch="bg-[#f7d4d4]" label="Expenses" />
          <Legend swatch="bg-[#bcd6ec]" label="Profit & Loss" />
        </span>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-300px)]">
        <table className="w-full min-w-[1180px] border-collapse text-[12px]">
          <thead className="sticky top-0 z-30">
            <tr className="bg-[#144664] text-white">
              <th className={`${STICKY.ref} bg-[#144664] border border-[#2e5a72] px-2 py-2 text-left font-semibold`}>
                Ref
              </th>
              <th className={`${STICKY.code} bg-[#144664] border border-[#2e5a72] px-2 py-2 text-left font-semibold`}>
                Code
              </th>
              <th className={`${STICKY.title} bg-[#144664] border border-[#2e5a72] px-2 py-2 text-left font-semibold`}>
                Particulars
              </th>
              {PL_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  colSpan={2}
                  className="border border-[#2e5a72] px-2 py-2 text-center font-semibold w-[168px] min-w-[168px]"
                >
                  {c.label}
                </th>
              ))}
            </tr>
            <tr className="bg-[#1d5a80] text-white text-[11px]">
              <th className={`${STICKY.ref} bg-[#1d5a80] border border-[#2e5a72] px-2 py-1`} />
              <th className={`${STICKY.code} bg-[#1d5a80] border border-[#2e5a72] px-2 py-1`} />
              <th className={`${STICKY.title} bg-[#1d5a80] border border-[#2e5a72] px-2 py-1`} />
              {PL_COLUMNS.map((c) => (
                <FragmentHead key={c.key} />
              ))}
            </tr>
          </thead>

          <tbody>
            {visible.map((row) => {
              const { bg, text, accent } = rowStyle(row);
              const isBold  = row.isGroup || row.family === "result";
              const band    = `${bg} ${text} ${isBold ? "font-semibold" : ""}`;
              const isOpen  = !collapsed.has(row.ref);

              return (
                <tr
                  key={row.ref}
                  className={`${band} ${row.isGroup ? "cursor-pointer hover:brightness-[0.97]" : ""}`}
                  onClick={row.isGroup ? () => toggle(row.ref) : undefined}
                >
                  <td className={`${STICKY.ref} ${band} border border-[#d0d0d0] px-2 py-[3px] whitespace-nowrap`}>
                    <span className="inline-flex items-center gap-1">
                      {row.isGroup ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggle(row.ref); }}
                          title={isOpen ? "Collapse" : "Expand"}
                          className={`p-0.5 rounded hover:bg-black/10 transition ${accent || ""}`}
                        >
                          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      ) : (
                        <span className="inline-block w-[17px]" />
                      )}
                      {row.ref}
                    </span>
                  </td>

                  <td className={`${STICKY.code} ${band} border border-[#d0d0d0] px-2 py-[3px] whitespace-nowrap`}>
                    {row.code}
                  </td>

                  <td
                    className={`${STICKY.title} ${band} border border-[#d0d0d0] px-2 py-[3px]`}
                    style={{ paddingLeft: `${8 + row.depth * 14}px` }}
                  >
                    {row.title}
                    {row.isGroup && !isOpen && (
                      <span className="ml-2 text-[10px] font-normal opacity-70">(collapsed)</span>
                    )}
                  </td>

                  {PL_COLUMNS.map((c) => (
                    <FragmentCell
                      key={c.key}
                      value={row.values?.[c.key]}
                      percent={row.percents?.[c.key]}
                      bold={isBold}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ swatch, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded-[2px] border border-black/10 ${swatch}`} />
      {label}
    </span>
  );
}

// Sub-header pair under each value column
function FragmentHead() {
  return (
    <>
      <th className="border border-[#2e5a72] px-2 py-1 text-right font-medium w-[118px] min-w-[118px]">Amount</th>
      <th className="border border-[#2e5a72] px-1 py-1 text-right font-medium w-[50px] min-w-[50px]">%</th>
    </>
  );
}

function FragmentCell({ value, percent, bold }) {
  return (
    <>
      <td className="border border-[#d0d0d0] px-2 py-[3px] text-right">
        <Amount value={value} bold={bold} />
      </td>
      <td className="border border-[#d0d0d0] px-1 py-[3px] text-right">
        <Percent value={percent} />
      </td>
    </>
  );
}
