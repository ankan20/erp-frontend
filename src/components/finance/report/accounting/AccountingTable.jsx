"use client";

import { formatAmount } from "@/helper/numberFormatter";

export default function AccountingTable({ columns, rows, emptyMessage = "No data" }) {
  if (!rows?.length) {
    return (
      <div className="text-center text-gray-400 text-[13px] py-10">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto border border-[#ccc] rounded-sm">
      <table className="w-full text-[12.5px] border-collapse">
        <thead>
          <tr className="bg-[#e8e8f0]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 text-left font-semibold border-b border-[#bbb] whitespace-nowrap ${col.align === "right" ? "text-right" : ""} ${col.className || ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row._key ?? i}
              className={`border-b border-[#e0e0e0] ${row._highlight ? "bg-[#f5f5ff] font-semibold" : i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f0ff] transition-colors`}
            >
              {columns.map((col) => {
                const val = row[col.key];
                const isAmount = col.type === "amount";
                return (
                  <td
                    key={col.key}
                    className={`px-3 py-1.5 ${col.align === "right" || isAmount ? "text-right tabular-nums" : ""} ${col.className || ""}`}
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
  );
}
