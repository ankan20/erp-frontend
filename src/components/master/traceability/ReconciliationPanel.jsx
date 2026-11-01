"use client";

import { Info } from "lucide-react";
import { fmtAmt, fmtQty, formatWorkflowStatus, statusClass } from "./wbUtils";

// Compact numeric table; a cell turns amber/red when its rule says so.
function QtyTable({ title, note, rows, columns, rowKey, onDoc }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[12.5px] font-semibold text-gray-800">{title}</span>
        <span className="text-[11px] text-gray-500">{note}</span>
      </div>
      <div className="overflow-x-auto rounded-md border border-[#9e9e9e]">
        <table className="w-full min-w-[900px] border-collapse text-[12px]">
          <thead className="bg-[#144664] text-white">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-2 py-1.5 font-semibold ${c.num ? "text-right" : "text-left"}`} title={c.help || ""}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={rowKey(r)} className={i % 2 ? "bg-white" : "bg-[#f7f7f7]"}>
                {columns.map((c) => {
                  const tone = c.tone?.(r);
                  return (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-2 py-1 ${c.num ? "text-right tabular-nums" : ""} ${
                        tone === "warn" ? "bg-amber-50 font-semibold text-amber-800" : tone === "bad" ? "bg-red-50 font-semibold text-red-700" : ""
                      }`}
                    >
                      {c.render(r, onDoc)}
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

const item = {
  key: "item",
  label: "Item",
  render: (r) => (
    <span>
      <span className="font-medium">{r.itemName || r.itemCode}</span>
      {r.isAsset && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">FA</span>}
      <span className="ml-1 text-[10.5px] text-gray-500">{r.itemCode}</span>
    </span>
  ),
};
const q = (key, label, opts = {}) => ({ key, label, num: true, render: (r) => fmtQty(r[key]), ...opts });
const docCell = (noKey, statusKey, type, idKey) => ({
  key: noKey,
  label: type === "INDENT" ? "Indent" : "Order",
  render: (r, onDoc) => (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" onClick={() => onDoc(`${type}:${r[idKey]}`)} className="font-semibold text-[#144664] hover:underline">
        {r[noKey]}
      </button>
      <span className={`rounded border px-1 text-[9.5px] font-semibold ${statusClass(r[statusKey])}`}>{formatWorkflowStatus(r[statusKey])}</span>
    </span>
  ),
});

export default function ReconciliationPanel({ recon, onDoc }) {
  const { indentLines = [], orderLines = [], serviceLines = [] } = recon || {};
  const empty = !indentLines.length && !orderLines.length && !serviceLines.length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11.5px] text-blue-900">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Exact quantities for every indent and order line in this flow, counted over <b>all</b> their transactions with
          the same rules the source modules use: rejected documents are excluded; ordered / received / issued / billed
          include documents still awaiting approval; <i>accepted</i>, stock and pending billing use approved GRNs / SRNs only.
          Different items are never added together.
        </span>
      </div>

      {empty && <div className="py-8 text-center text-[12px] text-gray-500">No item lines in this flow (or none you can access).</div>}

      <QtyTable
        title="Indent lines"
        note="Requested vs ordered"
        rows={indentLines}
        rowKey={(r) => r.indentItemId}
        onDoc={onDoc}
        columns={[
          docCell("indentNo", "indentStatus", "INDENT", "indentId"),
          item,
          { key: "unit", label: "Unit", render: (r) => r.unit || "—" },
          q("indentQty", "Indent Qty"),
          q("orderedQty", "Ordered", { tone: (r) => (r.overOrderedQty > 0 ? "bad" : null) }),
          q("pendingOrderQty", "Not Yet Ordered", { tone: (r) => (r.pendingOrderQty > 0 && r.indentStatus === "Approved" ? "warn" : null) }),
        ]}
      />

      <QtyTable
        title="Material order lines"
        note="Order → receipt → issue → billing"
        rows={orderLines}
        rowKey={(r) => r.orderItemId}
        onDoc={onDoc}
        columns={[
          docCell("orderNo", "orderStatus", "ORDER", "orderId"),
          item,
          { key: "unit", label: "Unit", render: (r) => r.unit || "—" },
          q("orderedQty", "Ordered"),
          { key: "rate", label: "Rate", num: true, render: (r) => fmtAmt(r.rate) },
          q("receivedQty", "Received", { tone: (r) => (r.receivedQty > r.orderedQty ? "bad" : null) }),
          q("pendingReceiptQty", "Pending Receipt", { tone: (r) => (r.pendingReceiptQty > 0 && r.orderStatus === "Approved" ? "warn" : null) }),
          q("acceptedQty", "Accepted"),
          q("issuedQty", "Issued (GIN)", { tone: (r) => (r.issuedQty > r.acceptedQty ? "bad" : null) }),
          q("dispatchedQty", "Dispatched (DC)"),
          q("stockQty", "In Stock"),
          q("billedQty", "Billed", { tone: (r) => (r.billedQty > r.receivedQty ? "bad" : null) }),
          q("pendingBillingQty", "Pending Billing", { tone: (r) => (r.pendingBillingQty > 0 ? "warn" : null) }),
        ]}
      />

      <QtyTable
        title="Service order lines"
        note="Service order → SRN → billing (service orders have no link to indents)"
        rows={serviceLines}
        rowKey={(r) => r.pwOrderItemId}
        onDoc={onDoc}
        columns={[
          docCell("orderNo", "orderStatus", "PW_ORDER", "orderId"),
          item,
          { key: "unit", label: "Unit", render: (r) => r.unit || "—" },
          q("orderedQty", "Ordered"),
          { key: "rate", label: "Rate", num: true, render: (r) => fmtAmt(r.rate) },
          q("receivedQty", "Received (SRN)", { tone: (r) => (r.receivedQty > r.orderedQty ? "bad" : null) }),
          q("pendingReceiptQty", "Pending", { tone: (r) => (r.pendingReceiptQty > 0 && r.orderStatus === "Approved" ? "warn" : null) }),
          q("acceptedQty", "Accepted"),
          q("billedQty", "Billed", { tone: (r) => (r.billedQty > r.receivedQty ? "bad" : null) }),
          q("pendingBillingQty", "Pending Billing", { tone: (r) => (r.pendingBillingQty > 0 ? "warn" : null) }),
        ]}
      />
    </div>
  );
}
