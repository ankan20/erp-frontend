"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const TYPE_STYLE = {
  advance:    "text-purple-700 bg-purple-50",
  adjustment: "text-purple-700 bg-purple-50",
  bill:    "text-blue-700 bg-blue-50",
  voucher: "text-teal-700 bg-teal-50",
};

/**
 * Popup: everything settled against a bill — bill payments, voucher payments
 * and Advance Adjustments (advance moved onto this bill) — with paid / advance
 * adjusted / in progress / balance.
 *
 * Pass ONE of: purchaseBillId | brrId | journalEntryId (+ vendorId).
 */
export default function BillPaymentsPopup({ open, onClose, purchaseBillId, brrId, journalEntryId, vendorId }) {
  // one fetch per bill; loading = the result on hand is for another bill
  const key = open && (purchaseBillId || brrId || journalEntryId)
    ? [purchaseBillId || "", brrId || "", journalEntryId || "", vendorId || ""].join("|")
    : null;
  const [result, setResult] = useState({ key: null, data: null });

  useEffect(() => {
    if (!key) return;
    const params = new URLSearchParams();
    if (purchaseBillId) params.set("purchaseBillId", purchaseBillId);
    else if (brrId) params.set("brrId", brrId);
    else {
      params.set("journalEntryId", journalEntryId);
      if (vendorId) params.set("vendorId", vendorId);
    }
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.BILL_PAYMENTS}?${params}`, method: "GET" })
      .then((res) => setResult({ key, data: res.data || null }))
      .catch((err) => {
        toast.error(err.message || "Failed to load payments");
        setResult({ key, data: null });
      });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = !!key && result.key !== key;
  const data    = result.key === key ? result.data : null;

  if (!open) return null;

  const totals = data ? [
    { label: "Bill Amount",      value: data.billAmount },
    { label: "Paid",             value: data.paidAmount },
    { label: "Advance Adjusted", value: data.advanceAdjusted },
    { label: "In Progress",      value: data.inProgress },
    { label: "Balance",          value: data.balanceAmount, strong: true },
  ] : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl mx-3 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[#f0f4fa]">
          <span className="text-[13px] font-semibold text-[#3b6ea5]">
            Payments against {data?.title || "bill"}
          </span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-200 rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[12px]">Loading payments…</span>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 border-b">
              {totals.map((t) => (
                <div key={t.label} className="px-3 py-2 border-r last:border-r-0">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">{t.label}</div>
                  <div className={`text-[13px] tabular-nums ${t.strong ? "font-bold text-[#1c3a5e]" : "font-semibold text-gray-800"}`}>
                    {formatAmount(t.value || 0)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {data.payments?.length ? (
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 bg-[#1c3a5e] text-white">
                    <tr>
                      {["Payment No", "Date", "Type", "Advance PR No", "Mode", "Account", "UTR / Voc. No", "Amount", "Status"].map((h) => (
                        <th key={h} className={`border border-[#2a4e7c] px-2 py-1.5 font-semibold ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p, i) => {
                      const dead = ["Rejected", "Cancelled"].includes(p.workflowStatus);
                      return (
                        <tr key={p.id} className={`${i % 2 ? "bg-[#f8fafc]" : "bg-white"} ${dead ? "opacity-50 line-through" : ""}`}>
                          <td className="border border-[#dde] px-2 py-1 font-semibold text-[#1c3a5e]">{p.receiptNo}</td>
                          <td className="border border-[#dde] px-2 py-1 whitespace-nowrap">{p.paymentDate ? getfmtDisplaydate(p.paymentDate) : "—"}</td>
                          <td className="border border-[#dde] px-2 py-1">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_STYLE[p.paymentType] || ""}`}>{p.typeLabel}</span>
                          </td>
                          <td className="border border-[#dde] px-2 py-1">{p.paymentRequestNo || "—"}</td>
                          <td className="border border-[#dde] px-2 py-1">{p.paymentMode || "—"}</td>
                          <td className="border border-[#dde] px-2 py-1">{p.accountName || "—"}</td>
                          <td className="border border-[#dde] px-2 py-1">{p.utrVoucherNo || "—"}</td>
                          <td className="border border-[#dde] px-2 py-1 text-right tabular-nums font-medium">{formatAmount(p.amount)}</td>
                          <td className="border border-[#dde] px-2 py-1">{(p.workflowStatus || "").replace(/_/g, " ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-10 text-center text-[12px] text-gray-400 italic">No payment made against this bill yet</div>
              )}
            </div>
            <div className="px-4 py-2 border-t bg-[#f8fafc] text-[10px] text-gray-500">
              Advance Adjusted = outstanding vendor advance adjusted against this bill (mode “Advance”).
              Balance = Bill − Paid − Advance Adjusted − In Progress.
            </div>
          </>
        ) : (
          <div className="py-10 text-center text-[12px] text-gray-400 italic">Nothing to show</div>
        )}
      </div>
    </div>
  );
}
