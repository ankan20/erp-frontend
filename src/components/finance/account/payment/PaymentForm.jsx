"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray }         from "react-hook-form";
import { useFormWithToast as useForm }       from "@/hooks/useFormWithToast";
import { z }              from "zod";
import { zodResolver }    from "@hookform/resolvers/zod";
import { toast }          from "sonner";
import { useRouter }      from "next/navigation";
import {
  Loader2, PanelLeftClose, PanelLeftOpen,
  FileText, X, Search,
} from "lucide-react";

import SaveButton          from "@/components/common/SaveButton";
import SaveDraftButton     from "@/components/common/SaveDraftButton";
import EditButton          from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";
import SearchableSelect    from "@/components/common/SearchableSelect";
import PMSection           from "@/components/project-management/common/PMSection";
import PMFormRow           from "@/components/project-management/common/PMFormRow";
import PMInput             from "@/components/project-management/common/PMInput";
import PMDateInput         from "@/components/project-management/common/PMDateInput";
import PMTextarea          from "@/components/project-management/common/PMTextarea";
import AccountSummary           from "@/components/finance/account/common/AccountSummary";
import AccountingJournalTable   from "@/components/finance/account/common/AccountingJournalTable";
import PaymentBreakdownTable    from "@/components/finance/account/payment/PaymentBreakdownTable";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate }         from "@/lib/dateUtils";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { formatAmount }    from "@/helper/numberFormatter";
import { useCopySource, forCopy, copyLoadedToast } from "@/lib/copyRecord";

// ── Schema ────────────────────────────────────────────────────────────────────

const pvItemSchema = z.object({
  pvItemId:        z.number().nullable().optional(),
  pbItemId:        z.number().nullable().optional(),
  jeLineId:        z.number().nullable().optional(),
  purchaseBillId:  z.number().nullable().optional(),
  purchaseBillNo:  z.string().default(""),
  brrNo:           z.string().default(""),
  brrDate:         z.string().default(""),
  orderNo:         z.string().default(""),
  journalEntryId:  z.number().nullable().optional(),
  voucherNo:       z.string().default(""),
  entryDate:       z.string().default(""),
  slNo:            z.number().default(1),
  ccCode:          z.string().default(""),
  ccName:          z.string().default(""),
  description:     z.string().nullable().optional().default(""),
  bookedAmount:    z.coerce.number().default(0),
  paidAmount:      z.coerce.number().default(0),
  balanceAmount:   z.coerce.number().default(0),
  currentAmount:   z.coerce.number().min(0).default(0),
});

const pvGstLineSchema = z.object({
  gstType:        z.string().default(""),
  purchaseBillId: z.number().nullable().optional(),
  purchaseBillNo: z.string().default(""),
  orderNo:        z.string().default(""),
  brrNo:          z.string().default(""),
  brrDate:        z.string().default(""),
  ccCode:         z.string().default(""),
  ccName:         z.string().default(""),
  percent:        z.coerce.number().default(0),
  bookedAmount:   z.coerce.number().default(0),
  paidAmount:     z.coerce.number().default(0),
  balanceAmount:  z.coerce.number().default(0),
  currentAmount:  z.coerce.number().min(0).default(0),
  isSelected:     z.boolean().default(false),
});

const schema = z.object({
  paymentDate:       zodDate(z, "paymentDate", true),
  paymentType:       z.enum(["bill", "voucher"]).default("bill"),
  purchaseBillId:    z.coerce.number().nullable().optional(),
  purchaseBillIds:   z.array(z.number()).default([]),
  journalEntryId:    z.coerce.number().nullable().optional(),
  journalEntryIds:   z.array(z.number()).default([]),
  vendorId:          z.coerce.number().nullable().optional(),
  paymentMode:       z.enum(["Cash", "Bank"]).default("Bank"),
  cashAcId:          z.coerce.number().nullable().optional().default(null),
  bankAcId:          z.coerce.number().nullable().optional().default(null),
  utrVoucherNo:      z.string().optional().default(""),
  paymentRemarks:    z.string().optional().default(""),
  discount:          z.coerce.number().min(0).default(0),
  roundOff:          z.coerce.number().default(0),
  items:             z.array(pvItemSchema).default([]),
  gstLines:          z.array(pvGstLineSchema).default([]),
}).superRefine((val, ctx) => {
  if (val.paymentMode === "Bank" && !val.bankAcId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank account is required", path: ["bankAcId"] });
  }
  if (val.paymentMode === "Cash" && !val.cashAcId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cash account is required", path: ["cashAcId"] });
  }
});

// ── Purchase Bill Picker Modal ─────────────────────────────────────────────────

function PurchaseBillPickerModal({ open, onClose, onConfirm, projectCode, vendorId, currentBillIds = [] }) {
  const [bills,       setBills]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search,      setSearch]      = useState("");

  useEffect(() => {
    if (!open || !projectCode) return;
    setLoading(true);
    setSearch("");
    const url = `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.APPROVED_PURCHASE_BILLS}?projectCode=${projectCode}${vendorId ? `&vendorId=${vendorId}` : ""}`;
    apiRequest({ url, method: "GET" })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setBills(list);
        setSelectedIds(new Set(currentBillIds.filter((id) => list.some((b) => b.id === id))));
      })
      .catch(() => toast.error("Failed to load purchase bills"))
      .finally(() => setLoading(false));
  }, [open, projectCode, vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const filtered = search.trim()
    ? bills.filter((b) =>
        (b.purchaseBillNo  || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.orderNo         || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.vendorBillNo    || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.brrNo           || "").toLowerCase().includes(search.toLowerCase())
      )
    : bills;

  const toggle = (id, isDisabled) => {
    if (isDisabled) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size === 0) { toast.error("Select at least one purchase bill"); return; }
    const selected = bills.filter((b) => selectedIds.has(b.id));
    onConfirm(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-5xl mx-3 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[#f0f4fa]">
          <div>
            <span className="text-[13px] font-semibold text-[#3b6ea5]">Select Purchase Bill(s)</span>
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[11px] text-blue-600 font-medium">{selectedIds.size} selected</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by PR No, vendor bill, BRR no, order no…"
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-300 rounded-sm focus:outline-none focus:border-[#3b6ea5]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[12px]">Loading bills…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-gray-400 italic">
              {bills.length === 0 ? "No approved purchase bills found" : "No results match your search"}
            </div>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-[#1c3a5e] text-white">
                <tr>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-left font-semibold w-[32px]"></th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-left font-semibold w-[100px]">Vendor Bill No</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-left font-semibold w-[85px]">Bill Date</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-left font-semibold w-[90px]">BRR Number</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-left font-semibold w-[85px]">BRR Date</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-left font-semibold w-[100px]">PR Number</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-left font-semibold w-[85px]">PR Date</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-left font-semibold w-[90px]">Order No</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-right font-semibold w-[80px]">Booked</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-right font-semibold w-[80px]">Paid</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-right font-semibold w-[80px]">Balance</th>
                  <th className="border border-[#2a4e7c] px-2 py-1.5 text-center font-semibold w-[75px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const sel        = selectedIds.has(b.id);
                  const locked     = !!b.isLocked;
                  const booked     = Number(b.bookedAmount ?? b.totalInvoiceAmount ?? 0);
                  const paid       = Number(b.approvedPaidAmount ?? 0);
                  const balance    = Number(b.balanceAmount ?? booked ?? 0);
                  const fullyPaid  = !locked && balance <= 0 && booked > 0;
                  const pStatus    = b.paymentStatus || null;
                  const isDisabled = locked || fullyPaid;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => toggle(b.id, isDisabled)}
                      className={`transition-colors ${
                        isDisabled
                          ? "opacity-50 cursor-not-allowed bg-gray-50"
                          : sel
                          ? "bg-[#dbeafe] cursor-pointer"
                          : i % 2 === 0
                          ? "bg-white hover:bg-[#f0f7ff] cursor-pointer"
                          : "bg-[#f8fafc] hover:bg-[#f0f7ff] cursor-pointer"
                      }`}
                    >
                      <td className="border border-[#dde] px-2 py-1 text-center">
                        <input type="checkbox" readOnly checked={sel} disabled={isDisabled} className="accent-[#3b6ea5]" />
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-600">{b.vendorBillNo || "—"}</td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-500 whitespace-nowrap">
                        {b.vendorBillDate ? getfmtDisplaydate(b.vendorBillDate) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 font-medium text-[#1c3a5e]">{b.brrNo || "—"}</td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-500 whitespace-nowrap">
                        {b.brrDate ? getfmtDisplaydate(b.brrDate) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 font-semibold text-[#1c3a5e]">{b.purchaseBillNo || "—"}</td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-500 whitespace-nowrap">
                        {b.processingDate ? getfmtDisplaydate(b.processingDate) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-700">{b.orderNo || "—"}</td>
                      <td className="border border-[#dde] px-2 py-1 text-right text-gray-700">
                        {booked > 0 ? formatAmount(booked) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-right text-orange-600 font-medium">
                        {paid > 0 ? formatAmount(paid) : "—"}
                      </td>
                      <td className={`border border-[#dde] px-2 py-1 text-right font-semibold ${balance <= 0 ? "text-red-500" : "text-[#2a4a2a]"}`}>
                        {booked > 0 ? formatAmount(balance) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-center">
                        {locked ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            pStatus === "Approved"
                              ? "text-blue-700 bg-blue-50"
                              : pStatus?.startsWith("Pending")
                              ? "text-purple-700 bg-purple-50"
                              : "text-orange-600 bg-orange-50"
                          }`}>
                            {pStatus === "Approved" ? "Approved" : pStatus?.startsWith("Pending") ? "Pending" : "Draft"}
                          </span>
                        ) : fullyPaid ? (
                          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Fully Paid</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-[#f8fafc]">
          <span className="text-[11px] text-gray-500">
            {selectedIds.size > 0
              ? `${selectedIds.size} bill(s) selected`
              : "Check one or more bills to pay together"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-[12px] border border-gray-300 rounded-sm hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-4 py-1.5 text-[12px] bg-[#3b6ea5] text-white rounded-sm hover:bg-[#2f5a8e] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Journal Voucher Picker Modal ───────────────────────────────────────────────

function JournalVoucherPickerModal({ open, onClose, onConfirm, projectCode, vendorId, currentJeIds = [] }) {
  const [vouchers,    setVouchers]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search,      setSearch]      = useState("");

  useEffect(() => {
    if (!open || !projectCode) return;
    setLoading(true);
    setSearch("");
    const url = `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.APPROVED_JOURNAL_VOUCHERS}?projectCode=${projectCode}${vendorId ? `&vendorId=${vendorId}` : ""}`;
    apiRequest({ url, method: "GET" })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setVouchers(list);
        setSelectedIds(new Set(currentJeIds.filter((id) => list.some((v) => v.id === id))));
      })
      .catch(() => toast.error("Failed to load journal vouchers"))
      .finally(() => setLoading(false));
  }, [open, projectCode, vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const filtered = search.trim()
    ? vouchers.filter((v) =>
        (v.voucherNo  || "").toLowerCase().includes(search.toLowerCase()) ||
        (v.entryDate  || "").toLowerCase().includes(search.toLowerCase())
      )
    : vouchers;

  const toggle = (id, isDisabled) => {
    if (isDisabled) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size === 0) { toast.error("Select at least one journal voucher"); return; }
    const selected = vouchers.filter((v) => selectedIds.has(v.id));
    onConfirm(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl mx-3 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[#f0f4fa]">
          <div>
            <span className="text-[13px] font-semibold text-[#3b6ea5]">Select Journal Voucher(s)</span>
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[11px] text-blue-600 font-medium">{selectedIds.size} selected</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by voucher no or date…"
              className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-sm outline-none focus:border-[#3b6ea5]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 text-[11px]">
              <Loader2 className="animate-spin w-4 h-4 mr-2" />Loading vouchers…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-[11px] italic">
              No approved journal vouchers found{vendorId ? " for this party" : ""}
            </div>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#f0f4fa]">
                  <th className="border border-[#dde] px-2 py-1.5 text-left font-semibold w-[32px]"></th>
                  <th className="border border-[#dde] px-2 py-1.5 text-left font-semibold">Voucher No</th>
                  <th className="border border-[#dde] px-2 py-1.5 text-left font-semibold w-[90px]">Date</th>
                  <th className="border border-[#dde] px-2 py-1.5 text-left font-semibold w-[80px]">Type</th>
                  <th className="border border-[#dde] px-2 py-1.5 text-right font-semibold w-[90px]">Total Dr</th>
                  <th className="border border-[#dde] px-2 py-1.5 text-right font-semibold w-[90px]">Paid</th>
                  <th className="border border-[#dde] px-2 py-1.5 text-right font-semibold w-[90px]">Balance</th>
                  <th className="border border-[#dde] px-2 py-1.5 text-center font-semibold w-[70px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const locked     = v.isLocked;
                  const fullyPaid  = v.balanceAmount <= 0;
                  const isDisabled = locked || fullyPaid;
                  const checked    = selectedIds.has(v.id);

                  return (
                    <tr
                      key={v.id}
                      onClick={() => toggle(v.id, isDisabled)}
                      className={`cursor-pointer hover:bg-blue-50 transition ${checked ? "bg-blue-50" : ""} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <td className="border border-[#dde] px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          disabled={isDisabled}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="border border-[#dde] px-2 py-1 font-semibold text-[#1c3a5e]">{v.voucherNo || "—"}</td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-500 whitespace-nowrap">
                        {v.entryDate ? v.entryDate.slice(0, 10) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-500">
                        {v.entryMode === "bulk_docket" ? "Bulk" : "Single"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-right text-gray-700">
                        {v.totalDebit > 0 ? formatAmount(v.totalDebit) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-right text-orange-600 font-medium">
                        {v.totalPaid > 0 ? formatAmount(v.totalPaid) : "—"}
                      </td>
                      <td className={`border border-[#dde] px-2 py-1 text-right font-semibold ${v.balanceAmount <= 0 ? "text-red-500" : "text-[#2a4a2a]"}`}>
                        {v.totalDebit > 0 ? formatAmount(v.balanceAmount) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-center">
                        {locked ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            v.paymentStatus === "Approved"
                              ? "text-blue-700 bg-blue-50"
                              : "text-purple-700 bg-purple-50"
                          }`}>
                            {v.paymentStatus?.startsWith("Pending") ? "Pending" : v.paymentStatus || "Draft"}
                          </span>
                        ) : fullyPaid ? (
                          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Fully Paid</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-[#f8fafc]">
          <span className="text-[11px] text-gray-500">
            {selectedIds.size > 0
              ? `${selectedIds.size} voucher(s) selected`
              : "Check one or more vouchers to pay together"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-[12px] border border-gray-300 rounded-sm hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-4 py-1.5 text-[12px] bg-[#3b6ea5] text-white rounded-sm hover:bg-[#2f5a8e] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PaymentForm({
  mode = "create",
  paymentId,
  onAfterSubmit,
  onUuid,
}) {
  // Copy: /new?copy=<id> pre-fills this create form from that record.
  const copyFromId = useCopySource();
  const isCopy = mode === "create" && !!copyFromId;

  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,          setIsEditing]          = useState(mode === "create");
  const [isSubmitted,        setIsSubmitted]        = useState(false);
  const [allowSubmit,        setAllowSubmit]        = useState(mode === "edit");
  const [sidebarOpen,        setSidebarOpen]        = useState(true);
  const [erpPaymentNo,       setErpPaymentNo]       = useState("");
  const [vendorName,         setVendorName]         = useState("");
  const [paymentAcName,      setPaymentAcName]      = useState("");
  const [paymentAcCode,      setPaymentAcCode]      = useState("");
  const [pickerOpen,         setPickerOpen]         = useState(false);
  const [voucherPickerOpen,  setVoucherPickerOpen]  = useState(false);
  const [itemsLoading,       setItemsLoading]       = useState(false);
  const [bankCashOpts,       setBankCashOpts]       = useState([]);
  const [vendorList,         setVendorList]         = useState([]);

  // Bill snapshot fields (read-only display) — derived from selected bills
  const [selectedBills,  setSelectedBills]  = useState([]); // array of bill meta objects
  const [brrDate,        setBrrDate]        = useState("");  // from first selected bill
  const [vendorBillNo,   setVendorBillNo]   = useState("");
  const [vendorBillDate, setVendorBillDate] = useState("");

  // Voucher snapshot — derived from selected journal entries
  const [selectedVouchers, setSelectedVouchers] = useState([]);

  const skipClearOnVendorChange = useRef(false);

  const {
    register, control, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: {
    paymentDate:       new Date().toISOString().split("T")[0],
    paymentType:       "bill",
    purchaseBillId:    null,
    purchaseBillIds:   [],
    journalEntryId:    null,
    journalEntryIds:   [],
    vendorId:          null,
    paymentMode:       "Bank",
    cashAcId:          null,
    bankAcId:          null,
    utrVoucherNo:      "",
    paymentRemarks:    "",
    discount:          0,
    roundOff:          0,
    items:             [],
    gstLines:          [],
  }});

  const { fields: itemFields, replace: replaceItems }       = useFieldArray({ control, name: "items" });
  const { fields: gstFields,  replace: replaceGst }         = useFieldArray({ control, name: "gstLines" });

  const disabled        = isViewMode || !isEditing || isSubmitting || isSubmitted;
  const paymentMode     = watch("paymentMode");
  const paymentType     = watch("paymentType") || "bill";
  const isVoucher       = paymentType === "voucher";
  const watchedItems    = watch("items")            || [];
  const watchedGst      = watch("gstLines")         || [];
  const purchaseBillId  = watch("purchaseBillId");
  const purchaseBillIds = watch("purchaseBillIds")  || [];
  const journalEntryIds = watch("journalEntryIds")  || [];
  const vendorId        = watch("vendorId");

  // Totals
  const basicTotal   = watchedItems.reduce((s, it) => s + Number(it?.currentAmount || 0), 0);
  const gstTotal     = watchedGst.filter((l) => l.isSelected).reduce((s, l) => s + Number(l.currentAmount || 0), 0);
  const totalInvoice = basicTotal + gstTotal - Number(watch("discount") || 0) + Number(watch("roundOff") || 0);

  // Auto round-off
  useEffect(() => {
    const raw = basicTotal + gstTotal - Number(watch("discount") || 0);
    const computed = parseFloat((Math.round(raw) - raw).toFixed(2));
    if (computed !== Number(watch("roundOff") || 0)) setValue("roundOff", computed, { shouldDirty: false });
  }, [basicTotal, gstTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bank/Cash options
  const bankOpts = bankCashOpts
    .filter((a) => a.type === "BANK")
    .map((a) => ({
      ...a,
      displayLabel: [a.bankName, a.bankAcNumber].filter(Boolean).join(" — ") || a.bankHolderName || a.bankCode,
    }));
  const cashOpts = bankCashOpts
    .filter((a) => a.type === "CASH")
    .map((a) => ({ ...a, displayLabel: [a.bankHolderName, a.bankCode].filter(Boolean).join(" — ") }));

  // ── Load initial data ──────────────────────────────────────────────
  useEffect(() => {
    if (projectCode) {
      apiRequest({ url: `${API_ENDPOINTS.MASTER.BANK_CASH.LIST}?projectCode=${projectCode}`, method: "GET" })
        .then((res) => setBankCashOpts(res.data || []))
        .catch(() => {});
    }
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_LEDGER}?type=creditor`, method: "GET" })
      .then((res) => setVendorList((res.data || []).sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || ""))))
      .catch(() => {});
  }, [projectCode]);

  // ── Payment account for journal (derived from form watch) ───────────
  useEffect(() => {
    if (paymentMode === "Bank") {
      const id = watch("bankAcId");
      const opt = bankOpts.find((o) => o.id === id);
      if (opt) {
        const acNo = opt.bankAcNumber;
        setPaymentAcName(acNo ? `${opt.bankHolderName || opt.bankName || "Bank"} (Acc: ${acNo})` : (opt.displayLabel || "BANK"));
        setPaymentAcCode("BANK");
      } else {
        setPaymentAcName(""); setPaymentAcCode(id ? "BANK" : "");
      }
    } else if (paymentMode === "Cash") {
      const id = watch("cashAcId");
      const opt = cashOpts.find((o) => o.id === id);
      if (opt) {
        setPaymentAcName(opt.displayLabel || "CASH");
        setPaymentAcCode("CASH");
      } else {
        setPaymentAcName(""); setPaymentAcCode(id ? "CASH" : "");
      }
    }
  }, [paymentMode, watch("bankAcId"), watch("cashAcId"), bankCashOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load items when bill(s) selected (create mode) ─────────────────
  const loadBillsItems = useCallback(async (billIds) => {
    if (!billIds || billIds.length === 0 || mode !== "create") return;
    setItemsLoading(true);
    try {
      let d;
      if (billIds.length === 1) {
        const res = await apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.PURCHASE_BILL_ITEMS}${billIds[0]}`, method: "GET" });
        const single = res.data || {};
        // Normalize single-bill response to match multi shape
        d = {
          bills: [{
            id: single.purchaseBillId,
            purchaseBillNo: single.purchaseBillNo,
            brrNo: single.brrNo || "",
            brrDate: single.brrDate || "",
            vendorBillNo: single.vendorBillNo,
            vendorBillDate: single.vendorBillDate,
            orderNo: single.orderNo,
            vendorId: single.vendorId,
            vendorName: single.vendorName,
          }],
          items: (single.items || []).map((it) => ({
            ...it,
            purchaseBillId: single.purchaseBillId,
            purchaseBillNo: single.purchaseBillNo,
            brrNo: single.brrNo || "",
            brrDate: single.brrDate || "",
            orderNo: single.orderNo || "",
          })),
          gstLines: (single.gstLines || []).map((l) => ({
            ...l,
            purchaseBillId: single.purchaseBillId,
            purchaseBillNo: single.purchaseBillNo,
          })),
        };
      } else {
        const params = billIds.map((id) => `billIds=${id}`).join("&");
        const res = await apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.PURCHASE_BILL_ITEMS_MULTI}?${params}`, method: "GET" });
        d = res.data || {};
      }

      const firstBill = (d.bills || [])[0] || {};
      setSelectedBills(d.bills || []);
      setBrrDate(firstBill.brrDate || "");
      setVendorBillNo(firstBill.vendorBillNo || "");
      setVendorBillDate(firstBill.vendorBillDate || "");

      if (firstBill.vendorName) setVendorName(firstBill.vendorName);
      if (firstBill.vendorId) {
        skipClearOnVendorChange.current = true;
        setValue("vendorId", firstBill.vendorId, { shouldDirty: false });
      }

      replaceItems((d.items || []).map((it, i) => ({
        pvItemId:       null,
        pbItemId:       it.pbItemId       ?? null,
        jeLineId:       null,
        journalEntryId: null,
        voucherNo:      "",
        entryDate:      "",
        purchaseBillId: it.purchaseBillId ?? null,
        purchaseBillNo: it.purchaseBillNo || "",
        brrNo:          it.brrNo          || "",
        brrDate:        it.brrDate        || "",
        orderNo:        it.orderNo        || "",
        slNo:           i + 1,
        ccCode:         it.ccCode         || "",
        ccName:         it.ccName         || "",
        description:    it.description    || "",
        bookedAmount:   Number(it.bookedAmount  || 0),
        paidAmount:     Number(it.paidAmount    || 0),
        balanceAmount:  Number(it.balanceAmount || 0),
        currentAmount:  0,
      })));

      replaceGst((d.gstLines || []).map((l) => ({
        gstType:        l.gstType        || "",
        purchaseBillId: l.purchaseBillId ?? null,
        purchaseBillNo: l.purchaseBillNo || "",
        orderNo:        l.orderNo        || "",
        brrNo:          l.brrNo          || "",
        brrDate:        l.brrDate        || "",
        ccCode:         l.ccCode         || "",
        ccName:         l.ccName         || "",
        percent:        Number(l.percent    || 0),
        bookedAmount:   Number(l.bookedAmount  || 0),
        paidAmount:     Number(l.paidAmount    || 0),
        balanceAmount:  Number(l.balanceAmount || 0),
        currentAmount:  0,
        isSelected:     !!l.isSelected,
      })));

      setAllowSubmit(false);
    } catch {
      toast.error("Failed to load bill items");
    } finally {
      setItemsLoading(false);
    }
  }, [mode, setValue, replaceItems, replaceGst]);

  useEffect(() => {
    if (!isVoucher) loadBillsItems(purchaseBillIds);
  }, [purchaseBillIds?.join(","), isVoucher]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load items when voucher(s) selected (create mode) ──────────────
  const loadVoucherItems = useCallback(async (jeIds) => {
    if (!jeIds || jeIds.length === 0 || mode !== "create") return;
    setItemsLoading(true);
    try {
      let d;
      if (jeIds.length === 1) {
        const res = await apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.JOURNAL_VOUCHER_ITEMS}${jeIds[0]}`, method: "GET" });
        const single = res.data || {};
        d = {
          entries: [{
            id:        single.journalEntryId,
            voucherNo: single.voucherNo,
            entryDate: single.entryDate,
            vendorId:  single.vendorId,
            vendorName: single.vendorName,
          }],
          items: (single.items || []).map((it) => ({
            ...it,
            journalEntryId: single.journalEntryId,
            voucherNo:      single.voucherNo,
            entryDate:      single.entryDate,
          })),
        };
      } else {
        const params = jeIds.map((id) => `jeIds=${id}`).join("&");
        const res = await apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.JOURNAL_VOUCHER_ITEMS_MULTI}?${params}`, method: "GET" });
        d = res.data || {};
      }

      const firstEntry = (d.entries || [])[0] || {};
      setSelectedVouchers(d.entries || []);

      if (firstEntry.vendorName) setVendorName(firstEntry.vendorName);
      if (firstEntry.vendorId) {
        skipClearOnVendorChange.current = true;
        setValue("vendorId", firstEntry.vendorId, { shouldDirty: false });
      }

      replaceItems((d.items || []).map((it, i) => ({
        pvItemId:       null,
        pbItemId:       null,
        jeLineId:       it.jeLineId ?? null,
        journalEntryId: it.journalEntryId ?? null,
        voucherNo:      it.voucherNo || "",
        entryDate:      it.entryDate || "",
        slNo:           i + 1,
        ccCode:         it.ccCode || "",
        ccName:         it.ccName || "",
        description:    it.description || "",
        bookedAmount:   Number(it.bookedAmount || 0),
        paidAmount:     Number(it.paidAmount   || 0),
        balanceAmount:  Number(it.balanceAmount || 0),
        currentAmount:  0,
      })));
      replaceGst([]);
      setAllowSubmit(false);
    } catch {
      toast.error("Failed to load voucher items");
    } finally {
      setItemsLoading(false);
    }
  }, [mode, setValue, replaceItems, replaceGst]);

  useEffect(() => {
    if (isVoucher) loadVoucherItems(journalEntryIds);
  }, [journalEntryIds?.join(","), isVoucher]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch Detail (edit/view) ─────────────────────────────────────
  useEffect(() => {
    const loadId = isCopy ? copyFromId : paymentId;
    if ((mode === "create" && !isCopy) || !loadId) return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.GET_BY_ID}${loadId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        // Populate bill display state
        const primaryBill = { purchaseBillNo: d.purchaseBillNo, brrNo: d.brrNo, brrDate: d.brrDate };
        setSelectedBills(d.bills?.length ? d.bills : [primaryBill]);
        setBrrDate(d.brrDate || "");
        setVendorBillNo(d.vendorBillNo || "");
        setVendorBillDate(d.vendorBillDate || "");
        setVendorName(d.vendorName || "");

        // Build payment account display name
        const pMode = (d.paymentMode || "").toUpperCase();
        if (pMode === "BANK") {
          const name = d.bankAcNo ? `${d.bankAcName} (Acc: ${d.bankAcNo})` : (d.bankAcName || "BANK");
          setPaymentAcName(name); setPaymentAcCode("BANK");
        } else if (pMode === "CASH") {
          const name = d.cashAcNo ? `${d.cashAcName} (Acc: ${d.cashAcNo})` : (d.cashAcName || "CASH");
          setPaymentAcName(name); setPaymentAcCode("CASH");
        }

        const loadedPaymentType = d.paymentType || "bill";
        const isLoadedVoucher = loadedPaymentType === "voucher";

        if (isLoadedVoucher) {
          // Voucher payment load
          setSelectedVouchers(d.entries?.length ? d.entries : [{ id: d.journalEntryId, voucherNo: d.voucherNo }]);

          // Build unique JE ids from items
          const jeIdsFromItems = [...new Set((d.items || []).map((it) => it.journalEntryId).filter(Boolean))];
          const resolvedJeIds = jeIdsFromItems.length ? jeIdsFromItems : (d.journalEntryId ? [d.journalEntryId] : []);

          reset({
            paymentDate:     d.paymentDate    || "",
            paymentType:     "voucher",
            purchaseBillId:  null,
            purchaseBillIds: [],
            journalEntryId:  d.journalEntryId || null,
            journalEntryIds: resolvedJeIds,
            vendorId:        d.vendorId       || null,
            paymentMode:     d.paymentMode    || "Bank",
            cashAcId:        d.cashAcId       || null,
            bankAcId:        d.bankAcId       || null,
            utrVoucherNo:    d.utrVoucherNo   || "",
            paymentRemarks:  d.paymentRemarks || "",
            discount:        Number(d.discount  || 0),
            roundOff:        Number(d.roundOff  || 0),
            items: (d.items || []).map((it, i) => ({
              pvItemId:       isCopy ? null : it.id ?? null,
              pbItemId:       null,
              jeLineId:       it.jeLineId       ?? null,
              journalEntryId: it.journalEntryId ?? null,
              voucherNo:      it.voucherNo      || "",
              entryDate:      it.entryDate      || "",
              purchaseBillNo: "", brrNo: "", brrDate: "", orderNo: "",
              slNo: i + 1, ccCode: it.ccCode || "", ccName: it.ccName || "", description: it.description || "",
              bookedAmount: Number(it.bookedAmount || 0), paidAmount: Number(it.paidAmount || 0),
              balanceAmount: Number(it.balanceAmount || 0), currentAmount: Number(it.currentAmount || 0),
            })),
            gstLines: [],
          });

          if (!isCopy) {
            const no = d.receiptNo;
            if (no) setErpPaymentNo(no);
            const uuid = d.receiptUuid;
            if (uuid && onUuid) onUuid(uuid);
            const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
            setIsSubmitted(locked);
            setAllowSubmit(!locked);
            setIsEditing(false);
          } else {
            copyLoadedToast(d.receiptNo);
          }
          return;
        }

        // ── Bill payment load ──────────────────────────────────────
        // Collect unique bill ids from items (multi-bill support)
        const billIdsFromItems = [...new Set((d.items || []).map((it) => it.purchaseBillId).filter(Boolean))];
        const resolvedBillIds = billIdsFromItems.length ? billIdsFromItems : (d.purchaseBillId ? [d.purchaseBillId] : []);

        reset({
          paymentDate:       d.paymentDate    || "",
          paymentType:       "bill",
          purchaseBillId:    d.purchaseBillId || null,
          purchaseBillIds:   resolvedBillIds,
          journalEntryId:    null,
          journalEntryIds:   [],
          vendorId:          d.vendorId       || null,
          paymentMode:       d.paymentMode    || "Bank",
          cashAcId:          d.cashAcId       || null,
          bankAcId:          d.bankAcId       || null,
          utrVoucherNo:      d.utrVoucherNo   || "",
          paymentRemarks:    d.paymentRemarks || "",
          discount:          Number(d.discount  || 0),
          roundOff:          Number(d.roundOff  || 0),
          items: (d.items || []).map((it, i) => ({
            pvItemId:       isCopy ? null : it.id ?? null,
            pbItemId:       it.pbItemId       ?? null,
            jeLineId:       null,
            journalEntryId: null,
            voucherNo:      "", entryDate:      "",
            purchaseBillId: it.purchaseBillId ?? null,
            purchaseBillNo: it.purchaseBillNo || "",
            brrNo:          it.brrNo          || "",
            brrDate:        it.brrDate        || "",
            orderNo:        it.orderNo        || "",
            slNo: i + 1, ccCode: it.ccCode || "", ccName: it.ccName || "", description: it.description || "",
            bookedAmount: Number(it.bookedAmount || 0), paidAmount: Number(it.paidAmount || 0),
            balanceAmount: Number(it.balanceAmount || 0), currentAmount: Number(it.currentAmount || 0),
          })),
          gstLines: (d.gstLines || []).map((l) => ({
            gstType:        l.gstType        || "",
            purchaseBillId: l.purchaseBillId ?? null,
            purchaseBillNo: l.purchaseBillNo || "",
            orderNo:        l.orderNo        || "",
            brrNo:          l.brrNo          || "",
            brrDate:        l.brrDate        || "",
            ccCode: l.ccCode || "", ccName: l.ccName || "",
            percent: Number(l.percent || 0),
            bookedAmount: Number(l.bookedAmount || 0), paidAmount: Number(l.paidAmount || 0),
            balanceAmount: Number(l.balanceAmount || 0), currentAmount: Number(l.currentAmount || 0),
            isSelected: !!l.isSelected,
          })),
        });

        if (isCopy) {
          copyLoadedToast(d.receiptNo);
          return;
        }

        const no = d.receiptNo;
        if (no) setErpPaymentNo(no);
        const uuid = d.receiptUuid;
        if (uuid && onUuid) onUuid(uuid);

        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        setIsEditing(false);
      })
      .catch(() => toast.error("Failed to load payment details"));
  }, [copyFromId, paymentId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Journal entry (CR = bank/cash, DR = vendor) ───────────────────
  const journalEntries = useMemo(() => {
    if (!paymentAcCode) return [];
    return [{ ccCode: paymentAcCode, ccName: paymentAcName || paymentAcCode, amount: totalInvoice, isSelected: true, toggleable: false }];
  }, [paymentAcName, paymentAcCode, totalInvoice]);

  // ── Bill picker confirm ───────────────────────────────────────────
  const handleBillConfirm = useCallback((bills) => {
    const ids = bills.map((b) => b.id);
    setValue("purchaseBillIds", ids, { shouldDirty: true });
    setValue("purchaseBillId", ids[0] ?? null, { shouldDirty: false });
    setPickerOpen(false);
  }, [setValue]);

  // ── Voucher picker confirm ────────────────────────────────────────
  const handleVoucherConfirm = useCallback((vouchers) => {
    const ids = vouchers.map((v) => v.id);
    setValue("journalEntryIds", ids, { shouldDirty: true });
    setValue("journalEntryId", ids[0] ?? null, { shouldDirty: false });
    setVoucherPickerOpen(false);
  }, [setValue]);

  // ── Payment type toggle ───────────────────────────────────────────
  const handlePaymentTypeChange = useCallback((type) => {
    setValue("paymentType", type, { shouldDirty: true });
    // Clear both bill and voucher selections on type switch
    setValue("purchaseBillId",  null, { shouldDirty: true });
    setValue("purchaseBillIds", [],   { shouldDirty: true });
    setValue("journalEntryId",  null, { shouldDirty: true });
    setValue("journalEntryIds", [],   { shouldDirty: true });
    replaceItems([]);
    replaceGst([]);
    setSelectedBills([]); setBrrDate(""); setVendorBillNo(""); setVendorBillDate("");
    setSelectedVouchers([]);
  }, [setValue, replaceItems, replaceGst]);

  // Clear bill/items when vendor changes (unless auto-set from bill load)
  const prevVendorId = useRef(vendorId);
  useEffect(() => {
    if (skipClearOnVendorChange.current) {
      skipClearOnVendorChange.current = false;
      prevVendorId.current = vendorId;
      return;
    }
    if (prevVendorId.current !== vendorId && mode === "create") {
      setValue("purchaseBillId",  null, { shouldDirty: true });
      setValue("purchaseBillIds", [],   { shouldDirty: true });
      setValue("journalEntryId",  null, { shouldDirty: true });
      setValue("journalEntryIds", [],   { shouldDirty: true });
      replaceItems([]);
      replaceGst([]);
      setSelectedBills([]); setBrrDate(""); setVendorBillNo(""); setVendorBillDate("");
      setSelectedVouchers([]);
    }
    prevVendorId.current = vendorId;
  }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Draft ────────────────────────────────────────────────────
  const onSave = async (v) => {
    for (let i = 0; i < v.items.length; i++) {
      if (Number(v.items[i].currentAmount) > Number(v.items[i].balanceAmount)) {
        toast.error(`Row ${i + 1}: amount exceeds balance`); return;
      }
    }
    for (let i = 0; i < v.gstLines.length; i++) {
      const l = v.gstLines[i];
      if (l.isSelected && Number(l.currentAmount) > Number(l.balanceAmount)) {
        toast.error(`GST row ${i + 1}: amount exceeds balance`); return;
      }
    }

    const EP = API_ENDPOINTS.FINANCE.BILL_PAYMENT;
    const url    = mode === "create" ? EP.CREATE : `${EP.EDIT}${paymentId}`;
    const method = mode === "create" ? "POST"    : "PUT";

    const pType = v.paymentType || "bill";
    let payload;

    if (pType === "voucher") {
      const jeIds = (v.journalEntryIds || []).length ? v.journalEntryIds : (v.journalEntryId ? [v.journalEntryId] : []);
      payload = {
        projectCode,
        paymentType:       "voucher",
        paymentDate:       v.paymentDate,
        journalEntryId:    jeIds[0] || null,
        journalEntryIds:   jeIds,
        vendorId:          v.vendorId       || null,
        paymentMode:       v.paymentMode,
        cashAcId:          v.paymentMode === "Cash" ? (v.cashAcId || null) : null,
        bankAcId:          v.paymentMode === "Bank" ? (v.bankAcId || null) : null,
        utrVoucherNo:      v.utrVoucherNo   || "",
        paymentRemarks:    v.paymentRemarks || "",
        discount:          Number(v.discount  || 0),
        roundOff:          Number(v.roundOff  || 0),
        items: v.items.map((it) => ({
          ...(it.jeLineId ? { jeLineId: it.jeLineId } : {}),
          slNo: it.slNo, ccCode: it.ccCode, ccName: it.ccName,
          bookedAmount: Number(it.bookedAmount || 0), currentAmount: Number(it.currentAmount || 0),
        })),
        gstLines: [],
      };
    } else {
      const billIds = (v.purchaseBillIds || []).length ? v.purchaseBillIds : (v.purchaseBillId ? [v.purchaseBillId] : []);
      payload = {
        projectCode,
        paymentType:     "bill",
        paymentDate:     v.paymentDate,
        purchaseBillId:  billIds[0] || null,
        purchaseBillIds: billIds,
        vendorId:        v.vendorId       || null,
        paymentMode:     v.paymentMode,
        cashAcId:        v.paymentMode === "Cash" ? (v.cashAcId || null) : null,
        bankAcId:        v.paymentMode === "Bank" ? (v.bankAcId || null) : null,
        utrVoucherNo:    v.utrVoucherNo   || "",
        paymentRemarks:  v.paymentRemarks || "",
        discount:        Number(v.discount  || 0),
        roundOff:        Number(v.roundOff  || 0),
        items: v.items.map((it) => ({
          ...(it.pbItemId       ? { pbItemId:       it.pbItemId       } : {}),
          ...(it.purchaseBillId ? { purchaseBillId: it.purchaseBillId } : {}),
          slNo: it.slNo, ccCode: it.ccCode, ccName: it.ccName,
          bookedAmount: Number(it.bookedAmount || 0), currentAmount: Number(it.currentAmount || 0),
        })),
        gstLines: v.gstLines.map((l) => ({
          gstType: l.gstType, ccCode: l.ccCode, ccName: l.ccName,
          bookedAmount: Number(l.bookedAmount || 0), currentAmount: Number(l.currentAmount || 0),
          isSelected: !!l.isSelected,
        })),
      };
    }

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Payment saved as draft" : "Payment updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      const uuid = res?.data?.receiptUuid;
      if (uuid && onUuid) onUuid(uuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/payment/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  // ── Submit for Approval ───────────────────────────────────────────
  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.SUBMIT}${paymentId}`, method: "POST" });
      toast.success("Payment submitted for approval");
      setIsSubmitted(true);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err?.message || "Failed to submit");
    }
  };

  const handleEdit = () => {
    if (isEditing) { reset(); setIsEditing(false); }
    else setIsEditing(true);
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Hide left panel" : "Show left panel"}
        className="mb-2 hidden lg:inline-flex p-1 rounded hover:bg-gray-100 text-gray-500 transition"
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">

        {/* ── LEFT PANEL ───────────────────────────────────────────── */}
        <div className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          <PMSection title="PAYMENT DETAILS:">
            <PMFormRow label="Payment Voucher No" labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <PMInput value={erpPaymentNo || "[Auto]"} disabled readOnly />
            </PMFormRow>
            <PMFormRow label="Payment Date" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <PMDateInput {...register("paymentDate")} disabled={disabled} hasError={errors.paymentDate} className="max-w-[200px]" />
            </PMFormRow>
            <PMFormRow label="Payment Type" labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <div className="flex items-center gap-0 border border-gray-200 rounded-sm overflow-hidden text-[11px]">
                {["bill", "voucher"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && handlePaymentTypeChange(type)}
                    className={`px-3 py-1 font-medium transition capitalize ${
                      paymentType === type
                        ? "bg-[#3b6ea5] text-white"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  >
                    {type === "bill" ? "Bill" : "Voucher"}
                  </button>
                ))}
              </div>
            </PMFormRow>
          </PMSection>

          <PMSection title={isVoucher ? "VOUCHER REFERENCE:" : "BILL REFERENCE:"}>
            <PMFormRow label="Party (Creditor)" labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <Controller name="vendorId" control={control} render={({ field }) => (
                <SearchableSelect
                  options={vendorList}
                  value={field.value ? String(field.value) : ""}
                  disabled={disabled}
                  onChange={(v) => {
                    field.onChange(v ? Number(v) : null);
                    const sel = vendorList.find((x) => String(x.ledgerId) === String(v));
                    setVendorName(sel?.ledgerName || "");
                  }}
                  placeholder="Select Creditor"
                  labelKey="ledgerName"
                  valueKey="ledgerId"
                  searchKeys={["ledgerName"]}
                />
              )} />
            </PMFormRow>

            {isVoucher ? (
              <>
                <PMFormRow label="Voucher(s)" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
                  <div className="flex items-start gap-1.5 flex-1">
                    <div className="flex-1 min-h-[28px] flex flex-wrap gap-1 px-2 py-1 border border-gray-200 rounded-sm bg-gray-50 text-[11px]">
                      {selectedVouchers.length > 0 ? (
                        selectedVouchers.map((v) => (
                          <span key={v.id} className="bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] px-1.5 py-0.5 rounded font-medium">
                            {v.voucherNo || `#${v.id}`}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">Click icon to select voucher(s)</span>
                      )}
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => setVoucherPickerOpen(true)}
                        title="Select Journal Voucher(s)"
                        className="p-1.5 rounded border border-[#166534] text-[#166534] hover:bg-[#166534] hover:text-white transition shrink-0 mt-0.5"
                      >
                        <FileText size={14} />
                      </button>
                    )}
                  </div>
                </PMFormRow>
              </>
            ) : (
              <>
                <PMFormRow label="PR No(s)" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
                  <div className="flex items-start gap-1.5 flex-1">
                    <div className="flex-1 min-h-[28px] flex flex-wrap gap-1 px-2 py-1 border border-gray-200 rounded-sm bg-gray-50 text-[11px]">
                      {selectedBills.length > 0 ? (
                        selectedBills.map((b) => (
                          <span key={b.id ?? b.purchaseBillNo} className="bg-[#dbeafe] text-[#1c3a5e] px-1.5 py-0.5 rounded font-medium">
                            {b.purchaseBillNo || `#${b.id}`}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">Click icon to select bill(s)</span>
                      )}
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        title="Select Purchase Bill(s)"
                        className="p-1.5 rounded border border-[#3b6ea5] text-[#3b6ea5] hover:bg-[#3b6ea5] hover:text-white transition shrink-0 mt-0.5"
                      >
                        <FileText size={14} />
                      </button>
                    )}
                  </div>
                </PMFormRow>

                <PMFormRow label="BRR Date" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                  <PMInput value={brrDate ? getfmtDisplaydate(brrDate) : ""} disabled readOnly placeholder="[From Purchase Bill]" className="max-w-[200px]" />
                </PMFormRow>

                <PMFormRow label="Vendor Bill No" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                  <PMInput value={vendorBillNo} disabled readOnly placeholder="[From Purchase Bill]" />
                </PMFormRow>

                <PMFormRow label="Vendor Bill Date" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                  <PMInput value={vendorBillDate ? getfmtDisplaydate(vendorBillDate) : ""} disabled readOnly placeholder="[From Purchase Bill]" className="max-w-[200px]" />
                </PMFormRow>
              </>
            )}
          </PMSection>

          <PMSection title="PAYMENT MODE:">
            <PMFormRow label="Mode" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <Controller name="paymentMode" control={control} render={({ field }) => (
                <SearchableSelect
                  options={[{ label: "Bank", value: "Bank" }, { label: "Cash", value: "Cash" }]}
                  value={field.value || ""}
                  disabled={disabled}
                  onChange={(v) => { field.onChange(v); setValue("cashAcId", null); setValue("bankAcId", null); setPaymentAcName(""); setPaymentAcCode(""); }}
                  placeholder="Cash / Bank"
                  labelKey="label"
                  valueKey="value"
                  searchKeys={["label"]}
                />
              )} />
            </PMFormRow>

            {paymentMode === "Cash" && (
              <PMFormRow label="Cash A/c" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <div className="flex-1">
                  <Controller name="cashAcId" control={control} render={({ field }) => (
                    <SearchableSelect
                      options={cashOpts}
                      value={field.value ? String(field.value) : ""}
                      disabled={disabled}
                      onChange={(v) => field.onChange(v ? Number(v) : null)}
                      placeholder="Select Cash Account"
                      labelKey="displayLabel"
                      valueKey="id"
                      searchKeys={["displayLabel", "bankCode"]}
                      hasError={!!errors.cashAcId}
                    />
                  )} />
                  {errors.cashAcId && (
                    <p className="text-[11px] text-red-500 mt-0.5">{errors.cashAcId.message}</p>
                  )}
                </div>
              </PMFormRow>
            )}

            {paymentMode === "Bank" && (
              <PMFormRow label="Bank A/c" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <div className="flex-1">
                  <Controller name="bankAcId" control={control} render={({ field }) => (
                    <SearchableSelect
                      options={bankOpts}
                      value={field.value ? String(field.value) : ""}
                      disabled={disabled}
                      onChange={(v) => field.onChange(v ? Number(v) : null)}
                      placeholder="Select Bank Account"
                      labelKey="displayLabel"
                      valueKey="id"
                      searchKeys={["displayLabel", "bankCode"]}
                      hasError={!!errors.bankAcId}
                    />
                  )} />
                  {errors.bankAcId && (
                    <p className="text-[11px] text-red-500 mt-0.5">{errors.bankAcId.message}</p>
                  )}
                </div>
              </PMFormRow>
            )}

            <PMFormRow label="UTR / Voucher No." labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <PMInput {...register("utrVoucherNo")} disabled={disabled} placeholder="Enter UTR / Voucher No." />
            </PMFormRow>
          </PMSection>

          <PMSection title="OTHER:">
            <PMFormRow label="Remarks" labelWidth="sm:w-[160px] sm:min-w-[160px]" className="sm:items-start">
              <Controller name="paymentRemarks" control={control} render={({ field }) => (
                <PMTextarea
                  value={field.value || ""}
                  onChange={field.onChange}
                  disabled={disabled}
                  placeholder="Payment remarks"
                  rows={3}
                  maxRows={6}
                  className="flex-1 w-full"
                />
              )} />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Accounting Journal — DR: Creditor, CR: Bank/Cash */}
          <AccountingJournalTable
            debtorName={vendorName || "—"}
            entries={journalEntries}
            totalDr={totalInvoice}
            totalCr={totalInvoice}
            disabled={disabled}
            creditorMode={false}
            emptyText="Select a party and bank/cash account to generate accounting entries"
          />

          {/* Bill-wise / Voucher-wise Payment Breakdown */}
          <PaymentBreakdownTable
            paymentType={paymentType}
            itemFields={itemFields}
            gstFields={gstFields}
            watchedItems={watchedItems}
            watchedGst={watchedGst}
            register={register}
            disabled={disabled}
            loading={itemsLoading}
          />

          {/* Summary */}
          <AccountSummary
            basicTotal={basicTotal}
            gstTotal={gstTotal}
            totalInvoice={totalInvoice}
            register={register}
            watch={watch}
            disabled={disabled}
          />

          {/* Action buttons */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton onClick={() => handleSubmit(onSave)()} loading={isSubmitting} disabled={isSubmitting} />
              )}
              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                loadingText="Submitting..."
                confirmationTitle="Submit Payment for Approval?"
                requireConfirmation
              >
                Submit
              </SaveButton>
              {mode !== "create" && !isSubmitted && (
                <EditButton onClick={handleEdit} disabled={isSubmitting}>
                  {isEditing ? "Cancel" : "Edit"}
                </EditButton>
              )}
              {mode === "edit" && !isEditing && (
                <DeleteRequestButton
                  moduleCode="BILL_PAYMENT"
                  recordId={Number(paymentId)}
                  onDeleted={() => router.back()}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Purchase Bill Picker Modal */}
      <PurchaseBillPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleBillConfirm}
        projectCode={projectCode}
        vendorId={vendorId}
        currentBillIds={purchaseBillIds}
      />

      {/* Journal Voucher Picker Modal */}
      <JournalVoucherPickerModal
        open={voucherPickerOpen}
        onClose={() => setVoucherPickerOpen(false)}
        onConfirm={handleVoucherConfirm}
        projectCode={projectCode}
        vendorId={vendorId}
        currentJeIds={journalEntryIds || []}
      />
    </div>
  );
}
