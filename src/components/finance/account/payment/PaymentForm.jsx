"use client";

import { useCallback, useEffect, useState } from "react";
import { Controller, useFieldArray }         from "react-hook-form";
import { useFormWithToast as useForm }       from "@/hooks/useFormWithToast";
import { z }              from "zod";
import { zodResolver }    from "@hookform/resolvers/zod";
import { toast }          from "sonner";
import { useRouter }      from "next/navigation";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import AmountInput     from "@/components/common/AmountInput";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";

import { ACC }            from "@/components/finance/account/common/accountTheme";
import { amountToWordsIN } from "@/lib/amountToWords";
import { getInputClass }   from "@/lib/formStyles";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const PAYMENT_MODES = ["Bank", "Cash"];

const fmt = (val) => {
  const n = Number(val);
  return isNaN(n) ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtRoundOff = (val) => {
  const n = Number(val);
  if (isNaN(n) || n === 0) return "0.00";
  const abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n > 0 ? `+${abs}` : `-${abs}`;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const pvItemSchema = z.object({
  pvItemId:      z.number().nullable().optional(),
  pbItemId:      z.number().nullable().optional(),
  ccCodeId:      z.number().nullable().optional(),
  slNo:          z.number().default(1),
  ccCode:        z.string().default(""),
  ccName:        z.string().default(""),
  bookedAmount:  z.number().default(0),
  paidAmount:    z.number().default(0),
  balanceAmount: z.number().default(0),
  currentAmount: z.coerce.number().min(0).default(0),
}).refine(
  (row) => Number(row.currentAmount) <= Number(row.balanceAmount),
  { message: "Exceeds balance", path: ["currentAmount"] },
);

const pvGstLineSchema = z.object({
  gstType:       z.string().default(""),
  ccCode:        z.string().default(""),
  ccName:        z.string().default(""),
  bookedAmount:  z.number().default(0),
  paidAmount:    z.number().default(0),
  balanceAmount: z.number().default(0),
  currentAmount: z.coerce.number().min(0).default(0),
  isSelected:    z.boolean().default(false),
}).refine(
  (row) => !row.isSelected || Number(row.currentAmount) <= Number(row.balanceAmount),
  { message: "Exceeds balance", path: ["currentAmount"] },
);

const schema = z.object({
  paymentDate:       z.string().min(1, "Payment Date is required"),
  purchaseBillId:    z.coerce.number().nullable().optional(),
  purchaseVoucherId: z.coerce.number().nullable().optional(),
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
});

const DEFAULT_VALUES = {
  paymentDate:       new Date().toISOString().split("T")[0],
  purchaseBillId:    null,
  purchaseVoucherId: null,
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
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentForm({
  mode        = "create",
  paymentId,
  paymentType = "bill",   // "bill" | "voucher"
  onAfterSubmit,
  onUuid,
}) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";
  const isBill      = paymentType === "bill";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [vendorList,      setVendorList]      = useState([]);
  const [bankCashOpts,    setBankCashOpts]    = useState([]);
  const [approvedList,    setApprovedList]    = useState([]);   // approved PVs or bills
  const [refLoading,      setRefLoading]      = useState(false);
  const [itemsLoading,    setItemsLoading]    = useState(false);
  const [erpPaymentNo,    setErpPaymentNo]    = useState("");

  // Read-only snapshot fields from selected reference
  const [refDate,         setRefDate]         = useState("");
  const [vendorBillNo,    setVendorBillNo]    = useState("");
  const [vendorBillDate,  setVendorBillDate]  = useState("");
  const [orderNo,         setOrderNo]         = useState("");
  const [vendorName,      setVendorName]      = useState("");

  const {
    register, control, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields }   = useFieldArray({ control, name: "items" });
  const { fields: gstLineFields } = useFieldArray({ control, name: "gstLines" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Computed totals ──────────────────────────────────────────────────────────
  const watchedItems    = watch("items")    || [];
  const watchedGst      = watch("gstLines") || [];
  const watchDiscount   = Number(watch("discount")  || 0);
  const watchRoundOff   = Number(watch("roundOff")  || 0);
  const paymentMode     = watch("paymentMode");
  const selectedRefId   = isBill ? watch("purchaseBillId") : watch("purchaseVoucherId");

  const basicTotal  = watchedItems.reduce((s, it) => s + Number(it?.currentAmount || 0), 0);
  const gstTotal    = watchedGst.reduce((s, l) => s + Number(l?.currentAmount || 0), 0);
  const rawTotal    = basicTotal + gstTotal - watchDiscount;
  const totalInvoice = rawTotal + watchRoundOff;

  // Auto-calculate round-off (same as AccountSummary/purchase pages)
  useEffect(() => {
    const computed = parseFloat((Math.round(rawTotal) - rawTotal).toFixed(2));
    if (computed !== watchRoundOff) setValue("roundOff", computed, { shouldDirty: false });
  }, [rawTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const bankOpts = bankCashOpts
    .filter((a) => a.type === "BANK")
    .map((a) => ({
      ...a,
      displayLabel: [a.bankName, a.bankAcNumber].filter(Boolean).join(" — ") || a.bankHolderName || a.bankCode,
    }));
  const cashOpts = bankCashOpts
    .filter((a) => a.type === "CASH")
    .map((a) => ({ ...a, displayLabel: [a.bankHolderName, a.bankCode].filter(Boolean).join(" — ") }));

  // ── Load initial data ────────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => setVendorList((res.data || []).sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || ""))))
      .catch(() => {});

    if (projectCode) {
      apiRequest({ url: `${API_ENDPOINTS.MASTER.BANK_CASH.LIST}?projectCode=${projectCode}`, method: "GET" })
        .then((res) => setBankCashOpts(res.data || []))
        .catch(() => {});
    }
  }, [projectCode]);

  // ── Load approved reference list ─────────────────────────────────────────────
  const loadApprovedList = useCallback(
    async (vendorId) => {
      if (!projectCode) return;
      setRefLoading(true);
      try {
        const endpoint = isBill
          ? `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.APPROVED_PURCHASE_BILLS}?projectCode=${projectCode}${vendorId ? `&vendorId=${vendorId}` : ""}`
          : `${API_ENDPOINTS.FINANCE.PAYMENT_VOUCHER.APPROVED_PURCHASE_VOUCHERS}?projectCode=${projectCode}`;
        const res = await apiRequest({ url: endpoint, method: "GET" });
        setApprovedList(res.data || []);
      } catch {
        toast.error("Failed to load approved records");
      } finally {
        setRefLoading(false);
      }
    },
    [projectCode, isBill],
  );

  useEffect(() => { loadApprovedList(null); }, [loadApprovedList]);

  // For bill: reload when vendor changes
  const watchVendorId = watch("vendorId");
  useEffect(() => {
    if (!isBill) return;
    loadApprovedList(watchVendorId);
  }, [watchVendorId, isBill, loadApprovedList]);

  // ── Load items when reference is selected ────────────────────────────────────
  const loadRefItems = useCallback(
    async (refId) => {
      if (!refId || mode !== "create") return;
      setItemsLoading(true);
      try {
        const endpoint = isBill
          ? `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.PURCHASE_BILL_ITEMS}${refId}`
          : `${API_ENDPOINTS.FINANCE.PAYMENT_VOUCHER.PURCHASE_VOUCHER_ITEMS}${refId}`;
        const res = await apiRequest({ url: endpoint, method: "GET" });
        const d = res.data || {};

        // Auto-populate snapshot fields
        if (isBill) {
          setRefDate(d.bvsDate || "");
          setVendorBillNo(d.vendorBillNo || "");
          setVendorBillDate(d.vendorBillDate || "");
          setOrderNo(d.orderNo || "");
          setVendorName(d.vendorName || "");
          if (d.vendorId) setValue("vendorId", d.vendorId, { shouldDirty: false });
        } else {
          setRefDate(d.purchaseVoucherDate || "");
          setVendorName(d.vendorName || "");
          if (d.vendorId) setValue("vendorId", d.vendorId, { shouldDirty: false });
        }

        const mappedItems = (d.items || []).map((it, i) => ({
          pvItemId:      it.pvItemId      ?? null,
          pbItemId:      it.pbItemId      ?? null,
          ccCodeId:      it.ccCodeId      ?? null,
          slNo:          i + 1,
          ccCode:        it.ccCode        || "",
          ccName:        it.ccName        || "",
          bookedAmount:  Number(it.bookedAmount  || 0),
          paidAmount:    Number(it.paidAmount    || 0),
          balanceAmount: Number(it.balanceAmount || 0),
          currentAmount: 0,
        }));

        const mappedGst = (d.gstLines || []).map((l) => ({
          gstType:       l.gstType       || "",
          ccCode:        l.ccCode        || "",
          ccName:        l.ccName        || "",
          bookedAmount:  Number(l.bookedAmount  || 0),
          paidAmount:    Number(l.paidAmount    || 0),
          balanceAmount: Number(l.balanceAmount || 0),
          currentAmount: 0,
          isSelected:    !!l.isSelected,
        }));

        setValue("items",    mappedItems, { shouldDirty: true });
        setValue("gstLines", mappedGst,   { shouldDirty: true });
        setAllowSubmit(false);
      } catch {
        toast.error("Failed to load items");
      } finally {
        setItemsLoading(false);
      }
    },
    [mode, isBill, setValue],
  );

  useEffect(() => { loadRefItems(selectedRefId); }, [selectedRefId, loadRefItems]);

  // ── Fetch Detail (edit/view) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!paymentId || mode === "create") return;

    const EP = isBill ? API_ENDPOINTS.FINANCE.BILL_PAYMENT : API_ENDPOINTS.FINANCE.PAYMENT_VOUCHER;

    apiRequest({ url: `${EP.GET_BY_ID}${paymentId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};

        if (isBill) {
          setRefDate(d.bvsDate           || "");
          setVendorBillNo(d.vendorBillNo || "");
          setVendorBillDate(d.vendorBillDate || "");
          setOrderNo(d.orderNo           || "");
        } else {
          setRefDate(d.purchaseVoucherDate || "");
        }
        setVendorName(d.vendorName || "");

        reset({
          paymentDate:       d.paymentDate    || "",
          purchaseBillId:    d.purchaseBillId    || null,
          purchaseVoucherId: d.purchaseVoucherId || null,
          vendorId:          d.vendorId          || null,
          paymentMode:       d.paymentMode       || "Bank",
          cashAcId:          d.cashAcId          || null,
          bankAcId:          d.bankAcId          || null,
          utrVoucherNo:      d.utrVoucherNo      || "",
          paymentRemarks:    d.paymentRemarks     || "",
          discount:          Number(d.discount  || 0),
          roundOff:          Number(d.roundOff  || 0),
          items: (d.items || []).map((it, i) => ({
            pvItemId:      it.pvItemId      ?? null,
            pbItemId:      it.pbItemId      ?? null,
            ccCodeId:      it.ccCodeId      ?? null,
            slNo:          i + 1,
            ccCode:        it.ccCode        || "",
            ccName:        it.ccName        || "",
            bookedAmount:  Number(it.bookedAmount  || 0),
            paidAmount:    Number(it.paidAmount    || 0),
            balanceAmount: Number(it.balanceAmount || 0),
            currentAmount: Number(it.currentAmount || 0),
          })),
          gstLines: (d.gstLines || []).map((l) => ({
            gstType:       l.gstType       || "",
            ccCode:        l.ccCode        || "",
            ccName:        l.ccName        || "",
            bookedAmount:  Number(l.bookedAmount  || 0),
            paidAmount:    Number(l.paidAmount    || 0),
            balanceAmount: Number(l.balanceAmount || 0),
            currentAmount: Number(l.currentAmount || 0),
            isSelected:    !!l.isSelected,
          })),
        });

        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);

        const no = isBill ? d.receiptNo : d.paymentVouchNo;
        if (no) setErpPaymentNo(no);

        const uuid = isBill ? d.receiptUuid : d.paymentVouchUuid;
        if (uuid && onUuid) onUuid(uuid);
      })
      .catch(() => toast.error("Failed to load payment details"));
  }, [paymentId, mode, isBill]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Draft ───────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    const overflowItem = v.items.some((it) => Number(it.currentAmount) > Number(it.balanceAmount));
    const overflowGst  = v.gstLines.some((l) => l.isSelected && Number(l.currentAmount) > Number(l.balanceAmount));
    if (overflowItem || overflowGst) {
      toast.error("Current payment amount cannot exceed the balance amount");
      return;
    }

    const EP = isBill ? API_ENDPOINTS.FINANCE.BILL_PAYMENT : API_ENDPOINTS.FINANCE.PAYMENT_VOUCHER;
    const url    = mode === "create" ? EP.CREATE : `${EP.EDIT}${paymentId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      paymentDate:       v.paymentDate,
      vendorId:          v.vendorId          || null,
      paymentMode:       v.paymentMode,
      cashAcId:          v.paymentMode === "Cash" ? (v.cashAcId || null) : null,
      bankAcId:          v.paymentMode === "Bank" ? (v.bankAcId || null) : null,
      utrVoucherNo:      v.utrVoucherNo   || "",
      paymentRemarks:    v.paymentRemarks  || "",
      discount:          Number(v.discount  || 0),
      roundOff:          Number(v.roundOff  || 0),
      items:    v.items.map((it) => ({
        ...(isBill ? { pbItemId: it.pbItemId } : { pvItemId: it.pvItemId }),
        ...(it.ccCodeId ? { ccCodeId: it.ccCodeId } : {}),
        slNo:          it.slNo,
        ccCode:        it.ccCode,
        ccName:        it.ccName,
        bookedAmount:  Number(it.bookedAmount  || 0),
        currentAmount: Number(it.currentAmount || 0),
      })),
      gstLines: v.gstLines.map((l) => ({
        gstType:       l.gstType,
        ccCode:        l.ccCode,
        ccName:        l.ccName,
        bookedAmount:  Number(l.bookedAmount  || 0),
        currentAmount: Number(l.currentAmount || 0),
        isSelected:    !!l.isSelected,
      })),
    };

    if (isBill) payload.purchaseBillId    = v.purchaseBillId    || null;
    else        payload.purchaseVoucherId = v.purchaseVoucherId || null;

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Payment saved as draft" : "Payment updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();

      const uuid = isBill ? res?.data?.receiptUuid : res?.data?.paymentVouchUuid;
      if (uuid && onUuid) onUuid(uuid);

      if (mode === "create") {
        const newId = res.data?.id;
        if (newId)
          setTimeout(() => router.push(`/finance-management/account/payment/${newId}?type=${paymentType}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  // ── Submit for Approval ───────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    const EP = isBill ? API_ENDPOINTS.FINANCE.BILL_PAYMENT : API_ENDPOINTS.FINANCE.PAYMENT_VOUCHER;
    try {
      await apiRequest({ url: `${EP.SUBMIT}${paymentId}`, method: "POST" });
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

  // ── Reference label helpers ──────────────────────────────────────────────────
  const refLabel    = isBill ? "BVS Number"      : "JV Number";
  const refPlaceholder = isBill ? "Filter List from Bill Entry" : "Filter List from JV Entry";
  const refLabelKey = isBill ? "purchaseBillNo" : "voucherNo";
  const refValueKey = "id";
  const refFieldName = isBill ? "purchaseBillId" : "purchaseVoucherId";
  const refDateLabel = isBill ? "BVS Date" : "JV Date";

  // ─── Render ──────────────────────────────────────────────────────────────────
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
        {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          {/* Payment Header */}
          <PMSection title="Payment Details:">
            <PMFormRow label="Payment Vouch. No" labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <input value={erpPaymentNo || "[Auto]"} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>

            <PMFormRow label="Payment Date" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <PMDateInput {...register("paymentDate")} disabled={disabled} hasError={errors.paymentDate} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          {/* Reference section — differs by type */}
          {isBill ? (
            <PMSection title="Bill Reference:">
              <PMFormRow label="Party Name" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <Controller name="vendorId" control={control} render={({ field }) => (
                  <SearchableSelect
                    options={vendorList}
                    value={field.value ? String(field.value) : ""}
                    disabled={disabled}
                    onChange={(v) => {
                      field.onChange(v ? Number(v) : null);
                      setValue("purchaseBillId", null, { shouldDirty: true });
                      setValue("items",    [], { shouldDirty: true });
                      setValue("gstLines", [], { shouldDirty: true });
                      setRefDate(""); setVendorBillNo(""); setVendorBillDate(""); setOrderNo("");
                    }}
                    placeholder="Select from Vendor List"
                    labelKey="ledgerName"
                    valueKey="ledgerId"
                    searchKeys={["ledgerName"]}
                  />
                )} />
              </PMFormRow>

              <PMFormRow label="Order Number" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <input value={orderNo} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
                  placeholder="[Auto from BVS]" />
              </PMFormRow>

              <PMFormRow label="BVS Number" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <Controller name="purchaseBillId" control={control} render={({ field }) => (
                  <SearchableSelect
                    options={approvedList}
                    value={field.value ? String(field.value) : ""}
                    disabled={disabled || refLoading}
                    onChange={(v) => {
                      field.onChange(v ? Number(v) : null);
                      setValue("items",    [], { shouldDirty: true });
                      setValue("gstLines", [], { shouldDirty: true });
                    }}
                    placeholder={refLoading ? "Loading…" : refPlaceholder}
                    labelKey="purchaseBillNo"
                    valueKey="id"
                    searchKeys={["purchaseBillNo"]}
                  />
                )} />
              </PMFormRow>

              <PMFormRow label="BVS Date" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <input value={refDate} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none max-w-[200px]"
                  placeholder="[From Data Base]" />
              </PMFormRow>

              <PMFormRow label="Vendor Bill No" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <input value={vendorBillNo} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
                  placeholder="[From Data Base]" />
              </PMFormRow>

              <PMFormRow label="Vendor Bill Date" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <input value={vendorBillDate} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none max-w-[200px]"
                  placeholder="[From Data Base]" />
              </PMFormRow>
            </PMSection>
          ) : (
            <PMSection title="Voucher Reference:">
              <PMFormRow label="JV Number" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <Controller name="purchaseVoucherId" control={control} render={({ field }) => (
                  <SearchableSelect
                    options={approvedList}
                    value={field.value ? String(field.value) : ""}
                    disabled={disabled || refLoading}
                    onChange={(v) => {
                      field.onChange(v ? Number(v) : null);
                      setValue("items",    [], { shouldDirty: true });
                      setValue("gstLines", [], { shouldDirty: true });
                    }}
                    placeholder={refLoading ? "Loading…" : refPlaceholder}
                    labelKey="voucherNo"
                    valueKey="id"
                    searchKeys={["voucherNo"]}
                  />
                )} />
              </PMFormRow>

              <PMFormRow label="JV Date" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <input value={refDate} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none max-w-[200px]"
                  placeholder="[From Data Base]" />
              </PMFormRow>

              <PMFormRow label="Payment To" labelWidth="sm:w-[160px] sm:min-w-[160px]">
                <input value={vendorName} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
                  placeholder="[Auto from JV]" />
              </PMFormRow>
            </PMSection>
          )}

          {/* Payment Mode */}
          <PMSection title="Payment Mode:">
            <PMFormRow label="Payment Mode" required={!disabled} labelWidth="sm:w-[160px] sm:min-w-[160px]">
              <Controller name="paymentMode" control={control} render={({ field }) => (
                <SearchableSelect
                  options={PAYMENT_MODES.map((m) => ({ label: m, value: m }))}
                  value={field.value || ""}
                  disabled={disabled}
                  onChange={(v) => {
                    field.onChange(v);
                    setValue("cashAcId", null);
                    setValue("bankAcId", null);
                  }}
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
                    placeholder="Select List"
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
              <input
                {...register("utrVoucherNo")}
                disabled={disabled}
                placeholder="Enter UTR / Voucher No."
                className={`w-full h-[30px] text-[13px] rounded-sm border px-2 outline-none transition ${
                  disabled ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500" : "border-gray-300 bg-white focus:border-[#3b6ea5]"
                }`}
              />
            </PMFormRow>
          </PMSection>

          {/* Remarks */}
          <PMSection title="Other:">
            <PMFormRow label="Payment Remarks" labelWidth="sm:w-[160px] sm:min-w-[160px]" className="sm:items-start">
              <Controller name="paymentRemarks" control={control} render={({ field }) => (
                <PMTextarea
                  value={field.value || ""}
                  onChange={field.onChange}
                  disabled={disabled}
                  placeholder="Text"
                  rows={3}
                  maxRows={6}
                  className="flex-1 w-full"
                />
              )} />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* BASIC Table */}
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <div className={`${ACC.basicHeader} px-3 py-[5px]`}>
              <span className={ACC.sectionTitle}>BASIC</span>
            </div>
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-[13px]">Loading items…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-[12px]">
                  <thead>
                    <tr className={ACC.tableHead}>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[40px]">SL no</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[80px]">CC Code</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">CC Name</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[110px]">Booked</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[100px]">Paid</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[110px]">Balance</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[120px]">Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemFields.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="border border-gray-200 px-3 py-4 text-center text-[12px] text-gray-400">
                          {isBill ? "Select a BVS Number to load items" : "Select a JV Number to load items"}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {itemFields.map((field, idx) => {
                          const item            = watchedItems[idx] || {};
                          const bal             = Number(item.balanceAmount || 0);
                          const cur             = Number(item.currentAmount || 0);
                          const exceedsBalance  = !disabled && cur > bal;
                          return (
                            <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>
                              <td className="border border-gray-200 px-2 py-[3px] text-center">{idx + 1}</td>
                              <td className="border border-gray-200 px-2 py-[3px]">{item.ccCode || "—"}</td>
                              <td className="border border-gray-200 px-2 py-[3px]">{item.ccName || "—"}</td>
                              <td className="border border-gray-200 px-2 py-[3px] text-right">{fmt(item.bookedAmount)}</td>
                              <td className="border border-gray-200 px-2 py-[3px] text-right">{item.paidAmount > 0 ? fmt(item.paidAmount) : "—"}</td>
                              <td className="border border-gray-200 px-2 py-[3px] text-right">{bal > 0 ? fmt(bal) : "—"}</td>
                              <td className="border border-gray-200 p-0.5">
                                <div className="flex flex-col">
                                  <AmountInput
                                    {...register(`items.${idx}.currentAmount`)}
                                    value={watchedItems[idx]?.currentAmount ?? ""}
                                    disabled={disabled}
                                    placeholder="0.00"
                                    title={bal > 0 ? `Max: ${fmt(bal)}` : undefined}
                                    className={`${getInputClass(false, disabled)} w-full h-[26px] text-[12px] px-1.5 text-right border-0 rounded-sm ${
                                      !disabled
                                        ? exceedsBalance
                                          ? "bg-red-50 ring-1 ring-red-400 text-red-700"
                                          : "bg-[#fffbe8]"
                                        : ""
                                    }`}
                                  />
                                  {exceedsBalance && (
                                    <span className="text-[9px] text-red-500 text-right leading-tight px-0.5">max {fmt(bal)}</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* TOTAL row */}
                        <tr className={`${ACC.tableHead} font-semibold`}>
                          <td colSpan={3} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                            {fmt(watchedItems.reduce((s, it) => s + Number(it?.bookedAmount || 0), 0))}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                            {(() => {
                              const t = watchedItems.reduce((s, it) => s + Number(it?.paidAmount || 0), 0);
                              return t > 0 ? fmt(t) : "—";
                            })()}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                            {(() => {
                              const t = watchedItems.reduce((s, it) => s + Number(it?.balanceAmount || 0), 0);
                              return t > 0 ? fmt(t) : "—";
                            })()}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] bg-[#F2B07E]">{fmt(basicTotal)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* GST Table */}
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <div className={`${ACC.gstHeader} px-3 py-[5px]`}>
              <span className={ACC.sectionTitle}>GST</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[12px]">
                <thead>
                  <tr className={ACC.tableHead}>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[56px]">Select</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[80px]">CC Code</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">CC Name</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[110px]">Booked</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[100px]">Paid</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[110px]">Balance</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[120px]">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {gstLineFields.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border border-gray-200 px-3 py-4 text-center text-[12px] text-gray-400">
                        GST lines will load with items
                      </td>
                    </tr>
                  ) : (
                    <>
                      {gstLineFields.map((field, idx) => {
                        const line            = watchedGst[idx] || {};
                        const isActive        = !!line.isSelected;
                        const bal             = Number(line.balanceAmount || 0);
                        const cur             = Number(line.currentAmount || 0);
                        const exceedsBalance  = !disabled && isActive && cur > bal;

                        const handleGstToggle = (checked) => {
                          const isIGSTRow    = idx === 0;
                          const isCGSTSGSTRow = idx === 1 || idx === 2;
                          if (isIGSTRow) {
                            setValue("gstLines.0.isSelected", checked, { shouldDirty: true });
                            if (checked) {
                              setValue("gstLines.1.isSelected", false, { shouldDirty: true });
                              setValue("gstLines.2.isSelected", false, { shouldDirty: true });
                              setValue("gstLines.1.currentAmount", 0, { shouldDirty: true });
                              setValue("gstLines.2.currentAmount", 0, { shouldDirty: true });
                            }
                          } else if (isCGSTSGSTRow) {
                            setValue("gstLines.1.isSelected", checked, { shouldDirty: true });
                            setValue("gstLines.2.isSelected", checked, { shouldDirty: true });
                            if (checked) {
                              setValue("gstLines.0.isSelected", false, { shouldDirty: true });
                              setValue("gstLines.0.currentAmount", 0, { shouldDirty: true });
                            } else {
                              setValue("gstLines.1.currentAmount", 0, { shouldDirty: true });
                              setValue("gstLines.2.currentAmount", 0, { shouldDirty: true });
                            }
                          }
                        };

                        return (
                          <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#fdf5f0]"}>
                            <td className="border border-gray-200 px-2 py-[3px] text-center">
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => !disabled && handleGstToggle(e.target.checked)}
                                disabled={disabled}
                                className="w-[15px] h-[15px] accent-[#3b6ea5] cursor-pointer disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="border border-gray-200 px-2 py-[3px]">{line.ccCode || "—"}</td>
                            <td className="border border-gray-200 px-2 py-[3px]">{line.ccName || "—"}</td>
                            <td className="border border-gray-200 px-2 py-[3px] text-right">{fmt(line.bookedAmount)}</td>
                            <td className="border border-gray-200 px-2 py-[3px] text-right">{line.paidAmount > 0 ? fmt(line.paidAmount) : "—"}</td>
                            <td className="border border-gray-200 px-2 py-[3px] text-right">{bal > 0 ? fmt(bal) : "—"}</td>
                            <td className="border border-gray-200 p-0.5">
                              {isActive ? (
                                <div className="flex flex-col">
                                  <AmountInput
                                    {...register(`gstLines.${idx}.currentAmount`)}
                                    value={watchedGst[idx]?.currentAmount ?? ""}
                                    disabled={disabled}
                                    placeholder="0.00"
                                    title={bal > 0 ? `Max: ${fmt(bal)}` : undefined}
                                    className={`${getInputClass(false, disabled)} w-full h-[26px] text-[12px] px-1.5 text-right border-0 rounded-sm ${
                                      !disabled
                                        ? exceedsBalance
                                          ? "bg-red-50 ring-1 ring-red-400 text-red-700"
                                          : "bg-[#fffbe8]"
                                        : ""
                                    }`}
                                  />
                                  {exceedsBalance && (
                                    <span className="text-[9px] text-red-500 text-right leading-tight px-0.5">max {fmt(bal)}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="block px-1.5 text-right text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* GST TOTAL row */}
                      <tr className={`${ACC.tableHead} font-semibold`}>
                        <td colSpan={3} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                          {fmt(watchedGst.reduce((s, l) => s + Number(l?.bookedAmount || 0), 0))}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                          {(() => {
                            const t = watchedGst.reduce((s, l) => s + Number(l?.paidAmount || 0), 0);
                            return t > 0 ? fmt(t) : "—";
                          })()}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                          {(() => {
                            const t = watchedGst.reduce((s, l) => s + Number(l?.balanceAmount || 0), 0);
                            return t > 0 ? fmt(t) : "—";
                          })()}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] bg-[#F2B07E]">{fmt(gstTotal)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            {[
              { label: "Basic Amount",    value: fmt(basicTotal),    bg: ACC.summaryValueBg },
              { label: "GST Amount",      value: fmt(gstTotal),      bg: ACC.summaryValueBg },
            ].map(({ label, value, bg }) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
                <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:flex-1 ${ACC.summaryLabelBg}`}>{label}</div>
                <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] text-right font-semibold sm:w-[180px] sm:shrink-0 ${bg}`}>{value}</div>
              </div>
            ))}

            {/* Discount */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
              <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:flex-1 ${ACC.summaryLabelBg}`}>Discount</div>
              <AmountInput
                {...register("discount")}
                value={watch("discount")}
                disabled={disabled}
                placeholder="0.00"
                className={`${getInputClass(false, disabled)} sm:w-[180px] sm:shrink-0 text-right text-[13px] px-3 min-h-[34px] rounded-sm`}
              />
            </div>

            {/* Round Off — auto-calculated, readonly */}
            {(() => {
              const ro    = watchRoundOff;
              const isPos = ro > 0;
              const isNeg = ro < 0;
              return (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
                  <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:flex-1 ${ACC.summaryLabelBg}`}>Round On/Off.</div>
                  <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] text-right font-semibold sm:w-[180px] sm:shrink-0 ${ACC.summaryValueBg} ${isPos ? "text-green-700" : isNeg ? "text-red-600" : ""}`}>
                    {fmtRoundOff(ro)}
                  </div>
                </div>
              );
            })()}

            {/* Total */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
              <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-bold sm:flex-1 ${ACC.summaryLabelBg}`}>Total Invoice Amount (Rs.)</div>
              <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] text-right font-bold sm:w-[180px] sm:shrink-0 ${ACC.totalValueBg}`}>{fmt(totalInvoice)}</div>
            </div>

            {/* Amount in Words */}
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-1 sm:gap-1.5">
              <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:w-[180px] sm:shrink-0 ${ACC.wordsLabelBg}`}>
                Amount (In word)
              </div>
              <div className={`flex-1 rounded-sm border border-gray-300 px-3 py-[7px] text-[12px] leading-relaxed italic ${ACC.wordsValueBg}`}>
                {totalInvoice > 0
                  ? amountToWordsIN(totalInvoice)
                  : <span className="text-gray-400 not-italic">Auto Generated number to word</span>}
              </div>
            </div>
          </div>

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
