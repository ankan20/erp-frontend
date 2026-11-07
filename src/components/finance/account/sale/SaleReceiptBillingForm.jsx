"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray }        from "react-hook-form";
import { useFormWithToast as useForm }      from "@/hooks/useFormWithToast";
import { z }           from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast }       from "sonner";
import { useRouter }   from "next/navigation";
import {
  Loader2, PanelLeftClose, PanelLeftOpen,
  FileText, X, Search, AlertCircle,
} from "lucide-react";
import PMDateInput from "@/components/project-management/common/PMDateInput";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

import SaveButton          from "@/components/common/SaveButton";
import SaveDraftButton     from "@/components/common/SaveDraftButton";
import EditButton          from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";
import PMSection           from "@/components/project-management/common/PMSection";
import PMFormRow           from "@/components/project-management/common/PMFormRow";
import PMInput             from "@/components/project-management/common/PMInput";
import PMTextarea          from "@/components/project-management/common/PMTextarea";
import AccountSummary           from "@/components/finance/account/common/AccountSummary";
import AccountingJournalTable   from "@/components/finance/account/common/AccountingJournalTable";
import ReceiptBillingBreakdownTable from "@/components/finance/account/sale/ReceiptBillingBreakdownTable";
import { formatAmount }  from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate }         from "@/lib/dateUtils";

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  slNo:           z.number(),
  ccCode:         z.string().default(""),
  ccName:         z.string().default(""),
  bookedAmount:   z.coerce.number().default(0),
  receivedAmount: z.coerce.number().default(0),
  balanceAmount:  z.coerce.number().default(0),
  currentAmount:  z.coerce.number().min(0).default(0),
});

const gstLineSchema = z.object({
  gstType:        z.string(),
  ccCode:         z.string().default(""),
  ccName:         z.string().default(""),
  percent:        z.coerce.number().default(0),
  bookedAmount:   z.coerce.number().default(0),
  receivedAmount: z.coerce.number().default(0),
  balanceAmount:  z.coerce.number().default(0),
  currentAmount:  z.coerce.number().min(0).default(0),
  isSelected:     z.boolean().default(false),
});

const DEFAULT_GST_LINES = [
  { gstType: "IGST", ccCode: "IGST", ccName: "Output-IGST", percent: 0, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
  { gstType: "CGST", ccCode: "CGST", ccName: "Output-CGST", percent: 0, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
  { gstType: "SGST", ccCode: "SGST", ccName: "Output-SGST", percent: 0, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
];

const schema = z.object({
  srbDate:           zodDate(z, "Date", true),
  erpDocNumber:      z.string().default(""),
  saleOrderDate:     zodDate(z, "saleOrderDate"),
  certifiedBillId:   z.coerce.number().nullable().optional(),
  certifiedBillNo:   z.string().default(""),
  certifiedBillDate: zodDate(z, "certifiedBillDate"),
  invoiceNo:         z.string().optional().default(""),
  invoiceDate:       z.string().optional().default(""),
  billToAddress:     z.string().optional().default(""),
  shipToAddress:     z.string().optional().default(""),
  discount:          z.coerce.number().min(0).default(0),
  roundOff:          z.coerce.number().default(0),
  items:             z.array(itemSchema).min(1, "At least one item is required"),
  gstLines:          z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  srbDate: "",
  erpDocNumber: "", saleOrderDate: "", certifiedBillId: null,
  certifiedBillNo: "", certifiedBillDate: "",
  invoiceNo: "", invoiceDate: "", billToAddress: "", shipToAddress: "",
  discount: 0, roundOff: 0,
  items:    [{ slNo: 1, ccCode: "", ccName: "", bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0 }],
  gstLines: DEFAULT_GST_LINES,
};

// ── Invoice Picker Modal ───────────────────────────────────────────────────────

const STATUS_CFG = {
  Free:    { cls: "bg-green-100 text-green-700 border-green-300",   tip: "Not yet received — full amount available" },
  Partial: { cls: "bg-blue-100 text-blue-700 border-blue-300",      tip: "Partially received — balance available to receive" },
  Draft:   { cls: "bg-yellow-100 text-yellow-700 border-yellow-300", tip: "A Draft receipt billing is in progress — cannot select" },
};

function InvoiceStatusBadge({ status }) {
  const { cls, tip } = STATUS_CFG[status] || { cls: "bg-gray-100 text-gray-600 border-gray-300", tip: status };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border cursor-help ${cls}`}>
          {status}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" variant="text">{tip}</TooltipContent>
    </Tooltip>
  );
}

function InvoicePickerModal({ open, onClose, onConfirm, projectCode, currentInvoiceNo }) {
  const [invoices,    setInvoices]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [selectedId,  setSelectedId]  = useState(null);
  const [search,      setSearch]      = useState("");

  useEffect(() => {
    if (!open || !projectCode) return;
    setSearch("");
    setSelectedId(null);
    setInvoices([]);
    setLoading(true);
    setError(null);
    apiRequest({
      url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT_BILLING.AVAILABLE_INVOICES}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setInvoices(list);
        if (currentInvoiceNo) {
          const match = list.find((inv) => inv.saleBillNo === currentInvoiceNo);
          if (match) setSelectedId(match.id);
        }
      })
      .catch((err) => setError(err?.message || "Failed to load invoices"))
      .finally(() => setLoading(false));
  }, [open, projectCode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter((inv) =>
      (inv.saleBillNo      || "").toLowerCase().includes(q) ||
      (inv.saleOrderNo     || "").toLowerCase().includes(q) ||
      (inv.customerOrderNo || "").toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const selectedInv = invoices.find((inv) => inv.id === selectedId) || null;

  const handleConfirm = () => {
    if (!selectedInv) return;
    onConfirm(selectedInv);
    onClose();
  };

  if (!open) return null;

  return (
    <TooltipProvider>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[85vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Select Sale Invoice</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Showing only invoices not yet linked to a receipt billing.
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 py-3 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice no, sale order no, customer order no…"
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          {/* Selected badge */}
          {selectedInv && (
            <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 shrink-0 flex items-center gap-2 text-[12px]">
              <span className="text-blue-700">
                Selected: <strong>{selectedInv.saleBillNo}</strong>
                {selectedInv.invoiceDate ? ` — ${getfmtDisplaydate(selectedInv.invoiceDate)}` : ""}
                <span className="ml-2 text-gray-500">({formatAmount(selectedInv.totalInvoiceAmount)})</span>
              </span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-14 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading invoices…
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-red-600 text-sm py-8 px-5">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : (
              <table className="w-full border-collapse text-[12px] min-w-[860px]">
                <thead className="sticky top-0 z-10 bg-[#1c3a5e] text-white">
                  <tr>
                    <th className="px-3 py-2 w-[32px]"></th>
                    <th className="px-3 py-2 text-left font-semibold">Invoice No</th>
                    <th className="px-3 py-2 text-left font-semibold">Invoice Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Sale Order</th>
                    <th className="px-3 py-2 text-left font-semibold">Customer Order No</th>
                    <th className="px-3 py-2 text-right font-semibold">Booked</th>
                    <th className="px-3 py-2 text-right font-semibold">Received</th>
                    <th className="px-3 py-2 text-right font-semibold">Balance</th>
                    <th className="px-3 py-2 text-center font-semibold w-[75px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-gray-400 text-[12px] italic">
                        {search ? "No invoices match your search." : "No available invoices found."}
                      </td>
                    </tr>
                  ) : filtered.map((inv, idx) => {
                    const isSelectable = inv.receiptStatus === "Free" || inv.receiptStatus === "Partial";
                    const isSelected   = inv.id === selectedId;
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => isSelectable && setSelectedId(inv.id)}
                        className={`border-b border-gray-100 transition ${
                          !isSelectable
                            ? "opacity-50 cursor-not-allowed bg-gray-50"
                            : isSelected
                            ? "bg-blue-50 border-blue-200 cursor-pointer"
                            : idx % 2 === 0
                            ? "bg-white hover:bg-gray-50 cursor-pointer"
                            : "bg-[#f7f9fc] hover:bg-gray-100 cursor-pointer"
                        }`}
                      >
                        {/* Radio */}
                        <td className="px-3 py-2 text-center">
                          {isSelectable && (
                            <span
                              className={`inline-flex h-3.5 w-3.5 rounded-full border-2 items-center justify-center
                                ${isSelected ? "border-blue-500 bg-blue-500" : "border-gray-400 bg-white"}`}
                            >
                              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-[#1c3a5e]">{inv.saleBillNo}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {inv.invoiceDate ? getfmtDisplaydate(inv.invoiceDate) : "—"}
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-800">{inv.saleOrderNo || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{inv.customerOrderNo || "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                          {formatAmount(inv.bookedAmount ?? inv.totalInvoiceAmount)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                          {(inv.receivedAmount ?? 0) > 0 ? formatAmount(inv.receivedAmount) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-[#1c3a5e] whitespace-nowrap">
                          {formatAmount(inv.balanceAmount ?? inv.bookedAmount ?? inv.totalInvoiceAmount)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <InvoiceStatusBadge status={inv.receiptStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
            <p className="text-[12px] text-gray-500">
              {selectedInv
                ? `Selected: ${selectedInv.saleBillNo}${selectedInv.receiptStatus === "Partial" ? ` — Balance: ${formatAmount(selectedInv.balanceAmount)}` : ` — ${formatAmount(selectedInv.totalInvoiceAmount)}`}`
                : `${filtered.length} invoice${filtered.length !== 1 ? "s" : ""} available`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-[13px] text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedInv}
                className="px-4 py-1.5 text-[13px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Confirm
              </button>
            </div>
          </div>

        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SaleReceiptBillingForm({
  mode = "create",
  billingId,
  receiptId,
  onAfterSubmit,
  onUuid,
}) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,          setIsEditing]          = useState(mode === "create");
  const [isSubmitted,        setIsSubmitted]        = useState(false);
  const [allowSubmit,        setAllowSubmit]        = useState(mode === "edit");
  const [sidebarOpen,        setSidebarOpen]        = useState(true);
  const [srbNo,              setSrbNo]              = useState("");
  const [debtorName,         setDebtorName]         = useState("");
  const [paymentAcName,      setPaymentAcName]      = useState("");
  const [paymentAcCode,      setPaymentAcCode]      = useState("");
  const [pickerOpen,         setPickerOpen]         = useState(false);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [selectedInvoiceMeta, setSelectedInvoiceMeta] = useState(null); // { saleBillNo, customerOrderNo }
  const skipClearOnOrderChange = useRef(false);

  const {
    register, control, handleSubmit, reset, setValue, watch, getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields,  replace: replaceItems } = useFieldArray({ control, name: "items" });
  const { fields: gstFields,   replace: replaceGst   } = useFieldArray({ control, name: "gstLines" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  const watchedItems  = watch("items")    || [];
  const watchedGst    = watch("gstLines") || DEFAULT_GST_LINES;
  const erpDocNumber  = watch("erpDocNumber");
  const discount      = Number(watch("discount") || 0);

  const basicTotal   = watchedItems.reduce((s, it) => s + Number(it?.currentAmount || 0), 0);
  const gstTotal     = watchedGst.filter((l) => l.isSelected).reduce((s, l) => s + Number(l.currentAmount || 0), 0);
  const totalInvoice = basicTotal + gstTotal - discount + Number(watch("roundOff") || 0);

  // ── Auto round-off ──────────────────────────────────────────────
  useEffect(() => {
    const sub = basicTotal + gstTotal - discount;
    const ro  = Math.round(sub) - sub;
    setValue("roundOff", Math.round(ro * 100) / 100, { shouldDirty: false });
  }, [basicTotal, gstTotal, discount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ─────────────────────────────────────────────────────
  const applyReceiptItems = useCallback((d) => {
    replaceItems(
      (d.items || []).map((it, i) => ({
        slNo:           i + 1,
        ccCode:         it.ccCode         || "",
        ccName:         it.ccName         || "",
        bookedAmount:   Number(it.bookedAmount   || 0),
        receivedAmount: Number(it.receivedAmount || 0),
        balanceAmount:  Number(it.balanceAmount  || 0),
        currentAmount:  Number(it.currentAmount  || 0),
      })),
    );
    const apiGst = d.gstLines || [];
    replaceGst(
      DEFAULT_GST_LINES.map((def) => {
        const match = apiGst.find((l) => l.gstType === def.gstType);
        return match
          ? { ...def, ccCode: match.ccCode || def.ccCode, ccName: match.ccName || def.ccName,
              percent: Number(match.percent ?? def.percent),
              bookedAmount: Number(match.bookedAmount || 0), receivedAmount: Number(match.receivedAmount || 0),
              balanceAmount: Number(match.balanceAmount || 0), currentAmount: Number(match.currentAmount || 0),
              isSelected: !!match.isSelected }
          : { ...def, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false };
      }),
    );
  }, [replaceItems, replaceGst]);

  // ── Invoice selected from picker → lookup fills everything ──────
  const handleInvoiceSelect = useCallback(async (saleBillNo, meta = null) => {
    if (!saleBillNo || !projectCode) return;
    setPickerOpen(false);
    setInvoiceLookupLoading(true);
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT_BILLING.INVOICE_LOOKUP}?invoiceNo=${encodeURIComponent(saleBillNo)}&projectCode=${projectCode}`,
        method: "GET",
      });
      const d = res.data || {};
      setDebtorName(d.debtorName || d.clientName || "");
      setSelectedInvoiceMeta(meta);
      setValue("erpDocNumber",    d.erpDocNumber    || d.ogSaleOrderNo || "");
      setValue("saleOrderDate",   d.saleOrderDate   || "");
      setValue("invoiceNo",       d.invoiceNo        || saleBillNo);
      setValue("invoiceDate",     d.invoiceDate      || "");
      setValue("certifiedBillId",   d.certifiedBillId   || null);
      setValue("certifiedBillNo",   d.certifiedBillNo   || "");
      setValue("certifiedBillDate", d.certifiedBillDate || "");
      setValue("billToAddress",     d.billToAddress     || "");
      setValue("shipToAddress",     d.shipToAddress     || "");
      applyReceiptItems({ ...d, items: (d.items || []).map((it) => ({ ...it, currentAmount: 0 })) });
    } catch (err) {
      toast.error(err?.message || "Failed to load invoice details");
    } finally {
      setInvoiceLookupLoading(false);
    }
  }, [projectCode, setValue, applyReceiptItems]);

  // ── Picker row selected ─────────────────────────────────────────
  const handlePickerSelect = useCallback((inv) => {
    handleInvoiceSelect(inv.saleBillNo, { customerOrderNo: inv.customerOrderNo, saleOrderNo: inv.saleOrderNo });
  }, [handleInvoiceSelect]);

  // ── Fetch parent receipt payment account (create mode only) ───────
  useEffect(() => {
    if (!receiptId || mode !== "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.GET_BY_ID}${receiptId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        const mode = (d.paymentMode || "").toUpperCase();
        if (mode === "BANK") {
          const name = d.bankAcNo ? `${d.bankAcName} (Acc: ${d.bankAcNo})` : (d.bankAcName || "BANK");
          setPaymentAcName(name);
          setPaymentAcCode("BANK");
        } else if (mode === "CASH") {
          const name = d.cashAcNo ? `${d.cashAcName} (Acc: ${d.cashAcNo})` : (d.cashAcName || "CASH");
          setPaymentAcName(name);
          setPaymentAcCode("CASH");
        } else if (mode) {
          // unknown mode — show raw value so journal isn't blank
          setPaymentAcName(mode);
          setPaymentAcCode(mode);
        }
      })
      .catch((err) => console.warn("SRB: failed to fetch parent receipt for payment account", err));
  }, [receiptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch Detail (edit/view) ────────────────────────────────────
  useEffect(() => {
    if (!billingId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT_BILLING.GET_BY_ID}${billingId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        skipClearOnOrderChange.current = true;
        reset({
          srbDate:         d.srbDate         || "",
          erpDocNumber:    d.erpDocNumber    || "",
          saleOrderDate:   d.saleOrderDate   || "",
          certifiedBillId:   d.certifiedBillId   || null,
          certifiedBillNo:   d.certifiedBillNo   || "",
          certifiedBillDate: d.certifiedBillDate || "",
          invoiceNo:       d.invoiceNo        || "",
          invoiceDate:     d.invoiceDate      || "",
          billToAddress:   d.billToAddress    || "",
          shipToAddress:   d.shipToAddress    || "",
          discount:        Number(d.discount  || 0),
          roundOff:        Number(d.roundOff  || 0),
          items: (d.items || []).map((it, i) => ({
            slNo:           i + 1,
            ccCode:         it.ccCode         || "",
            ccName:         it.ccName         || "",
            bookedAmount:   Number(it.bookedAmount   || 0),
            receivedAmount: Number(it.receivedAmount || 0),
            balanceAmount:  Number(it.balanceAmount  || 0),
            currentAmount:  Number(it.currentAmount  || 0),
          })),
          gstLines: DEFAULT_GST_LINES.map((def) => {
            const match = (d.gstLines || []).find((l) => l.gstType === def.gstType);
            return match
              ? { ...def, ccCode: match.ccCode || def.ccCode, ccName: match.ccName || def.ccName,
                  percent: Number(match.percent ?? def.percent),
                  bookedAmount: Number(match.bookedAmount || 0), receivedAmount: Number(match.receivedAmount || 0),
                  balanceAmount: Number(match.balanceAmount || 0), currentAmount: Number(match.currentAmount || 0),
                  isSelected: !!match.isSelected }
              : { ...def, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false };
          }),
        });
        setSrbNo(d.srbNo || "");
        setDebtorName(d.debtorName || d.clientName || "");
        setPaymentAcName(d.paymentAccountName || "");
        setPaymentAcCode(d.paymentAccountCode || "");
        if (d.srbUuid && onUuid) onUuid(d.srbUuid);
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        setIsEditing(false);
      })
      .catch(() => toast.error("Failed to load billing details"));
  }, [billingId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalDr = basicTotal + gstTotal;

  // ── Journal entries (DR rows; CR = debtor) ──────────────────────
  // In sale receipt: DR = Bank/Cash account (payment in), CR = Debtor
  const journalEntries = useMemo(() => {
    if (!paymentAcCode) return [];
    return [{ ccCode: paymentAcCode, ccName: paymentAcName || paymentAcCode, amount: totalDr, isSelected: true, toggleable: false }];
  }, [paymentAcName, paymentAcCode, totalDr]);

  // ── Save Draft ──────────────────────────────────────────────────
  const onSave = async (v) => {
    for (let i = 0; i < v.items.length; i++) {
      const it = v.items[i];
      if (Number(it.currentAmount) > Number(it.balanceAmount)) {
        toast.error(`Row ${i + 1}: Current amount (${formatAmount(it.currentAmount)}) exceeds balance (${formatAmount(it.balanceAmount)})`);
        return;
      }
    }
    for (let i = 0; i < v.gstLines.length; i++) {
      const l = v.gstLines[i];
      if (l.isSelected && Number(l.currentAmount) > Number(l.balanceAmount)) {
        toast.error(`${l.gstType}: Current amount exceeds GST balance (${formatAmount(l.balanceAmount)})`);
        return;
      }
    }

    const payload = {
      projectCode,
      srbDate:          v.srbDate          || "",
      receiptId:        receiptId ? Number(receiptId) : undefined,
      certifiedBillId:  v.certifiedBillId,
      invoiceNo:        v.invoiceNo        || "",
      invoiceDate:      v.invoiceDate      || "",
      billToAddress:     v.billToAddress     || "",
      shipToAddress:     v.shipToAddress     || "",
      certifiedBillNo:   v.certifiedBillNo   || "",
      certifiedBillDate: v.certifiedBillDate || "",
      discount:         Number(v.discount  || 0),
      roundOff:         Number(v.roundOff  || 0),
      items: v.items.map((it, i) => ({
        slNo:           i + 1,
        ccCode:         it.ccCode,
        ccName:         it.ccName,
        bookedAmount:   Number(it.bookedAmount),
        receivedAmount: Number(it.receivedAmount),
        balanceAmount:  Number(it.balanceAmount),
        currentAmount:  Number(it.currentAmount),
      })),
      gstLines: v.gstLines.map((l) => ({
        gstType:        l.gstType,
        ccCode:         l.ccCode,
        ccName:         l.ccName,
        percent:        Number(l.percent),
        bookedAmount:   Number(l.bookedAmount),
        receivedAmount: Number(l.receivedAmount),
        balanceAmount:  Number(l.balanceAmount),
        currentAmount:  Number(l.currentAmount),
        isSelected:     !!l.isSelected,
      })),
    };

    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.SALE_RECEIPT_BILLING.CREATE
      : `${API_ENDPOINTS.FINANCE.SALE_RECEIPT_BILLING.EDIT}${billingId}`;
    const method = mode === "create" ? "POST" : "PUT";

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Billing saved as draft" : "Billing updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.srbUuid && onUuid) onUuid(res.data.srbUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/receipt-billing/${newId}`), 400);
      }
    } catch (err) { toast.error(err?.message || "Failed to save"); }
  };

  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT_BILLING.SUBMIT}${billingId}`, method: "POST" });
      toast.success("Billing submitted for approval");
      setIsSubmitted(true);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) { toast.error(err?.message || "Failed to submit"); }
  };

  const handleEdit = () => {
    if (isEditing) { reset(); setIsEditing(false); }
    else setIsEditing(true);
  };

  const invoiceNo     = watch("invoiceNo")     || "";
  const invoiceDate   = watch("invoiceDate")   || "";
  const saleOrderDate = watch("saleOrderDate") || "";
  const certBillNo      = watch("certifiedBillNo")   || "";
  const certBillDate    = watch("certifiedBillDate") || "";

  // ── Render ─────────────────────────────────────────────────────
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

        {/* ── LEFT PANEL ─────────────────────────────────────────── */}
        <div className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          <PMSection title="Invoice / Bill:">
            <PMFormRow label="ERP Doc No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={srbNo || "[Auto]"} disabled readOnly />
            </PMFormRow>

            <PMFormRow label="Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="srbDate" control={control} render={({ field }) => (
                <PMDateInput
                  value={field.value || ""}
                  onChange={field.onChange}
                  disabled={disabled}
                  hasError={!!errors.srbDate}
                />
              )} />
            </PMFormRow>

            {/* Invoice picker field */}
            <PMFormRow label="Invoice No" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex items-center gap-1 w-full">
                <div className="flex-1 min-w-0">
                  <PMInput
                    value={invoiceNo || ""}
                    disabled
                    readOnly
                    placeholder={invoiceLookupLoading ? "Loading…" : "— select via icon —"}
                  />
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    title="Browse available invoices"
                    className="shrink-0 flex items-center justify-center w-[30px] h-[30px] rounded-sm border border-[#3b6ea5] bg-[#3b6ea5]/10 hover:bg-[#3b6ea5]/20 text-[#3b6ea5] transition"
                  >
                    {invoiceLookupLoading
                      ? <Loader2 size={14} className="animate-spin" />
                      : <FileText size={14} />
                    }
                  </button>
                )}
              </div>
            </PMFormRow>

            <PMFormRow label="Invoice Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={invoiceDate ? getfmtDisplaydate(invoiceDate) : ""} disabled readOnly placeholder="Auto-filled" />
            </PMFormRow>

            <PMFormRow label="Sale Order No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={erpDocNumber || ""} disabled readOnly placeholder="Auto-filled" />
            </PMFormRow>

            {selectedInvoiceMeta?.customerOrderNo && (
              <PMFormRow label="Customer Order No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
                <PMInput value={selectedInvoiceMeta.customerOrderNo} disabled readOnly />
              </PMFormRow>
            )}

            <PMFormRow label="Sale Order Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={saleOrderDate ? getfmtDisplaydate(saleOrderDate) : ""} disabled readOnly placeholder="Auto-filled" />
            </PMFormRow>

            <PMFormRow label="Certified Bill No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={certBillNo} disabled readOnly placeholder="Auto-filled" />
            </PMFormRow>

            <PMFormRow label="Certified Bill Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={certBillDate ? getfmtDisplaydate(certBillDate) : ""} disabled readOnly placeholder="Auto-filled" />
            </PMFormRow>
          </PMSection>

          <PMSection title="Address:">
            <PMFormRow label="Bill To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="billToAddress" control={control} render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled}
                  placeholder="Billing address" rows={2} maxRows={5} />
              )} />
            </PMFormRow>
            <PMFormRow label="Ship To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="shipToAddress" control={control} render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled}
                  placeholder="Shipping address" rows={2} maxRows={5} />
              )} />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          <AccountingJournalTable
            debtorName={debtorName || "—"}
            entries={journalEntries}
            totalDr={totalDr}
            totalCr={totalDr}
            disabled={disabled}
            creditorMode={true}
            emptyText="Select an invoice to generate accounting entries"
          />

          <ReceiptBillingBreakdownTable
            invoiceNo={invoiceNo}
            saleOrderNo={erpDocNumber || ""}
            certBillNo={certBillNo}
            itemFields={itemFields}
            gstFields={gstFields}
            watchedItems={watchedItems}
            watchedGst={watchedGst}
            register={register}
            disabled={disabled}
            loading={invoiceLookupLoading}
          />

          <AccountSummary
            basicTotal={basicTotal}
            gstTotal={gstTotal}
            totalInvoice={totalInvoice}
            register={register}
            watch={watch}
            disabled={disabled}
            wordsLabel="Amount (In Word)"
          />

          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton
                  onClick={() => handleSubmit(onSave)()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                />
              )}
              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                loadingText="Submitting…"
                confirmationTitle="Submit Sale Receipt Billing?"
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
                  moduleCode="SALE_RECEIPT_BILLING"
                  recordId={Number(billingId)}
                  onDeleted={() => router.back()}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Invoice Picker Modal ────────────────────────────────── */}
      <InvoicePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerSelect}
        projectCode={projectCode}
        currentInvoiceNo={invoiceNo}
      />
    </div>
  );
}
