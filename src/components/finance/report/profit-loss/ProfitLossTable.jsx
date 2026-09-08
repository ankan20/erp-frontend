"use client";

import { PL_COLUMNS } from "@/config/profitLoss.config";
import { formatAmount } from "@/helper/numberFormatter";

/**
 * ProfitLossTable — read-only rendering of the P&L statement.
 *
 * Row tones mirror the approved format sheet: blue bands for A / B / C, green
 * for the expense groups, pink for Indirect Expenses.
 * Ref / Code / Particulars stay pinned while the 10 value columns scroll.
 */

// tone → [row background, text]
const TONE = {
  section:  "bg-[#cfe0f0] text-[#123a5c] font-semibold",
  subgroup: "bg-[#f2d5ea] text-[#5c1247] font-semibold",
  group:    "bg-[#d9ead3] text-[#1d4d1d] font-semibold",
  total:    "bg-[#bcd6ec] text-[#0d2f4d] font-bold",
  leaf:     "bg-white text-gray-800",
};

// Pinned-column offsets must match the widths below
const STICKY = {
  ref:   "sticky left-0 z-20 w-[74px] min-w-[74px]",
  code:  "sticky left-[74px] z-20 w-[62px] min-w-[62px]",
  title: "sticky left-[136px] z-20 min-w-[240px]",
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
  return (
    <div className="border border-[#b5b5b5] rounded-sm overflow-hidden">
      <div className="overflow-auto max-h-[calc(100vh-260px)]">
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
            {rows.map((row) => {
              const tone   = TONE[row.tone] || TONE.leaf;
              const isBold = row.tone !== "leaf";
              return (
                <tr key={row.ref} className={tone}>
                  <td className={`${STICKY.ref} ${tone} border border-[#d0d0d0] px-2 py-[3px] whitespace-nowrap`}>
                    {row.ref}
                  </td>
                  <td className={`${STICKY.code} ${tone} border border-[#d0d0d0] px-2 py-[3px] whitespace-nowrap`}>
                    {row.code}
                  </td>
                  <td
                    className={`${STICKY.title} ${tone} border border-[#d0d0d0] px-2 py-[3px]`}
                    style={{ paddingLeft: `${8 + row.depth * 12}px` }}
                  >
                    {row.title}
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
