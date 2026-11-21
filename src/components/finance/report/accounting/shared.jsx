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

/**
 * "Show cancelled" toggle for central-accounting ledger screens.
 * Cancelled / rebacked documents leave an original + reversal pair in the
 * ledger that nets to zero. The backend hides the pair unless
 * ?include_cancelled=true; when shown, rows are struck through.
 */
export function ShowCancelledToggle({ checked, onChange, count }) {
  if (!checked && !count) return null;
  return (
    <label
      className="flex items-center gap-1.5 text-[11.5px] text-[#4b5563] cursor-pointer select-none whitespace-nowrap"
      title="Cancelled documents and their reversal entries net to zero and are hidden by default"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#1b2f3a] cursor-pointer"
      />
      Show cancelled{count ? ` (${count})` : ""}
    </label>
  );
}

/** Row fields for AccountingTable from an API entry's cancel flags. */
export function cancelRowProps(entry) {
  return entry?.isCancelled
    ? { _cancelled: true, _cancelLabel: entry.cancelLabel || "Cancelled" }
    : {};
}

const NARRATION_HINTS = {
  "PB expense":          "Purchase Bill — expense line item",
  "PV expense":          "Payment Voucher — expense line item",
  "PV payment":          "Payment Voucher — bank/cash payment",
  "PCDV expense":        "Petty Cash Docket Voucher — expense line item",
  "PCDV payment":        "Petty Cash Docket Voucher — cash paid out",
  "BPR bill payment":    "Bill Payment Receipt — payment against bill",
  "BPR payment":         "Bill Payment Receipt — bank/cash side",
  "SB revenue":          "Sale Bill — revenue line item",
  "SRB receipt":         "Sale Receipt Billing — money received",
  "JE":                  "Journal Entry — manual entry",
  "JE customer":         "Journal Entry — customer line",
  "CE transfer":         "Contra Entry — bank/cash transfer",
  "DN vendor adjustment":"Debit Note — vendor claim back",
  "DN expense reversal": "Debit Note — expense reversal",
  "DN GST reversal":     "Debit Note — GST reversal",
  "CN revenue reversal": "Credit Note — revenue reversal",
  "CN customer adjustment":"Credit Note — customer credit",
  "CN GST reversal":     "Credit Note — GST reversal",
  "GST Input":           "Auto GST — input tax on purchases",
  "GST Output":          "Auto GST — output tax on sales",
  "Vendor payable":      "Purchase Bill — vendor credit (payable)",
  "Customer receivable": "Sale Bill — customer debit (receivable)",
  "Customer receipt":    "Sale Receipt — customer credit (settled)",
  "Claim bill WIP":      "Claim Bill — unbilled WIP (UWIP)",
  "Claim bill provisional":"Claim Bill — provisional customer entry",
  "Certified bill reduces WIP":"Certified Bill — reverses UWIP",
  "Certified receivable":"Certified Bill — certified customer receivable",
  "US reclassify from UWIP":"Uncertified Statement — reclassify UWIP to hold CC",
  "US reclassify to hold":"Uncertified Statement — credit UWIP for hold CCs",
  "GRN inventory":       "Goods Received Note — inventory received",
  "GIN issue":           "Goods Issue Note — material issued to project",
};

export function getNarrationHint(narration) {
  if (!narration) return null;
  for (const [prefix, hint] of Object.entries(NARRATION_HINTS)) {
    if (narration.startsWith(prefix)) return hint;
  }
  return null;
}
