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
  purchase_bill:   { bg: "bg-[#dbeafe]", text: "text-[#1e40af]" },
  payment_voucher: { bg: "bg-[#ffedd5]", text: "text-[#9a3412]" },
  bill_payment:    { bg: "bg-[#ccfbf1]", text: "text-[#115e59]" },
  sale_bill:       { bg: "bg-[#dcfce7]", text: "text-[#166534]" },
  sale_receipt:    { bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
  journal_entry:   { bg: "bg-[#ede9fe]", text: "text-[#5b21b6]" },
  contra_entry:    { bg: "bg-[#e0e7ff]", text: "text-[#3730a3]" },
  debit_note:      { bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  credit_note:     { bg: "bg-[#fce7f3]", text: "text-[#9d174d]" },
  petty_cash:      { bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
};

export function SourceTypeBadge({ type }) {
  const key = (type || "").toLowerCase().replace(/\s+/g, "_");
  const c = SOURCE_COLORS[key] || { bg: "bg-[#f3f4f6]", text: "text-[#4b5563]" };
  const label = (type || "").replace(/_/g, " ");
  return (
    <span className={`inline-block px-1.5 py-[1px] text-[10px] font-medium ${c.bg} ${c.text} whitespace-nowrap`}>
      {label}
    </span>
  );
}

export function FilterLabel({ children }) {
  return (
    <span className="text-[11.5px] font-medium text-[#6b7280] whitespace-nowrap">
      {children}
    </span>
  );
}

export function SummaryBox({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
      {items.map((item, i) => (
        <span key={i} className="text-[#374151]">
          {item.label}: <span className={`tabular-nums font-medium ${item.text || ""}`}>{item.value}</span>
        </span>
      ))}
    </div>
  );
}
