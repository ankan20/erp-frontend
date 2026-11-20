"use client";

import { formatAmount } from "@/helper/numberFormatter";
import { useResizableTable } from "@/hooks/useResizableTable";

export default function AccountingTable({
  columns,
  rows,
  emptyMessage = "No data",
  storageKey,
  footerRow,
  narrationTooltip,
}) {
  const cols = columns.map((c) => ({ ...c, id: c.key }));

  const { columnOrder, tableRef, getThProps } = useResizableTable({
    columns: cols,
    storageKey: storageKey || "acctg_table",
  });

  const ordered = columnOrder
    .map((id) => cols.find((c) => c.id === id))
    .filter(Boolean);

  if (!rows?.length) {
    return (
      <div className="text-center text-[#9ca3af] text-[12px] py-10">{emptyMessage}</div>
    );
  }

  return (
    <div className="border border-[#d1d5db] overflow-x-auto">
      <div className="max-h-[608px] overflow-y-auto">
        <table ref={tableRef} className="w-full min-w-max table-fixed border-collapse text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1b2f3a]">
              {ordered.map((col) => {
                const thProps = getThProps(
                  col.id,
                  `px-2 py-[6px] text-left font-medium border-r border-[#2a4a5a] text-white text-[11px] whitespace-nowrap ${col.align === "right" ? "text-right" : ""} ${col.className || ""}`,
                );
                return (
                  <th key={col.id} {...thProps}>
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          {footerRow && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-[#1b2f3a] text-white text-[11.5px] font-medium">
                {ordered.map((col) => {
                  const val = footerRow[col.key];
                  const isAmount = col.type === "amount";
                  return (
                    <td
                      key={col.key}
                      className={`border-r border-[#2a4a5a] px-2 py-[5px] whitespace-nowrap ${col.align === "right" || isAmount ? "text-right tabular-nums" : ""} ${col.className || ""}`}
                    >
                      {isAmount && val != null ? formatAmount(val) : (val ?? "")}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}

          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row._key ?? i}
                className={`border-b border-[#e5e7eb] ${row._highlight ? "bg-[#f3f4f6] font-semibold" : i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f4f8] transition-colors`}
              >
                {ordered.map((col) => {
                  const val = row[col.key];
                  const isAmount = col.type === "amount";
                  const isNarration = narrationTooltip && col.key === "narration";
                  const hint = isNarration ? row._narrationHint : null;
                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-[4px] border-r border-[#f0f0f0] text-[#374151] ${col.align === "right" || isAmount ? "text-right tabular-nums" : ""} ${col.className || ""}`}
                      title={hint ? `${hint}\n\n${val}` : isNarration ? (val || "") : undefined}
                    >
                      {isNarration ? (
                        <span className={hint ? "border-b border-dashed border-[#9ca3af] cursor-help" : ""}>
                          {val || ""}
                        </span>
                      ) : (
                        isAmount && val != null ? formatAmount(val) : (val ?? "")
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
