"use client";

import { useState } from "react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const EP = API_ENDPOINTS.FINANCE.ADVANCE_ADJUSTMENT;

/**
 * Advance Adjustments of an advance (or of a bill), with Cancel.
 * Cancel reverses the ledger entry (-REV); the row stays as Cancelled.
 * showAdvance: show the advance PR No column (bill side); else the bill.
 */
export default function AdvanceAdjustmentsTable({ adjustments = [], onChanged, canCancel = true, showAdvance = false }) {
  const [busy, setBusy] = useState(null);

  const cancel = async (a) => {
    const reason = window.prompt(`Cancel ${a.adjustmentNo}? ₹${formatAmount(a.amount)} goes back to the advance and the bill.\n\nReason:`);
    if (reason === null) return;
    setBusy(a.id);
    try {
      const res = await apiRequest({ url: `${EP.CANCEL}/${a.id}`, method: "POST", data: { reason } });
      toast.success(res.message || "Adjustment cancelled");
      onChanged?.();
    } catch (err) {
      toast.error(err.message || "Failed to cancel adjustment");
    } finally {
      setBusy(null);
    }
  };

  if (!adjustments.length) {
    return <div className="text-[11px] text-gray-400 italic">Not adjusted against any bill yet.</div>;
  }

  const heads = ["Adj. No", "Date", showAdvance ? "Advance PR No" : "Bill", "Type", "Amount", "Status", "By", ""];
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="bg-[#f0f4fa] text-gray-700">
          {heads.map((h, i) => (
            <th key={`${h}${i}`} className={`border border-[#e6e4e4] px-2 py-1 font-semibold ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {adjustments.map((a) => {
          const dead = a.workflowStatus === "Cancelled";
          return (
            <tr key={a.id} className={dead ? "opacity-50" : ""}>
              <td className={`border border-[#e6e4e4] px-2 py-1 font-semibold text-[#1c3a5e] ${dead ? "line-through" : ""}`}>{a.adjustmentNo}</td>
              <td className="border border-[#e6e4e4] px-2 py-1 whitespace-nowrap">{a.adjustmentDate ? getfmtDisplaydate(a.adjustmentDate) : "—"}</td>
              <td className="border border-[#e6e4e4] px-2 py-1">
                {showAdvance ? a.paymentRequestNo : <>{a.billNo}{a.brrNo ? <span className="text-gray-400"> · BRR {a.brrNo}</span> : null}</>}
              </td>
              <td className="border border-[#e6e4e4] px-2 py-1">{a.linkType === "JOURNAL" ? "Journal" : "Purchase Bill"}</td>
              <td className="border border-[#e6e4e4] px-2 py-1 text-right tabular-nums font-medium">{formatAmount(a.amount)}</td>
              <td className="border border-[#e6e4e4] px-2 py-1" title={a.cancelReason || ""}>
                {dead ? `Cancelled${a.cancelReason ? ` — ${a.cancelReason}` : ""}` : "Adjusted"}
              </td>
              <td className="border border-[#e6e4e4] px-2 py-1">{dead ? a.cancelledBy : a.createdBy}</td>
              <td className="border border-[#e6e4e4] px-2 py-1 text-right">
                {!dead && canCancel && (
                  <button type="button" disabled={busy === a.id} onClick={() => cancel(a)}
                    className="text-[11px] text-red-600 hover:underline disabled:opacity-50">
                    {busy === a.id ? "Cancelling…" : "Cancel"}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
