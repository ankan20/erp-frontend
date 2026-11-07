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

// ── Schema ────────────────────────────────────────────────────────────────────

const pvItemSchema = z.object({
  pvItemId:      z.number().nullable().optional(),
  pbItemId:      z.number().nullable().optional(),
  slNo:          z.number().default(1),
  ccCode:        z.string().default(""),
  ccName:        z.string().default(""),
  bookedAmount:  z.coerce.number().default(0),
  paidAmount:    z.coerce.number().default(0),
  balanceAmount: z.coerce.number().default(0),
  currentAmount: z.coerce.number().min(0).default(0),
});

const pvGstLineSchema = z.object({
  gstType:       z.string().default(""),
  ccCode:        z.string().default(""),
  ccName:        z.string().default(""),
  percent:       z.coerce.number().default(0),
  bookedAmount:  z.coerce.number().default(0),
  paidAmount:    z.coerce.number().default(0),
  balanceAmount: z.coerce.number().default(0),
  currentAmount: z.coerce.number().min(0).default(0),
  isSelected:    z.boolean().default(false),
});

const schema = z.object({
  paymentDate:    zodDate(z, "paymentDate", true),
  purchaseBillId: z.coerce.number().nullable().optional(),
  vendorId:       z.coerce.number().nullable().optional(),
  paymentMode:    z.enum(["Cash", "Bank"]).default("Bank"),
  cashAcId:       z.coerce.number().nullable().optional().default(null),
  bankAcId:       z.coerce.number().nullable().optional().default(null),
  utrVoucherNo:   z.string().optional().default(""),
  paymentRemarks: z.string().optional().default(""),
  discount:       z.coerce.number().min(0).default(0),
  roundOff:       z.coerce.number().default(0),
  items:          z.array(pvItemSchema).default([]),
  gstLines:       z.array(pvGstLineSchema).default([]),
});

// ── Purchase Bill Picker Modal ─────────────────────────────────────────────────

function PurchaseBillPickerModal({ open, onClose, onConfirm, projectCode, vendorId, currentBillId }) {
  const [bills,       setBills]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [selectedId,  setSelectedId]  = useState(null);
  const [search,      setSearch]      = useState("");

  useEffect(() => {
    if (!open || !projectCode) return;
    setLoading(true);
    const url = `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.APPROVED_PURCHASE_BILLS}?projectCode=${projectCode}${vendorId ? `&vendorId=${vendorId}` : ""}`;
    apiRequest({ url, method: "GET" })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setBills(list);
        if (currentBillId) {
          const match = list.find((b) => b.id === currentBillId);
          if (match) setSelectedId(match.id);
        }
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
        (b.vendorName      || "").toLowerCase().includes(search.toLowerCase())
      )
    : bills;

  const handleConfirm = () => {
    const bill = bills.find((b) => b.id === selectedId);
    if (!bill) { toast.error("Select a purchase bill first"); return; }
    if (bill.isLocked) { toast.error("This bill already has an active payment in progress"); return; }
    onConfirm(bill);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-3xl mx-3 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[#f0f4fa]">
          <span className="text-[13px] font-semibold text-[#3b6ea5]">Select Purchase Bill</span>
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
              placeholder="Search by bill no, order no, vendor bill…"
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
              <thead className="sticky top-0 bg-[#eef4fb]">
                <tr>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-left font-semibold w-[32px]"></th>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-left font-semibold w-[110px]">Purchase Bill No</th>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-left font-semibold w-[90px]">Order No</th>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-left font-semibold w-[100px]">Vendor Bill No</th>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-left font-semibold w-[85px]">BVS Date</th>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-right font-semibold w-[85px]">Booked</th>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-right font-semibold w-[85px]">In Progress</th>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-right font-semibold w-[85px]">Balance</th>
                  <th className="border border-[#c0cfe0] px-2 py-1.5 text-center font-semibold w-[80px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const sel        = selectedId === b.id;
                  const locked     = !!b.isLocked;
                  const booked     = Number(b.bookedAmount ?? b.totalInvoiceAmount ?? 0);
                  const inProgress = Number(b.inProgressAmount ?? 0);
                  const balance    = Number(b.balanceAmount ?? booked ?? 0);
                  const fullyPaid  = !locked && balance <= 0 && booked > 0;
                  const pStatus    = b.paymentStatus || null;
                  const disabled = locked || fullyPaid;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => !disabled && setSelectedId(b.id)}
                      className={`transition-colors ${
                        disabled
                          ? "opacity-50 cursor-not-allowed bg-gray-50"
                          : sel
                          ? "bg-[#dbeafe] cursor-pointer"
                          : i % 2 === 0
                          ? "bg-white hover:bg-[#f0f7ff] cursor-pointer"
                          : "bg-[#f8fafc] hover:bg-[#f0f7ff] cursor-pointer"
                      }`}
                    >
                      <td className="border border-[#dde] px-2 py-1 text-center">
                        <input type="radio" readOnly checked={sel} disabled={disabled} className="accent-[#3b6ea5]" />
                      </td>
                      <td className="border border-[#dde] px-2 py-1 font-semibold text-[#1c3a5e]">{b.purchaseBillNo || "—"}</td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-700">{b.orderNo || "—"}</td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-600">{b.vendorBillNo || "—"}</td>
                      <td className="border border-[#dde] px-2 py-1 text-gray-600">
                        {(b.processingDate || b.bvsDate) ? getfmtDisplaydate(b.processingDate || b.bvsDate) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-right text-gray-700">
                        {booked > 0 ? formatAmount(booked) : "—"}
                      </td>
                      <td className="border border-[#dde] px-2 py-1 text-right text-orange-600 font-medium">
                        {inProgress > 0 ? formatAmount(inProgress) : "—"}
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
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-[#f8fafc]">
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
            disabled={!selectedId}
            className="px-4 py-1.5 text-[12px] bg-[#3b6ea5] text-white rounded-sm hover:bg-[#2f5a8e] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Confirm Selection
          </button>
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
  const [itemsLoading,       setItemsLoading]       = useState(false);
  const [bankCashOpts,       setBankCashOpts]       = useState([]);
  const [vendorList,         setVendorList]         = useState([]);

  // Bill snapshot fields (read-only display)
  const [purchaseBillNo, setPurchaseBillNo] = useState("");
  const [bvsDate,        setBvsDate]        = useState("");
  const [vendorBillNo,   setVendorBillNo]   = useState("");
  const [vendorBillDate, setVendorBillDate] = useState("");
  const [orderNo,        setOrderNo]        = useState("");

  const skipClearOnVendorChange = useRef(false);

  const {
    register, control, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: {
    paymentDate:    new Date().toISOString().split("T")[0],
    purchaseBillId: null,
    vendorId:       null,
    paymentMode:    "Bank",
    cashAcId:       null,
    bankAcId:       null,
    utrVoucherNo:   "",
    paymentRemarks: "",
    discount:       0,
    roundOff:       0,
    items:          [],
    gstLines:       [],
  }});

  const { fields: itemFields, replace: replaceItems }       = useFieldArray({ control, name: "items" });
  const { fields: gstFields,  replace: replaceGst }         = useFieldArray({ control, name: "gstLines" });

  const disabled    = isViewMode || !isEditing || isSubmitting || isSubmitted;
  const paymentMode = watch("paymentMode");
  const watchedItems    = watch("items")    || [];
  const watchedGst      = watch("gstLines") || [];
  const purchaseBillId  = watch("purchaseBillId");
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
    // Load creditor list
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

  // ── Load items when bill is selected (create mode) ─────────────────
  const loadBillItems = useCallback(async (billId) => {
    if (!billId || mode !== "create") return;
    setItemsLoading(true);
    try {
      const res = await apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.PURCHASE_BILL_ITEMS}${billId}`, method: "GET" });
      const d = res.data || {};
      setBvsDate(d.bvsDate || "");
      setVendorBillNo(d.vendorBillNo || "");
      setVendorBillDate(d.vendorBillDate || "");
      setOrderNo(d.orderNo || "");
      setPurchaseBillNo(d.purchaseBillNo || "");
      if (d.vendorName) setVendorName(d.vendorName);
      if (d.vendorId) {
        skipClearOnVendorChange.current = true;
        setValue("vendorId", d.vendorId, { shouldDirty: false });
      }
      replaceItems((d.items || []).map((it, i) => ({
        pvItemId: null, pbItemId: it.pbItemId ?? null,
        slNo: i + 1, ccCode: it.ccCode || "", ccName: it.ccName || "",
        bookedAmount: Number(it.bookedAmount || 0), paidAmount: Number(it.paidAmount || 0),
        balanceAmount: Number(it.balanceAmount || 0), currentAmount: 0,
      })));
      replaceGst((d.gstLines || []).map((l) => ({
        gstType: l.gstType || "", ccCode: l.ccCode || "", ccName: l.ccName || "",
        percent: Number(l.percent || 0),
        bookedAmount: Number(l.bookedAmount || 0), paidAmount: Number(l.paidAmount || 0),
        balanceAmount: Number(l.balanceAmount || 0), currentAmount: 0,
        isSelected: !!l.isSelected,
      })));
      setAllowSubmit(false);
    } catch {
      toast.error("Failed to load bill items");
    } finally {
      setItemsLoading(false);
    }
  }, [mode, setValue, replaceItems, replaceGst]);

  useEffect(() => { loadBillItems(purchaseBillId); }, [purchaseBillId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch Detail (edit/view) ─────────────────────────────────────
  useEffect(() => {
    if (!paymentId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.GET_BY_ID}${paymentId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        setBvsDate(d.bvsDate || "");
        setVendorBillNo(d.vendorBillNo || "");
        setVendorBillDate(d.vendorBillDate || "");
        setOrderNo(d.orderNo || "");
        setPurchaseBillNo(d.purchaseBillNo || "");
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

        reset({
          paymentDate:    d.paymentDate    || "",
          purchaseBillId: d.purchaseBillId || null,
          vendorId:       d.vendorId       || null,
          paymentMode:    d.paymentMode    || "Bank",
          cashAcId:       d.cashAcId       || null,
          bankAcId:       d.bankAcId       || null,
          utrVoucherNo:   d.utrVoucherNo   || "",
          paymentRemarks: d.paymentRemarks || "",
          discount:       Number(d.discount  || 0),
          roundOff:       Number(d.roundOff  || 0),
          items: (d.items || []).map((it, i) => ({
            pvItemId: it.id ?? null, pbItemId: it.pbItemId ?? null,
            slNo: i + 1, ccCode: it.ccCode || "", ccName: it.ccName || "",
            bookedAmount: Number(it.bookedAmount || 0), paidAmount: Number(it.paidAmount || 0),
            balanceAmount: Number(it.balanceAmount || 0), currentAmount: Number(it.currentAmount || 0),
          })),
          gstLines: (d.gstLines || []).map((l) => ({
            gstType: l.gstType || "", ccCode: l.ccCode || "", ccName: l.ccName || "",
            percent: Number(l.percent || 0),
            bookedAmount: Number(l.bookedAmount || 0), paidAmount: Number(l.paidAmount || 0),
            balanceAmount: Number(l.balanceAmount || 0), currentAmount: Number(l.currentAmount || 0),
            isSelected: !!l.isSelected,
          })),
        });

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
  }, [paymentId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Journal entry (CR = bank/cash, DR = vendor) ───────────────────
  const journalEntries = useMemo(() => {
    if (!paymentAcCode) return [];
    return [{ ccCode: paymentAcCode, ccName: paymentAcName || paymentAcCode, amount: totalInvoice, isSelected: true, toggleable: false }];
  }, [paymentAcName, paymentAcCode, totalInvoice]);

  // ── Bill picker confirm ───────────────────────────────────────────
  const handleBillConfirm = useCallback((bill) => {
    setValue("purchaseBillId", bill.id, { shouldDirty: true });
    setPickerOpen(false);
  }, [setValue]);

  // Clear bill/items when vendor changes (unless auto-set from bill load)
  const prevVendorId = useRef(vendorId);
  useEffect(() => {
    if (skipClearOnVendorChange.current) {
      skipClearOnVendorChange.current = false;
      prevVendorId.current = vendorId;
      return;
    }
    if (prevVendorId.current !== vendorId && mode === "create") {
      setValue("purchaseBillId", null, { shouldDirty: true });
      replaceItems([]);
      replaceGst([]);
      setBvsDate(""); setVendorBillNo(""); setVendorBillDate(""); setOrderNo(""); setPurchaseBillNo("");
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

    const payload = {
      projectCode,
      paymentDate:    v.paymentDate,
      purchaseBillId: v.purchaseBillId || null,
      vendorId:       v.vendorId       || null,
      paymentMode:    v.paymentMode,
      cashAcId:       v.paymentMode === "Cash" ? (v.cashAcId || null) : null,
      bankAcId:       v.paymentMode === "Bank" ? (v.bankAcId || null) : null,
      utrVoucherNo:   v.utrVoucherNo  || "",
      paymentRemarks: v.paymentRemarks || "",
      discount:       Number(v.discount  || 0),
      roundOff:       Number(v.roundOff  || 0),
      items: v.items.map((it) => ({
        ...(it.pbItemId  ? { pbItemId:  it.pbItemId  } : {}),
        slNo: it.slNo, ccCode: it.ccCode, ccName: it.ccName,
        bookedAmount: Number(it.bookedAmount || 0), currentAmount: Number(it.currentAmount || 0),
      })),
      gstLines: v.gstLines.map((l) => ({
        gstType: l.gstType, ccCode: l.ccCode, ccName: l.ccName,
        bookedAmount: Number(l.bookedAmount || 0), currentAmount: Number(l.currentAmount || 0),
        isSelected: !!l.isSelected,
      })),
    };

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
          </PMSection>

          <PMSection title="BILL REFERENCE:">
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

            <PMFormRow label="Purchase Bill" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <div className="flex items-center gap-1.5 flex-1">
                <PMInput
                  value={purchaseBillNo || (purchaseBillId ? `Bill #${purchaseBillId}` : "")}
                  disabled
                  readOnly
                  placeholder="Click icon to select a bill"
                  className="flex-1"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    title="Select Purchase Bill"
                    className="p-1.5 rounded border border-[#3b6ea5] text-[#3b6ea5] hover:bg-[#3b6ea5] hover:text-white transition shrink-0"
                  >
                    <FileText size={14} />
                  </button>
                )}
              </div>
            </PMFormRow>

            <PMFormRow label="BVS Date" labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <PMInput value={bvsDate ? getfmtDisplaydate(bvsDate) : ""} disabled readOnly placeholder="[From Purchase Bill]" className="max-w-[200px]" />
            </PMFormRow>

            <PMFormRow label="Order No" labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <PMInput value={orderNo} disabled readOnly placeholder="[From Purchase Bill]" />
            </PMFormRow>

            <PMFormRow label="Vendor Bill No" labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <PMInput value={vendorBillNo} disabled readOnly placeholder="[From Purchase Bill]" />
            </PMFormRow>

            <PMFormRow label="Vendor Bill Date" labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <PMInput value={vendorBillDate ? getfmtDisplaydate(vendorBillDate) : ""} disabled readOnly placeholder="[From Purchase Bill]" className="max-w-[200px]" />
            </PMFormRow>
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
              <PMFormRow label="Cash A/c" labelWidth="sm:w-[160px] sm:min-w-[160px]">
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
                  />
                )} />
              </PMFormRow>
            )}

            {paymentMode === "Bank" && (
              <PMFormRow label="Bank A/c" labelWidth="sm:w-[160px] sm:min-w-[160px]">
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
                  />
                )} />
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

          {/* Bill-wise Payment Breakdown */}
          <PaymentBreakdownTable
            purchaseBillNo={purchaseBillNo}
            orderNo={orderNo}
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
        currentBillId={purchaseBillId}
      />
    </div>
  );
}
