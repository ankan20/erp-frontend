"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useFieldArray }        from "react-hook-form";
import { useFormWithToast as useForm }      from "@/hooks/useFormWithToast";
import { z }           from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast }       from "sonner";
import { useRouter }   from "next/navigation";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMInput        from "@/components/project-management/common/PMInput";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";
import AmountInput     from "@/components/common/AmountInput";
import AccountSummary  from "@/components/finance/account/common/AccountSummary";
import { ACC }         from "@/components/finance/account/common/accountTheme";
import { formatAmount } from "@/helper/numberFormatter";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

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
  { gstType: "IGST", ccCode: "IGST", ccName: "Input-IGST", percent: 18, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
  { gstType: "CGST", ccCode: "CGST", ccName: "Input-CGST", percent: 9,  bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
  { gstType: "SGST", ccCode: "SGST", ccName: "Input-SGST", percent: 9,  bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false },
];

const schema = z.object({
  ogSaleOrderNo:    z.string().default(""),
  saleOrderDate:    z.string().default(""),
  certifiedBillId:  z.coerce.number().nullable().optional(),  // set from invoice lookup, not user-selected
  certifiedBillNo:  z.string().default(""),                   // display only, not in payload
  billAbstractNo:   z.string().default(""),
  billAbstractDate: z.string().default(""),
  invoiceNo:        z.string().optional().default(""),
  invoiceDate:      z.string().optional().default(""),        // read-only, auto-filled from invoice lookup
  billToAddress:    z.string().optional().default(""),
  shipToAddress:    z.string().optional().default(""),
  discount:         z.coerce.number().min(0).default(0),
  roundOff:         z.coerce.number().default(0),
  items:            z.array(itemSchema).min(1, "At least one item is required"),
  gstLines:         z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  ogSaleOrderNo: "", saleOrderDate: "", certifiedBillId: null, certifiedBillNo: "",
  billAbstractNo: "", billAbstractDate: "",
  invoiceNo: "", invoiceDate: "", billToAddress: "", shipToAddress: "",
  discount: 0, roundOff: 0,
  items:    [{ slNo: 1, ccCode: "", ccName: "", bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0 }],
  gstLines: DEFAULT_GST_LINES,
};

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

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [srbNo,       setSrbNo]       = useState("");

  const [saleOrderOpts,        setSaleOrderOpts]        = useState([]);
  const [allInvoiceOpts,       setAllInvoiceOpts]       = useState([]);  // full approved list
  const [invoiceOpts,          setInvoiceOpts]          = useState([]);  // filtered by selected order
  const [invoicesLoading,      setInvoicesLoading]      = useState(false);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const skipClearOnOrderChange = useRef(false);          // prevents clearing when lookup sets ogSaleOrderNo

  const {
    register, control, handleSubmit, reset, setValue, watch, getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields,  replace: replaceItems } = useFieldArray({ control, name: "items" });
  const { fields: gstFields,   replace: replaceGst   } = useFieldArray({ control, name: "gstLines" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  const watchedItems  = watch("items")    || [];
  const watchedGst    = watch("gstLines") || DEFAULT_GST_LINES;
  const ogSaleOrderNo = watch("ogSaleOrderNo");
  const discount      = Number(watch("discount") || 0);

  const basicTotal   = watchedItems.reduce((s, it) => s + Number(it?.currentAmount || 0), 0);
  const gstTotal     = watchedGst.filter((l) => l.isSelected).reduce((s, l) => s + Number(l.currentAmount || 0), 0);
  const totalInvoice = basicTotal + gstTotal - discount + Number(watch("roundOff") || 0);

  // ── Auto round-off ─────────────────────────────────────────────────────────
  useEffect(() => {
    const sub = basicTotal + gstTotal - discount;
    const ro  = Math.round(sub) - sub;
    setValue("roundOff", Math.round(ro * 100) / 100, { shouldDirty: false });
  }, [basicTotal, gstTotal, discount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers to populate items from API response ────────────────────────────
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
              percent: Number(match.percent || def.percent),
              bookedAmount: Number(match.bookedAmount || 0), receivedAmount: Number(match.receivedAmount || 0),
              balanceAmount: Number(match.balanceAmount || 0),
              currentAmount: Number(match.currentAmount || 0),
              isSelected: !!match.isSelected }
          : { ...def, bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0, isSelected: false };
      }),
    );
  }, [replaceItems, replaceGst]);

  // ── Load Sale Orders on mount ──────────────────────────────────────────────
  // TODO: replace with a dedicated sale-receipt sale order API when available
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.LIST}?projectCode=${projectCode}&workflowStatus=Approved`,
      method: "GET",
    })
      .then((res) => {
        setSaleOrderOpts(
          (res.data || []).map((o) => ({
            ...o,
            displayLabel: o.orderTitle ? `${o.ogSaleOrderNo} — ${o.orderTitle}` : o.ogSaleOrderNo,
          })),
        );
      })
      .catch(() => {});
  }, [projectCode]);

  // ── Load ALL approved invoices once at mount ───────────────────────────────
  // Full list enables direct invoice selection without picking a sale order first.
  // TODO: add extra server-side filters here if the API supports them in future (e.g. &notAlreadyReceipted=true)
  useEffect(() => {
    if (!projectCode) return;
    setInvoicesLoading(true);
    apiRequest({
      url: `${API_ENDPOINTS.FINANCE.SALE_BILL.LIST}?projectCode=${projectCode}&workflowStatus=Approved`,
      method: "GET",
    })
      .then((res) => {
        const list = res.data || [];
        setAllInvoiceOpts(list);
        setInvoiceOpts(list);   // show all by default (no sale order selected yet)
      })
      .catch(() => toast.error("Failed to load invoices"))
      .finally(() => setInvoicesLoading(false));
  }, [projectCode]);

  // ── Filter invoice list client-side when sale order changes ───────────────
  useEffect(() => {
    if (!ogSaleOrderNo) {
      setInvoiceOpts(allInvoiceOpts);   // no filter — show all
    } else {
      setInvoiceOpts(allInvoiceOpts.filter((inv) => inv.saleOrderNo === ogSaleOrderNo));
    }
  }, [ogSaleOrderNo, allInvoiceOpts]);

  // ── Clear invoice-dependent fields when user manually changes sale order ───
  // Skipped when lookup sets ogSaleOrderNo (lookup handles its own field fills)
  useEffect(() => {
    if (skipClearOnOrderChange.current) { skipClearOnOrderChange.current = false; return; }
    if (!ogSaleOrderNo) return;
    setValue("invoiceNo",        "");
    setValue("invoiceDate",      "");
    setValue("certifiedBillId",  null);
    setValue("certifiedBillNo",  "");
    setValue("billAbstractNo",   "");
    setValue("billAbstractDate", "");
    setValue("billToAddress",    "");
    setValue("shipToAddress",    "");
    replaceItems([{ slNo: 1, ccCode: "", ccName: "", bookedAmount: 0, receivedAmount: 0, balanceAmount: 0, currentAmount: 0 }]);
    replaceGst(DEFAULT_GST_LINES);
  }, [ogSaleOrderNo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Invoice selected → invoice-lookup fills everything (order, cert bill, items, GST) ─
  // No separate receipt-items or certified-bills API calls needed — invoice-lookup returns all of it.
  const handleInvoiceSelect = useCallback(async (saleBillNo) => {
    if (!saleBillNo || !projectCode) return;
    setInvoiceLookupLoading(true);
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT_BILLING.INVOICE_LOOKUP}?invoiceNo=${encodeURIComponent(saleBillNo)}&projectCode=${projectCode}`,
        method: "GET",
      });
      const d = res.data || {};
      // Auto-select sale order from lookup — skip the clear-on-change effect
      skipClearOnOrderChange.current = true;
      setValue("ogSaleOrderNo",    d.ogSaleOrderNo    || "");
      setValue("saleOrderDate",    d.saleOrderDate    || "");
      setValue("invoiceNo",        d.invoiceNo        || saleBillNo);
      setValue("invoiceDate",      d.invoiceDate      || "");
      setValue("certifiedBillId",  d.certifiedBillId  || null);
      setValue("certifiedBillNo",  d.certifiedBillNo  || "");
      setValue("billAbstractNo",   d.billAbstractNo   || d.certifiedBillNo || "");
      setValue("billAbstractDate", d.billAbstractDate || "");
      setValue("billToAddress",    d.billToAddress    || "");
      setValue("shipToAddress",    d.shipToAddress    || "");
      applyReceiptItems({ ...d, items: (d.items || []).map((it) => ({ ...it, currentAmount: 0 })) });
    } catch (err) {
      toast.error(err?.message || "Failed to load invoice details");
    } finally {
      setInvoiceLookupLoading(false);
    }
  }, [projectCode, setValue, applyReceiptItems]);

  // ── Fetch Detail (edit/view) ───────────────────────────────────────────────
  useEffect(() => {
    if (!billingId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT_BILLING.GET_BY_ID}${billingId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        // Prevent the clear-on-order-change effect from wiping items/GST after reset sets ogSaleOrderNo
        skipClearOnOrderChange.current = true;
        reset({
          ogSaleOrderNo:    d.ogSaleOrderNo    || "",
          saleOrderDate:    d.saleOrderDate    || "",
          certifiedBillId:  d.certifiedBillId  || null,
          certifiedBillNo:  d.certifiedBillNo  || "",
          billAbstractNo:   d.billAbstractNo   || d.certifiedBillNo || "",
          billAbstractDate: d.billAbstractDate || "",
          invoiceNo:        d.invoiceNo        || "",
          invoiceDate:      d.invoiceDate      || "",
          billToAddress:    d.billToAddress    || "",
          shipToAddress:    d.shipToAddress    || "",
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
        setSrbNo(d.srbNo || "");
        if (d.srbUuid && onUuid) onUuid(d.srbUuid);
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        setIsEditing(false);
      })
      .catch(() => toast.error("Failed to load billing details"));
  }, [billingId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

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
      receiptId:        receiptId ? Number(receiptId) : undefined,
      certifiedBillId:  v.certifiedBillId,
      invoiceNo:        v.invoiceNo        || "",
      invoiceDate:      v.invoiceDate      || "",
      billToAddress:    v.billToAddress    || "",
      shipToAddress:    v.shipToAddress    || "",
      billAbstractNo:   v.billAbstractNo   || "",
      billAbstractDate: v.billAbstractDate || "",
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

          <PMSection title="Sale Order:">
            {mode !== "create" && (
              <PMFormRow label="SRB No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
                <PMInput value={srbNo || "[Auto]"} disabled readOnly />
              </PMFormRow>
            )}
            <PMFormRow label="Sale Order No" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="ogSaleOrderNo" control={control} render={({ field }) => (
                <SearchableSelect
                  options={saleOrderOpts}
                  value={field.value || ""}
                  disabled={disabled}
                  onChange={(v, opt) => {
                    field.onChange(opt?.ogSaleOrderNo || v || "");
                    setValue("saleOrderDate", opt?.ogSaleOrderDate || "");
                  }}
                  placeholder="Select Sale Order"
                  labelKey="displayLabel"
                  valueKey="ogSaleOrderNo"
                  searchKeys={["displayLabel", "ogSaleOrderNo", "orderTitle"]}
                />
              )} />
            </PMFormRow>
            <PMFormRow label="Sale Order Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={watch("saleOrderDate") || ""} disabled readOnly />
            </PMFormRow>
          </PMSection>

          <PMSection title="Invoice / Bill:">
            <PMFormRow label="Invoice No" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              {disabled ? (
                <PMInput value={watch("invoiceNo") || ""} disabled readOnly />
              ) : (
                <Controller name="invoiceNo" control={control} render={({ field }) => (
                  <SearchableSelect
                    options={invoiceOpts}
                    value={field.value || ""}
                    disabled={false}
                    onChange={(v) => {
                      field.onChange(v || "");
                      if (v) handleInvoiceSelect(v);
                    }}
                    placeholder={invoicesLoading ? "Loading…" : "Select Invoice"}
                    labelKey="saleBillNo"
                    valueKey="saleBillNo"
                    searchKeys={["saleBillNo", "certifiedBillNo", "saleOrderNo"]}
                  />
                )} />
              )}
              {invoiceLookupLoading && (
                <p className="text-[11px] text-[#3b6ea5] mt-0.5 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading invoice details…
                </p>
              )}
            </PMFormRow>
            <PMFormRow label="Invoice Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={watch("invoiceDate") || ""} disabled readOnly
                placeholder="Auto-filled from invoice" />
            </PMFormRow>
            <PMFormRow label="Certified Bill" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={watch("certifiedBillNo") || ""} disabled readOnly
                placeholder="Auto-filled from invoice" />
            </PMFormRow>
            <PMFormRow label="Bill Abstract No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={watch("billAbstractNo") || ""} disabled readOnly />
            </PMFormRow>
            <PMFormRow label="Bill Abstract Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={watch("billAbstractDate") || ""} disabled readOnly />
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
                  {invoiceLookupLoading ? (
                    <tr>
                      <td colSpan={7} className="border border-gray-200 py-5 text-center text-gray-400">
                        <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading items…
                      </td>
                    </tr>
                  ) : itemFields.length === 0 || (itemFields.length === 1 && !watchedItems[0]?.ccCode) ? (
                    <tr>
                      <td colSpan={7} className="border border-gray-200 py-6 text-center text-[#bbb] italic">
                        Select a Sale Order, then pick an Invoice to load items
                      </td>
                    </tr>
                  ) : (
                    itemFields.map((field, idx) => {
                      const item       = watchedItems[idx] || {};
                      const current    = Number(item.currentAmount || 0);
                      const balDisplay = Number(item.balanceAmount || 0) - current;
                      const overBalance = !disabled && current > Number(item.balanceAmount || 0);
                      return (
                        <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>
                          <td className="border border-gray-200 px-2 py-[3px] text-center">{idx + 1}</td>
                          <td className="border border-gray-200 px-2 py-[3px]">{item.ccCode}</td>
                          <td className="border border-gray-200 px-2 py-[3px] text-gray-800">{item.ccName}</td>
                          <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600 whitespace-nowrap">{formatAmount(item.bookedAmount)}</td>
                          <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600 whitespace-nowrap">{formatAmount(item.receivedAmount)}</td>
                          <td className={`border border-gray-200 px-2 py-[3px] text-right font-medium whitespace-nowrap ${balDisplay < 0 ? "text-red-600" : "text-gray-800"}`}>
                            {formatAmount(balDisplay)}
                          </td>
                          <td className="border border-gray-200 p-0.5">
                            <AmountInput
                              {...register(`items.${idx}.currentAmount`)}
                              value={watchedItems[idx]?.currentAmount ?? ""}
                              disabled={disabled}
                              placeholder="0.00"
                              className={`w-full h-[26px] text-[12px] text-right rounded-sm border-0 outline-none ${
                                disabled
                                  ? "bg-[#edf8ed] text-gray-500"
                                  : overBalance
                                  ? "bg-red-50 text-red-600 border border-red-400"
                                  : "bg-[#fffbe6] focus:bg-white"
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={6} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{formatAmount(basicTotal)}</td>
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
                    const balDisplay = Number(line.balanceAmount || 0) - current;
                    return (
                      <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#fdf5f0]"}>
                        <td className="border border-gray-200 px-1 py-[3px] text-center">
                          <input type="checkbox" checked={!!line.isSelected} disabled={disabled}
                            onChange={(e) => handleGstToggle(idx, e.target.checked)}
                            className="accent-[#3b6ea5] cursor-pointer" />
                        </td>
                        <td className="border border-gray-200 px-2 py-[3px] text-center">{idx + 1}</td>
                        <td className="border border-gray-200 px-2 py-[3px] font-medium">{line.ccCode}</td>
                        <td className="border border-gray-200 px-2 py-[3px] text-gray-700">
                          {line.ccName}
                          {line.percent > 0 && <span className="ml-1 text-[10px] text-gray-400">({line.percent}%)</span>}
                        </td>
                        <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600 whitespace-nowrap">
                          {line.bookedAmount > 0 ? formatAmount(line.bookedAmount) : "—"}
                        </td>
                        <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600 whitespace-nowrap">
                          {line.receivedAmount > 0 ? formatAmount(line.receivedAmount) : "—"}
                        </td>
                        <td className={`border border-gray-200 px-2 py-[3px] text-right font-medium whitespace-nowrap ${balDisplay < 0 ? "text-red-600" : "text-gray-800"}`}>
                          {line.bookedAmount > 0 ? formatAmount(balDisplay) : "—"}
                        </td>
                        <td className="border border-gray-200 p-0.5">
                          <AmountInput
                            {...register(`gstLines.${idx}.currentAmount`)}
                            value={watchedGst[idx]?.currentAmount ?? ""}
                            disabled={disabled || !line.isSelected}
                            placeholder="0.00"
                            className={`w-full h-[26px] text-[12px] text-right rounded-sm border-0 outline-none ${
                              disabled || !line.isSelected
                                ? "bg-[#edf8ed] text-gray-400"
                                : "bg-[#fffbe6] focus:bg-white"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={7} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{formatAmount(gstTotal)}</td>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
