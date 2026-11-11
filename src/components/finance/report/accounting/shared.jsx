"use client";

import { formatAmount } from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

export function fmt(val) {
  if (val == null || val === "") return "—";
  return formatAmount(val);
}

export function fmtDate(raw) {
  if (!raw) return "—";
  return getfmtDisplaydate(raw) || "—";
}

const SOURCE_COLORS = {
  purchase_bill:  { bg: "bg-blue-100",   text: "text-blue-800" },
  payment_voucher:{ bg: "bg-orange-100",  text: "text-orange-800" },
  bill_payment:   { bg: "bg-teal-100",    text: "text-teal-800" },
  sale_bill:      { bg: "bg-green-100",   text: "text-green-800" },
  sale_receipt:   { bg: "bg-emerald-100", text: "text-emerald-800" },
  journal_entry:  { bg: "bg-purple-100",  text: "text-purple-800" },
  contra_entry:   { bg: "bg-indigo-100",  text: "text-indigo-800" },
  debit_note:     { bg: "bg-red-100",     text: "text-red-800" },
  credit_note:    { bg: "bg-pink-100",    text: "text-pink-800" },
  petty_cash:     { bg: "bg-amber-100",   text: "text-amber-800" },
};

export function SourceTypeBadge({ type }) {
  const key = (type || "").toLowerCase().replace(/\s+/g, "_");
  const c = SOURCE_COLORS[key] || { bg: "bg-gray-100", text: "text-gray-700" };
  const label = (type || "").replace(/_/g, " ");
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${c.bg} ${c.text} whitespace-nowrap`}>
      {label}
    </span>
  );
}

export function FilterLabel({ children }) {
  return (
    <span className="inline-block px-2 py-0.5 bg-[#b4b4d9] text-[12px] font-semibold text-[#1a1a5e] rounded-sm whitespace-nowrap">
      {children}
    </span>
  );
}

export function SummaryBox({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-1.5 rounded-sm border border-[#ccc] overflow-hidden text-[12px]`}>
          <span className={`px-2 py-1 ${item.bg || "bg-gray-100"} font-semibold ${item.text || "text-gray-700"}`}>
            {item.label}
          </span>
          <span className={`px-2 py-1 ${item.vBg || "bg-white"} font-bold tabular-nums ${item.text || "text-gray-700"}`}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
