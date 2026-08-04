"use client";

import { useCallback, useEffect, useState } from "react";
import { Controller, useFieldArray }        from "react-hook-form";
import { useFormWithToast as useForm }      from "@/hooks/useFormWithToast";
import { z }              from "zod";
import { zodResolver }    from "@hookform/resolvers/zod";
import { toast }          from "sonner";
import { useRouter }      from "next/navigation";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMInput         from "@/components/project-management/common/PMInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";

import AccountSummary  from "@/components/finance/account/common/AccountSummary";
import { ACC }         from "@/components/finance/account/common/accountTheme";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

// ─── Schema ───────────────────────────────────────────────────────────────────

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
  { gstType: "IGST", ccCode: "IGST", ccName: "Input-IGST", percent: 18, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
  { gstType: "CGST", ccCode: "CGST", ccName: "Input-CGST", percent: 9,  bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
  { gstType: "SGST", ccCode: "SGST", ccName: "Input-SGST", percent: 9,  bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
];

const schema = z.object({
  ogSaleOrderNo:   z.string().default(""),
  saleOrderDate:   z.string().default(""),
  certifiedBillId: z.coerce.number().min(1, "Certified Bill is required"),
  billAbstractNo:  z.string().default(""),
  billAbstractDate: z.string().default(""),
  invoiceNo:       z.string().optional().default(""),
  invoiceDate:     z.string().optional().default(""),
  billToAddress:   z.string().optional().default(""),
  shipToAddress:   z.string().optional().default(""),
  paymentMode:     z.enum(["Cash", "Bank"]).default("Bank"),
  cashAcId:        z.coerce.number().nullable().optional().default(null),
  bankAcId:        z.coerce.number().nullable().optional().default(null),
  utrVoucherNo:    z.string().optional().default(""),
  paymentRemarks:  z.string().optional().default(""),
  discount:        z.coerce.number().min(0).default(0),
  roundOff:        z.coerce.number().default(0),
  items:           z.array(itemSchema).min(1, "At least one item is required"),
  gstLines:        z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  ogSaleOrderNo: "", saleOrderDate: "", certifiedBillId: null,
  billAbstractNo: "", billAbstractDate: "",
  invoiceNo: "", invoiceDate: "", billToAddress: "", shipToAddress: "",
  paymentMode: "Bank", cashAcId: null, bankAcId: null,
  utrVoucherNo: "", paymentRemarks: "",
  discount: 0, roundOff: 0,
  items:    [{ slNo: 1, ccCode: "", ccName: "", bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0 }],
  gstLines: DEFAULT_GST_LINES,
};

const fmt = (val) => {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaleReceiptForm({ mode = "create", receiptId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,    setIsEditing]    = useState(mode === "create");
  const [isSubmitted,  setIsSubmitted]  = useState(false);
  const [allowSubmit,  setAllowSubmit]  = useState(mode === "edit");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [erpReceiptNo, setErpReceiptNo] = useState("");
  const [entryDate,    setEntryDate]    = useState("");

  const [saleOrderOpts,  setSaleOrderOpts]  = useState([]);
  const [certBillOpts,   setCertBillOpts]   = useState([]);
  const [bankCashOpts,   setBankCashOpts]   = useState([]);
  const [billsLoading,   setBillsLoading]   = useState(false);
  const [itemsLoading,   setItemsLoading]   = useState(false);

  const {
    register, control, handleSubmit, reset, setValue, watch, getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields,  replace: replaceItems } = useFieldArray({ control, name: "items" });
  const { fields: gstFields,   replace: replaceGst   } = useFieldArray({ control, name: "gstLines" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Watched values ────────────────────────────────────────────────────────
  const watchedItems    = watch("items")    || [];
  const watchedGst      = watch("gstLines") || DEFAULT_GST_LINES;
  const paymentMode     = watch("paymentMode");
  const ogSaleOrderNo   = watch("ogSaleOrderNo");
  const certifiedBillId = watch("certifiedBillId");
  const discount        = Number(watch("discount") || 0);

  const basicTotal   = watchedItems.reduce((s, it) => s + Number(it?.currentAmount || 0), 0);
  const gstTotal     = watchedGst.filter((l) => l.isSelected).reduce((s, l) => s + Number(l.currentAmount || 0), 0);
  const totalInvoice = basicTotal + gstTotal - discount + Number(watch("roundOff") || 0);

  // ── Auto round-off ─────────────────────────────────────────────────────────
  useEffect(() => {
    const sub = basicTotal + gstTotal - discount;
    const ro  = Math.round(sub) - sub;
    setValue("roundOff", Math.round(ro * 100) / 100, { shouldDirty: false });
  }, [basicTotal, gstTotal, discount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load Sale Orders & Bank/Cash accounts on mount ─────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.LIST}?projectCode=${projectCode}&workflowStatus=Approved`, method: "GET" })
      .then((res) => {
        const opts = (res.data || []).map((o) => ({
          ...o,
          displayLabel: o.orderTitle ? `${o.ogSaleOrderNo} — ${o.orderTitle}` : o.ogSaleOrderNo,
        }));
        setSaleOrderOpts(opts);
      })
      .catch(() => toast.error("Failed to load Sale Orders"));

    apiRequest({ url: `${API_ENDPOINTS.MASTER.BANK_CASH.LIST}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => setBankCashOpts(res.data || []))
      .catch(() => {});
  }, [projectCode]);

  // ── Fetch Certified Bills when Sale Order changes ─────────────────────────
  const fetchCertBills = useCallback(
    async (orderNo) => {
      if (!orderNo || !projectCode) { setCertBillOpts([]); return; }
      setBillsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.CERTIFIED_BILLS}?ogSaleOrderNo=${encodeURIComponent(orderNo)}&projectCode=${projectCode}`,
          method: "GET",
        });
        setCertBillOpts(res.data || []);
      } catch { toast.error("Failed to load Certified Bills"); }
      finally { setBillsLoading(false); }
    },
    [projectCode],
  );

  useEffect(() => { fetchCertBills(ogSaleOrderNo); }, [ogSaleOrderNo, fetchCertBills]);

  // ── Fetch Receipt Items when Certified Bill selected (create only) ─────────
  const fetchReceiptItems = useCallback(
    async (billId) => {
      if (!billId || !projectCode || mode !== "create") return;
      setItemsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.RECEIPT_ITEMS}?certifiedBillId=${billId}&projectCode=${projectCode}`,
          method: "GET",
        });
        const d = res.data || {};
        replaceItems(
          (d.items || []).map((it, i) => ({
            slNo:           i + 1,
            ccCode:         it.ccCode         || "",
            ccName:         it.ccName         || "",
            bookedAmount:   Number(it.bookedAmount   || 0),
            receivedAmount: Number(it.receivedAmount || 0),
            balanceAmount:  Number(it.balanceAmount  || 0),
            currentAmount:  0,
          })),
        );
        const apiGst = d.gstLines || [];
        replaceGst(
          DEFAULT_GST_LINES.map((def) => {
            const match = apiGst.find((l) => l.gstType === def.gstType);
            return match
              ? { ...def, ccCode: match.ccCode || def.ccCode, ccName: match.ccName || def.ccName,
                  percent: Number(match.percent || def.percent),
                  bookedAmount: Number(match.bookedAmount || 0), receivedAmount: Number(match.receivedAmount || 0),
                  balanceAmount: Number(match.balanceAmount || 0), currentAmount: 0, isSelected: true }
              : { ...def, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false };
          }),
        );
      } catch { toast.error("Failed to load receipt items"); }
      finally { setItemsLoading(false); }
    },
    [projectCode, mode, replaceItems, replaceGst],
  );

  useEffect(() => { fetchReceiptItems(certifiedBillId); }, [certifiedBillId, fetchReceiptItems]);

  // ── Fetch Detail (edit/view) ───────────────────────────────────────────────
  useEffect(() => {
    if (!receiptId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.GET_BY_ID}${receiptId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        reset({
          ogSaleOrderNo:    d.ogSaleOrderNo    || "",
          saleOrderDate:    d.saleOrderDate    || "",
          certifiedBillId:  d.certifiedBillId  || null,
          billAbstractNo:   d.billAbstractNo   || d.certifiedBillNo || "",
          billAbstractDate: d.billAbstractDate || "",
          invoiceNo:        d.invoiceNo        || "",
          invoiceDate:      d.invoiceDate      || "",
          billToAddress:    d.billToAddress    || "",
          shipToAddress:    d.shipToAddress    || "",
          paymentMode:      d.paymentMode      || "Bank",
          cashAcId:         d.cashAcId         || null,
          bankAcId:         d.bankAcId         || null,
          utrVoucherNo:     d.utrVoucherNo     || "",
          paymentRemarks:   d.paymentRemarks   || "",
          discount:         Number(d.discount  || 0),
          roundOff:         Number(d.roundOff  || 0),
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
                  percent: Number(match.percent || def.percent),
                  bookedAmount: Number(match.bookedAmount || 0), receivedAmount: Number(match.receivedAmount || 0),
                  balanceAmount: Number(match.balanceAmount || 0), currentAmount: Number(match.currentAmount || 0),
                  isSelected: !!match.isSelected }
              : { ...def, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false };
          }),
        });
        setErpReceiptNo(d.receiptNo || "");
        setEntryDate(d.entryDate   || "");
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.receiptUuid && onUuid) onUuid(d.receiptUuid);
      })
      .catch(() => toast.error("Failed to load receipt details"));
  }, [receiptId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GST mutual exclusion (IGST vs CGST+SGST) ─────────────────────────────
  const handleGstToggle = (idx, checked) => {
    const type = watchedGst[idx]?.gstType;
    if (type === "IGST") {
      setValue("gstLines.0.isSelected", checked);
      if (checked) {
        setValue("gstLines.1.isSelected", false); setValue("gstLines.1.currentAmount", 0);
        setValue("gstLines.2.isSelected", false); setValue("gstLines.2.currentAmount", 0);
      }
    } else {
      // CGST or SGST always move together
      setValue("gstLines.1.isSelected", checked);
      setValue("gstLines.2.isSelected", checked);
      if (checked) {
        setValue("gstLines.0.isSelected", false); setValue("gstLines.0.currentAmount", 0);
      } else {
        setValue("gstLines.1.currentAmount", 0);
        setValue("gstLines.2.currentAmount", 0);
      }
    }
  };

  // ── Save Draft ─────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    // Validate currentAmount ≤ balanceAmount per item
    for (let i = 0; i < v.items.length; i++) {
      const it = v.items[i];
      if (Number(it.currentAmount) > Number(it.balanceAmount)) {
        toast.error(`Row ${i + 1}: Current amount exceeds balance (${fmt(it.balanceAmount)})`);
        return;
      }
    }
    for (let i = 0; i < v.gstLines.length; i++) {
      const l = v.gstLines[i];
      if (l.isSelected && Number(l.currentAmount) > Number(l.balanceAmount)) {
        toast.error(`${l.gstType}: Current amount exceeds GST balance (${fmt(l.balanceAmount)})`);
        return;
      }
    }

    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.SALE_RECEIPT.CREATE
      : `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.EDIT}${receiptId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      certifiedBillId:  v.certifiedBillId,
      invoiceNo:        v.invoiceNo        || "",
      invoiceDate:      v.invoiceDate      || "",
      billToAddress:    v.billToAddress    || "",
      shipToAddress:    v.shipToAddress    || "",
      billAbstractNo:   v.billAbstractNo   || "",
      billAbstractDate: v.billAbstractDate || "",
      paymentMode:      v.paymentMode,
      cashAcId:         v.paymentMode === "Cash" ? v.cashAcId : null,
      bankAcId:         v.paymentMode === "Bank" ? v.bankAcId : null,
      utrVoucherNo:     v.utrVoucherNo     || "",
      paymentRemarks:   v.paymentRemarks   || "",
      discount:         Number(v.discount  || 0),
      roundOff:         Number(v.roundOff  || 0),
      items:    v.items.map((it, i) => ({
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

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Receipt saved as draft" : "Receipt updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.receiptUuid && onUuid) onUuid(res.data.receiptUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/receipt/${newId}`), 400);
      }
    } catch (err) { toast.error(err?.message || "Failed to save"); }
  };

  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.SUBMIT}${receiptId}`, method: "POST" });
      toast.success("Receipt submitted for approval");
      setIsSubmitted(true);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) { toast.error(err?.message || "Failed to submit"); }
  };

  const handleEdit = () => {
    if (isEditing) { reset(); setIsEditing(false); }
    else setIsEditing(true);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const inputCls = (err) =>
    `w-full h-[30px] text-[13px] rounded-sm border px-2 outline-none transition ${
      err ? ACC.inputError : disabled ? ACC.inputDisabled : `border-gray-300 bg-white focus:border-[#3b6ea5]`
    }`;

  const bankFiltered = bankCashOpts.filter((a) => a.type === "BANK");
  const cashFiltered = bankCashOpts.filter((a) => a.type === "CASH");

  // ── Render ─────────────────────────────────────────────────────────────────
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

          <PMSection title="Receipt Details:">
            <PMFormRow label="ERP Doc. No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={erpReceiptNo || "[Auto]"} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>
            <PMFormRow label="Entry Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={entryDate || "[Auto - Today]"} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>
            <PMFormRow label="Invoice No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input {...register("invoiceNo")} disabled={disabled} placeholder="Invoice reference"
                className={inputCls(errors.invoiceNo)} />
            </PMFormRow>
            <PMFormRow label="Invoice Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("invoiceDate")} disabled={disabled} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          <PMSection title="Sale Order Details:">
            <PMFormRow label="Sale Order No" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="ogSaleOrderNo" control={control} render={({ field }) => (
                <SearchableSelect
                  options={saleOrderOpts}
                  value={field.value || ""}
                  disabled={disabled}
                  onChange={(v, opt) => {
                    field.onChange(opt?.ogSaleOrderNo || v || "");
                    setValue("saleOrderDate", opt?.ogSaleOrderDate || "");
                    // reset cert bill fields when order changes
                    setValue("certifiedBillId", null);
                    setValue("billAbstractNo",   "");
                    setValue("billAbstractDate", "");
                    replaceItems([{ slNo: 1, ccCode: "", ccName: "", bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0 }]);
                    replaceGst(DEFAULT_GST_LINES);
                  }}
                  placeholder="Select Sale Order"
                  labelKey="displayLabel"
                  valueKey="ogSaleOrderNo"
                  searchKeys={["displayLabel", "ogSaleOrderNo", "orderTitle"]}
                />
              )} />
            </PMFormRow>
            <PMFormRow label="Sale Order Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={watch("saleOrderDate") || ""} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>
            <PMFormRow label="Certified Bill" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="certifiedBillId" control={control} render={({ field }) => (
                <SearchableSelect
                  options={certBillOpts}
                  value={field.value ? String(field.value) : ""}
                  disabled={disabled || !watch("ogSaleOrderNo")}
                  onChange={(v, opt) => {
                    field.onChange(v ? Number(v) : null);
                    setValue("billAbstractNo",   opt?.billingNo   || "");
                    setValue("billAbstractDate", opt?.billingDate || "");
                  }}
                  placeholder={billsLoading ? "Loading…" : "Select Certified Bill"}
                  labelKey="billingNo"
                  valueKey="id"
                  searchKeys={["billingNo"]}
                />
              )} />
              {errors.certifiedBillId && <p className="text-red-500 text-[11px] mt-0.5">{errors.certifiedBillId.message}</p>}
            </PMFormRow>
            <PMFormRow label="Bill Abstract No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={watch("billAbstractNo") || ""} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>
            <PMFormRow label="Bill Abstract Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={watch("billAbstractDate") || ""} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>
          </PMSection>

          <PMSection title="Address:">
            <PMFormRow label="Bill To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="billToAddress" control={control} render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Billing address" rows={2} maxRows={5} />
              )} />
            </PMFormRow>
            <PMFormRow label="Ship To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="shipToAddress" control={control} render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Shipping address" rows={2} maxRows={5} />
              )} />
            </PMFormRow>
          </PMSection>

          <PMSection title="Payment:">
            <PMFormRow label="Payment Mode" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="paymentMode" control={control} render={({ field }) => (
                <div className="flex gap-4 items-center h-[30px]">
                  {["Cash", "Bank"].map((m) => (
                    <label key={m} className="flex items-center gap-1.5 cursor-pointer text-[13px]">
                      <input type="radio" value={m} checked={field.value === m} disabled={disabled}
                        onChange={() => { field.onChange(m); setValue("cashAcId", null); setValue("bankAcId", null); }}
                        className="accent-[#3b6ea5]" />
                      {m}
                    </label>
                  ))}
                </div>
              )} />
            </PMFormRow>

            {paymentMode === "Cash" && (
              <PMFormRow label="Cash A/c" labelWidth="sm:w-[150px] sm:min-w-[150px]">
                <Controller name="cashAcId" control={control} render={({ field }) => (
                  <SearchableSelect
                    options={cashFiltered}
                    value={field.value ? String(field.value) : ""}
                    disabled={disabled}
                    onChange={(v) => field.onChange(v ? Number(v) : null)}
                    placeholder="Select Cash A/c"
                    labelKey={["bankName", "bankAcNumber"]}
                    labelSeparator=" — "
                    valueKey="id"
                    searchKeys={["bankName", "bankCode", "bankAcNumber", "branchName"]}
                  />
                )} />
              </PMFormRow>
            )}

            {paymentMode === "Bank" && (
              <PMFormRow label="Bank A/c" labelWidth="sm:w-[150px] sm:min-w-[150px]">
                <Controller name="bankAcId" control={control} render={({ field }) => (
                  <SearchableSelect
                    options={bankFiltered}
                    value={field.value ? String(field.value) : ""}
                    disabled={disabled}
                    onChange={(v) => field.onChange(v ? Number(v) : null)}
                    placeholder="Select Bank A/c"
                    labelKey={["bankName", "bankAcNumber"]}
                    labelSeparator=" — "
                    valueKey="id"
                    searchKeys={["bankName", "bankCode", "bankAcNumber", "branchName"]}
                  />
                )} />
              </PMFormRow>
            )}

            <PMFormRow label="UTR / Voucher No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input {...register("utrVoucherNo")} disabled={disabled} placeholder="UTR or voucher reference"
                className={inputCls()} />
            </PMFormRow>
            <PMFormRow label="Payment Remarks" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="paymentRemarks" control={control} render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Remarks" rows={2} maxRows={5} />
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
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full min-w-[620px] border-collapse text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className={ACC.tableHead}>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[40px]">SL</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[70px]">CC Code</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">CC Name</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[90px]">Booked</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[90px]">Received</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[90px]">Balance</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[100px]">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsLoading ? (
                    <tr>
                      <td colSpan={7} className="border border-gray-200 py-5 text-center text-gray-400">
                        <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading items…
                      </td>
                    </tr>
                  ) : itemFields.length === 0 || (itemFields.length === 1 && !watchedItems[0]?.ccCode) ? (
                    <tr>
                      <td colSpan={7} className="border border-gray-200 py-6 text-center text-[#bbb] italic">
                        Select a Certified Bill to load items
                      </td>
                    </tr>
                  ) : (
                    itemFields.map((field, idx) => {
                      const item    = watchedItems[idx] || {};
                      const current = Number(item.currentAmount || 0);
                      const balance = Number(item.balanceAmount || 0) - current;
                      return (
                        <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>
                          <td className="border border-gray-200 px-2 py-[3px] text-center">{idx + 1}</td>
                          <td className="border border-gray-200 px-2 py-[3px]">{item.ccCode}</td>
                          <td className="border border-gray-200 px-2 py-[3px] text-gray-800">{item.ccName}</td>
                          <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600" style={{ whiteSpace: "nowrap" }}>{fmt(item.bookedAmount)}</td>
                          <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600" style={{ whiteSpace: "nowrap" }}>{fmt(item.receivedAmount)}</td>
                          <td className={`border border-gray-200 px-2 py-[3px] text-right font-medium ${balance < 0 ? "text-red-600" : "text-gray-800"}`} style={{ whiteSpace: "nowrap" }}>
                            {fmt(balance)}
                          </td>
                          <td className="border border-gray-200 p-0.5">
                            <input
                              type="number" min="0" step="0.01"
                              {...register(`items.${idx}.currentAmount`)}
                              disabled={disabled}
                              placeholder="0.00"
                              className={`w-full h-[26px] text-[12px] px-1.5 text-right outline-none rounded-sm border-0 ${
                                disabled ? "bg-[#edf8ed] text-gray-500" : "bg-[#fffbe6] focus:bg-white focus:border focus:border-[#93b5cc]"
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* BASIC Total row */}
                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={6} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{fmt(basicTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* GST Table */}
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <div className={`${ACC.gstHeader} px-3 py-[5px]`}>
              <span className={ACC.sectionTitle}>GST</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-[12px]">
                <thead>
                  <tr className={ACC.tableHead}>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[30px]" />
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[36px]">SL</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[70px]">CC Code</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">CC Name</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[85px]">Booked</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[85px]">Received</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[85px]">Balance</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[95px]">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {gstFields.map((field, idx) => {
                    const line    = watchedGst[idx] || {};
                    const current = Number(line.currentAmount || 0);
                    const balance = Number(line.balanceAmount || 0) - current;
                    return (
                      <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#fdf5f0]"}>
                        <td className="border border-gray-200 px-1 py-[3px] text-center">
                          <input
                            type="checkbox"
                            checked={!!line.isSelected}
                            disabled={disabled}
                            onChange={(e) => handleGstToggle(idx, e.target.checked)}
                            className="accent-[#3b6ea5] cursor-pointer"
                          />
                        </td>
                        <td className="border border-gray-200 px-2 py-[3px] text-center">{idx + 1}</td>
                        <td className="border border-gray-200 px-2 py-[3px] font-medium">{line.ccCode}</td>
                        <td className="border border-gray-200 px-2 py-[3px] text-gray-700">
                          {line.ccName}
                          {line.percent > 0 && <span className="ml-1 text-[10px] text-gray-400">({line.percent}%)</span>}
                        </td>
                        <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600" style={{ whiteSpace: "nowrap" }}>{line.bookedAmount > 0 ? fmt(line.bookedAmount) : "-"}</td>
                        <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600" style={{ whiteSpace: "nowrap" }}>{line.receivedAmount > 0 ? fmt(line.receivedAmount) : "-"}</td>
                        <td className={`border border-gray-200 px-2 py-[3px] text-right font-medium ${balance < 0 ? "text-red-600" : "text-gray-800"}`} style={{ whiteSpace: "nowrap" }}>
                          {line.bookedAmount > 0 ? fmt(balance) : "-"}
                        </td>
                        <td className="border border-gray-200 p-0.5">
                          <input
                            type="number" min="0" step="0.01"
                            {...register(`gstLines.${idx}.currentAmount`)}
                            disabled={disabled || !line.isSelected}
                            placeholder="0.00"
                            className={`w-full h-[26px] text-[12px] px-1.5 text-right outline-none rounded-sm border-0 ${
                              disabled || !line.isSelected
                                ? "bg-[#edf8ed] text-gray-400"
                                : "bg-[#fffbe6] focus:bg-white focus:border focus:border-[#93b5cc]"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {/* GST Total row */}
                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={7} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{fmt(gstTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <AccountSummary
            basicTotal={basicTotal}
            gstTotal={gstTotal}
            totalInvoice={totalInvoice}
            register={register}
            watch={watch}
            disabled={disabled}
            wordsLabel="Amount (In Word)"
          />

          {/* Action Buttons */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton onClick={() => handleSubmit(onSave)()} loading={isSubmitting} disabled={isSubmitting} />
              )}
              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                loadingText="Submitting…"
                confirmationTitle="Submit Sale Receipt?"
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
