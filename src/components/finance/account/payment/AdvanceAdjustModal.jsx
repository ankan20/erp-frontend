"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";

const EP = API_ENDPOINTS.FINANCE.ADVANCE_ADJUSTMENT;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Default split: first row fills to its balance, then the next. */
function fill(rows, amount) {
  let left = r2(amount);
  return rows.map((r) => {
    const take = left > 0 ? r2(Math.min(left, Math.max(Number(r.balanceAmount) || 0, 0))) : 0;
    left = r2(left - take);
    return { ...r, amount: take };
  });
}

/**
 * Adjust an outstanding advance against ONE bill, split product / CC wise.
 *
 * Open it from either side:
 *   • from an advance   → pass paymentRequestId (the bill is picked here)
 *   • from a bill       → pass purchaseBillId, or journalId + vendorId
 *                         (the advance is picked here)
 * Both create the same Advance Adjustment, so it shows on both sides.
 */
export default function AdvanceAdjustModal({
  open, onClose, onDone, paymentRequestId, purchaseBillId, journalId, vendorId,
}) {
  const fromBill = !paymentRequestId;

  const [prId, setPrId]         = useState(paymentRequestId || "");
  const [bill, setBill]         = useState(null);      // { linkType, purchaseBillId, journalId, billNo }
  const [advances, setAdvances] = useState([]);        // from a bill: vendor's advances
  const [bills, setBills]       = useState(null);      // from an advance: { adjustType, bills }
  const [info, setInfo]         = useState(null);      // rows endpoint result
  const [rows, setRows]         = useState([]);
  const [amount, setAmount]     = useState("");
  const [remarks, setRemarks]   = useState("");
  const [adjDate, setAdjDate]   = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);

  // reset on open
  useEffect(() => {
    if (!open) return;
    setPrId(paymentRequestId || "");
    setBill(purchaseBillId ? { linkType: "BRR", purchaseBillId }
      : journalId ? { linkType: "JOURNAL", journalId } : null);
    setInfo(null); setRows([]); setAmount(""); setRemarks("");
    setAdvances([]); setBills(null);
  }, [open, paymentRequestId, purchaseBillId, journalId]);

  // from a bill → the vendor's advances with something outstanding
  useEffect(() => {
    if (!open || !fromBill) return;
    const qs = purchaseBillId ? `purchaseBillId=${purchaseBillId}` : `journalId=${journalId}&vendorId=${vendorId}`;
    apiRequest({ url: `${EP.BILL_ADVANCES}?${qs}`, method: "GET" })
      .then((res) => {
        const list = res.data?.advances || [];
        setAdvances(list);
        if (list.length === 1) setPrId(String(list[0].paymentRequestId));
      })
      .catch((err) => toast.error(err.message || "Failed to load advances"));
  }, [open, fromBill, purchaseBillId, journalId, vendorId]);

  // from an advance → bills it can go to
  useEffect(() => {
    if (!open || fromBill || !prId) return;
    apiRequest({ url: `${EP.BILLS}?paymentRequestId=${prId}`, method: "GET" })
      .then((res) => setBills(res.data || { bills: [] }))
      .catch((err) => toast.error(err.message || "Failed to load bills"));
  }, [open, fromBill, prId]);

  // both chosen → rows, auto-filled with the most that can go
  useEffect(() => {
    if (!open || !prId || !bill) return;
    const qs = new URLSearchParams({ paymentRequestId: String(prId) });
    if (bill.purchaseBillId) qs.set("purchaseBillId", bill.purchaseBillId);
    else qs.set("journalId", bill.journalId);
    setLoading(true);
    apiRequest({ url: `${EP.ROWS}?${qs}`, method: "GET" })
      .then((res) => {
        setInfo(res.data);
        setRows(res.data?.rows || []);
        setAmount(String(res.data?.amount ?? ""));
      })
      .catch((err) => { toast.error(err.message || "Failed to load bill rows"); setInfo(null); setRows([]); })
      .finally(() => setLoading(false));
  }, [open, prId, bill]);

  const total = useMemo(() => r2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)), [rows]);
  const maxAmount = Number(info?.maxAmount || 0);
  const overRow = rows.find((r) => r2(r.amount) > r2(r.balanceAmount));
  const canSave = !!info && total > 0 && total <= maxAmount && !overRow && !saving;

  const autoFill = () => setRows((rs) => fill(rs, Math.min(Number(amount) || 0, maxAmount)));
  const setRowAmount = (key, val) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, amount: val } : r)));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        paymentRequestId: Number(prId),
        amount: total,
        adjustmentDate: adjDate,
        remarks: remarks || undefined,
        rows: rows.filter((r) => Number(r.amount) > 0).map((r) => ({ key: r.key, amount: r2(r.amount) })),
      };
      if (bill.purchaseBillId) body.purchaseBillId = Number(bill.purchaseBillId);
      else body.journalId = Number(bill.journalId);
      const res = await apiRequest({ url: EP.CREATE, method: "POST", data: body });
      toast.success(res.message || "Advance adjusted");
      onDone?.(res.data);
    } catch (err) {
      toast.error(err.message || "Failed to adjust advance");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl mx-3 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[#f0f4fa]">
          <span className="text-[13px] font-semibold text-[#3b6ea5]">
            Adjust advance against {info?.billNo || "a bill"}
          </span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-200 rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* step 1: the other side */}
          <div className="px-4 py-3 border-b grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
            {fromBill ? (
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 font-medium">Advance (Payment Request)</span>
                <select value={prId} onChange={(e) => setPrId(e.target.value)}
                  className="border rounded-sm px-2 py-1.5 bg-white">
                  <option value="">{advances.length ? "Select advance" : "No outstanding advance for this vendor"}</option>
                  {advances.map((a) => (
                    <option key={a.paymentRequestId} value={a.paymentRequestId}>
                      {a.prNo} · {a.prDate || "-"} · outstanding ₹{formatAmount(a.outstanding)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 font-medium">
                  Bill {bills?.adjustType ? `(this advance goes to ${bills.adjustType === "JOURNAL" ? "journals" : "purchase bills"} only)` : ""}
                </span>
                <select
                  value={bill ? `${bill.linkType}:${bill.purchaseBillId || bill.journalId}` : ""}
                  onChange={(e) => {
                    const hit = (bills?.bills || []).find((b) => `${b.linkType}:${b.purchaseBillId || b.journalId}` === e.target.value);
                    setBill(hit || null);
                  }}
                  className="border rounded-sm px-2 py-1.5 bg-white">
                  <option value="">{bills?.bills?.length ? "Select bill" : "No approved bill of this vendor with balance"}</option>
                  {(bills?.bills || []).map((b) => (
                    <option key={`${b.linkType}:${b.purchaseBillId || b.journalId}`} value={`${b.linkType}:${b.purchaseBillId || b.journalId}`}>
                      {b.linkType === "JOURNAL" ? "Journal" : "PB"} {b.billNo}
                      {b.brrNo ? ` · BRR ${b.brrNo}` : ""}{b.orderNo ? ` · ${b.orderNo}` : ""}
                      {` · balance ₹${formatAmount(b.balanceAmount)}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-gray-600 font-medium">Adjustment Date</span>
              <input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)}
                className="border rounded-sm px-2 py-1.5" />
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[12px]">Loading bill rows…</span>
            </div>
          ) : info ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 border-b">
                {[
                  { label: "Advance Outstanding", value: info.available },
                  { label: "Bill Open Balance", value: info.billOpen },
                  { label: "Left To Request", value: info.requestRoom },
                  { label: "Most You Can Adjust", value: info.maxAmount, strong: true },
                ].map((t) => (
                  <div key={t.label} className="px-3 py-2 border-r last:border-r-0">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">{t.label}</div>
                    <div className={`text-[13px] tabular-nums ${t.strong ? "font-bold text-[#1c3a5e]" : "font-semibold text-gray-800"}`}>
                      {t.value == null ? "—" : formatAmount(t.value)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2 flex flex-wrap items-center gap-2 text-[12px] border-b bg-[#fafbfd]">
                <span className="text-gray-600 font-medium">Auto-fill amount</span>
                <input type="number" min="0" step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="border rounded-sm px-2 py-1 w-32 text-right tabular-nums" />
                <button type="button" onClick={autoFill}
                  className="flex items-center gap-1 px-2 py-1 border rounded-sm text-[#3b6ea5] border-[#3b6ea5] hover:bg-[#eef3fa]">
                  <Wand2 size={12} /> Auto-fill rows
                </button>
                <span className="text-[11px] text-gray-500">
                  Fills the first product first, then the next. Change any row below — the Total is what gets adjusted.
                </span>
              </div>

              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 bg-[#1c3a5e] text-white">
                  <tr>
                    {["#", "CC Code", "CC / Product", "Booked", "Paid", "Adjusted", "Balance", "Adjust Now"].map((h, i) => (
                      <th key={h} className={`border border-[#2a4e7c] px-2 py-1.5 font-semibold ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const bad = r2(r.amount) > r2(r.balanceAmount);
                    return (
                      <tr key={r.key} className={i % 2 ? "bg-[#f8fafc]" : "bg-white"}>
                        <td className="border border-[#dde] px-2 py-1">{r.lineType === "gst" ? "GST" : r.slNo || i + 1}</td>
                        <td className="border border-[#dde] px-2 py-1 font-medium">{r.ccCode || "—"}</td>
                        <td className="border border-[#dde] px-2 py-1">{r.ccName || r.description || "—"}</td>
                        <td className="border border-[#dde] px-2 py-1 text-right tabular-nums">{formatAmount(r.bookedAmount)}</td>
                        <td className="border border-[#dde] px-2 py-1 text-right tabular-nums">{formatAmount(r.paidAmount)}</td>
                        <td className="border border-[#dde] px-2 py-1 text-right tabular-nums">{formatAmount(r.adjustedAmount)}</td>
                        <td className="border border-[#dde] px-2 py-1 text-right tabular-nums">{formatAmount(r.balanceAmount)}</td>
                        <td className="border border-[#dde] px-1 py-0.5 text-right">
                          <input type="number" min="0" step="0.01" value={r.amount}
                            disabled={Number(r.balanceAmount) <= 0}
                            onChange={(e) => setRowAmount(r.key, e.target.value)}
                            className={`w-28 border rounded-sm px-1.5 py-0.5 text-right tabular-nums ${bad ? "border-red-500 bg-red-50" : ""}`} />
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#eef3fa] font-semibold">
                    <td colSpan={7} className="border border-[#dde] px-2 py-1.5 text-right">Total</td>
                    <td className={`border border-[#dde] px-2 py-1.5 text-right tabular-nums ${total > maxAmount ? "text-red-600" : ""}`}>
                      {formatAmount(total)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="px-4 py-2 text-[12px]">
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Remarks (optional)" className="border rounded-sm px-2 py-1.5 w-full" />
                {overRow && (
                  <div className="text-red-600 mt-1 text-[11px]">
                    {overRow.ccCode || overRow.description}: more than the row balance {formatAmount(overRow.balanceAmount)}
                  </div>
                )}
                {total > maxAmount && (
                  <div className="text-red-600 mt-1 text-[11px]">Total is more than {formatAmount(maxAmount)}</div>
                )}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-[12px] text-gray-400 italic">
              {fromBill ? "Pick the advance to adjust" : "Pick the bill to adjust against"}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t bg-[#f8fafc] flex items-center gap-2">
          <span className="text-[10px] text-gray-500 mr-auto">
            Posts Dr Vendor by each row&apos;s CC / Cr Vendor (the advance). The bill&apos;s balance in Account › Payment goes down by this amount.
          </span>
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-[12px] border rounded-sm">Close</button>
          <button type="button" onClick={save} disabled={!canSave}
            className="px-3 py-1.5 text-[12px] rounded-sm bg-[#3b6ea5] text-white disabled:opacity-50">
            {saving ? "Adjusting…" : `Adjust ₹${formatAmount(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
