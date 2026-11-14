"use client";

import { formatAmount } from "@/helper/numberFormatter";
import { useResizableTable } from "@/hooks/useResizableTable";

export default function AccountingTable({
  columns,
  rows,
  emptyMessage = "No data",
  storageKey,
  footerRow,
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
      <div className="text-center text-gray-400 text-[13px] py-10">{emptyMessage}</div>
    );
  }

  return (
    <div className="border border-[#9e9e9e] overflow-x-auto">
      <div className="max-h-[608px] overflow-y-auto">
        <table ref={tableRef} className="w-full min-w-max table-fixed border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#144664]">
              {ordered.map((col) => {
                const thProps = getThProps(
                  col.id,
                  `px-3 py-2 text-left font-semibold border border-[#2e5a72] text-white whitespace-nowrap ${col.align === "right" ? "text-right" : ""} ${col.className || ""}`,
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
              <tr className="bg-[#144664] text-white text-[12px] font-semibold">
                {ordered.map((col) => {
                  const val = footerRow[col.key];
                  const isAmount = col.type === "amount";
                  return (
                    <td
                      key={col.key}
                      className={`border border-[#2e5a72] px-3 py-1.5 whitespace-nowrap ${col.align === "right" || isAmount ? "text-right tabular-nums" : ""} ${col.className || ""}`}
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
                className={`border-b border-[#e0e0e0] ${row._highlight ? "bg-[#f5f5ff] font-semibold" : i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f0ff] transition-colors`}
              >
                {ordered.map((col) => {
                  const val = row[col.key];
                  const isAmount = col.type === "amount";
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-1.5 border border-[#e6e4e4] ${col.align === "right" || isAmount ? "text-right tabular-nums" : ""} ${col.className || ""}`}
                    >
                      {isAmount && val != null ? formatAmount(val) : (val ?? "")}
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
