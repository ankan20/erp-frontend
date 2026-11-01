"use client";

import { AllocatedTag, InfoHint } from "./TraceBits";
import { fmtAmt, fmtQty } from "./traceUtils";

const TONES = {
  base: "border-[#b5c7d8] bg-[#f3f7ff]",
  good: "border-green-200 bg-green-50",
  warn: "border-amber-200 bg-amber-50",
  muted: "border-gray-200 bg-gray-50",
};

function QtyCard({ label, value, unit, sub, hint, tone = "base" }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${TONES[tone]}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-medium text-gray-600">{label}</span>
        {hint && <InfoHint text={hint} />}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-[18px] font-bold leading-tight text-gray-900">{value}</span>
        {unit && value !== "—" && <span className="text-[11px] text-gray-500">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 truncate text-[10.5px] text-gray-500">{sub}</div>}
    </div>
  );
}

function MoneyCard({ label, value, allocated, basis, hint, tone = "base" }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${TONES[tone]}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-medium text-gray-600">{label}</span>
        {allocated ? <AllocatedTag basis={basis} label="Est." /> : hint && <InfoHint text={hint} />}
      </div>
      <div className="mt-0.5 text-[16px] font-bold leading-tight text-gray-900">
        {value === null ? "—" : `${allocated ? "≈ " : ""}₹ ${fmtAmt(value)}`}
      </div>
    </div>
  );
}

export default function TraceSummaryCards({ summary, unit, rules, allocationBasis }) {
  const s = summary;
  const unavailable = s.unavailableMetrics || [];
  const reason = (m) => unavailable.find((u) => u.metric === m)?.reason;
  const hasBills = (s.purchaseBillCount || 0) > 0;
  const accountsOk = s.accountsAllocationAvailable && hasBills;
  const accountsHint = !hasBills
    ? "No Purchase Bill is linked to this item's billing yet."
    : "Item-level value cannot be allocated for this item. See Pending & Exceptions.";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
        <QtyCard label="Indent Qty" value={fmtQty(s.indentQty)} unit={unit} />
        <QtyCard
          label="Ordered"
          value={fmtQty(s.orderedQty)}
          unit={unit}
          sub={`Approved orders: ${fmtQty(s.orderedApprovedQty)}`}
          hint={rules?.ordered}
        />
        <QtyCard
          label="Not Yet Ordered"
          value={fmtQty(s.unallocatedQty)}
          unit={unit}
          tone={s.unallocatedQty > 0 ? "warn" : "good"}
        />
        <QtyCard
          label="Received (GRN)"
          value={fmtQty(s.receivedQty)}
          unit={unit}
          sub="Includes GRNs awaiting approval"
          hint={rules?.received}
        />
        <QtyCard
          label="Net Accepted"
          value={fmtQty(s.netAcceptedQty)}
          unit={unit}
          sub="Approved GRNs"
          hint={rules?.netAccepted}
          tone="good"
        />
        <QtyCard
          label="Issued (GIN)"
          value={fmtQty(s.issuedQty)}
          unit={unit}
          sub={`Approved GINs: ${fmtQty(s.issuedApprovedQty)}`}
          hint={rules?.issued}
        />
        <QtyCard label="In Stock" value={fmtQty(s.stockQty)} unit={unit} hint={rules?.stock} />
        {s.dispatchedQty > 0 && (
          <QtyCard label="Dispatched (DC)" value={fmtQty(s.dispatchedQty)} unit={unit} />
        )}
        <QtyCard
          label="Billed (BRB)"
          value={fmtQty(s.billedQty)}
          unit={unit}
          sub={`Approved BRBs: ${fmtQty(s.billedApprovedQty)}`}
          hint={rules?.billed}
        />
        <QtyCard
          label="Pending Billing"
          value={fmtQty(s.pendingBillingQty)}
          unit={unit}
          hint={rules?.pendingBilling}
          tone={s.pendingBillingQty > 0 ? "warn" : "base"}
        />
        <QtyCard label="Approved Qty" value="—" sub="Not tracked separately" hint={reason("approvedQty")} tone="muted" />
        <QtyCard label="Rejected / Returned" value="—" sub="Not tracked" hint={reason("rejectedReturnedQty")} tone="muted" />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MoneyCard
          label="Billed Value (BRB, exact)"
          value={s.billedTotalAmount}
          hint={`Basic ₹ ${fmtAmt(s.billedBasicAmount)} + GST ₹ ${fmtAmt(s.billedGstAmount)} from this item's non-rejected BRB lines.`}
          tone="good"
        />
        <MoneyCard
          label="Purchase Billed"
          value={accountsOk ? s.purchaseBilledAllocated : null}
          allocated={accountsOk}
          basis={allocationBasis}
          hint={accountsHint}
        />
        <MoneyCard
          label="Paid"
          value={accountsOk ? s.paidAllocated : null}
          allocated={accountsOk}
          basis={`${allocationBasis} Only approved payments are counted; ≈ ₹ ${fmtAmt(s.paidInProcessAllocated)} is in payments awaiting approval.`}
          hint={accountsHint}
        />
        <MoneyCard
          label="Outstanding"
          value={accountsOk ? s.outstandingAllocated : null}
          allocated={accountsOk}
          basis={allocationBasis}
          hint={accountsHint}
          tone={accountsOk && s.outstandingAllocated > 0 ? "warn" : "base"}
        />
      </div>
    </div>
  );
}
