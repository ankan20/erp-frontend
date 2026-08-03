"use client";

import { useEffect, useState, useCallback } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";
import ExpandableTextCell from "@/components/project-management/common/ExpandableTextCell";

import { amountToWordsIN } from "@/lib/amountToWords";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

// ─── Constants ────────────────────────────────────────────────────────────────

const SALE_BILL_MODES = [
  { label: "Sale Invoice",     value: "Sale Invoice" },
  { label: "Proforma Invoice", value: "Proforma Invoice" },
];

const DEFAULT_GST_LINES = [
  { gstType: "IGST", ccCode: "IGST", ccName: "Output-IGST", description: "", percent: 18, gstAmount: 0, isSelected: false },
  { gstType: "CGST", ccCode: "CGST", ccName: "Output-CGST", description: "", percent: 9,  gstAmount: 0, isSelected: false },
  { gstType: "SGST", ccCode: "SGST", ccName: "Output-SGST", description: "", percent: 9,  gstAmount: 0, isSelected: false },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  slNo:        z.number(),
  ccCode:      z.string(),
  ccName:      z.string(),
  description: z.string().optional().default(""),
  hsnSac:      z.string().optional().default(""),
  basicAmount: z.coerce.number().min(0).default(0),
});

const gstLineSchema = z.object({
  gstType:     z.string(),
  ccCode:      z.string(),
  ccName:      z.string(),
  description: z.string().optional().default(""),
  percent:     z.number(),
  gstAmount:   z.coerce.number().default(0),
  isSelected:  z.boolean().default(false),
});

const schema = z.object({
  mode:              z.string().min(1, "Mode is required"),
  certifiedBillId:   z.coerce.number().min(1, "Certified Bill is required"),
  ogSaleOrderNo:     z.string().min(1, "Sale Order is required"),
  saleOrderDate:     z.string().optional().default(""),
  invoiceDate:       z.string().min(1, "Invoice Date is required"),
  referenceNo:       z.string().optional().default(""),
  referenceDate:     z.string().optional().default(""),
  billToAddress:     z.string().optional().default(""),
  shipToAddress:     z.string().optional().default(""),
  billAbstractNo:    z.string().optional().default(""),
  billAbstractDate:  z.string().optional().default(""),
  bankAcId:          z.coerce.number().nullable().optional(),
  paymentTermsDays:  z.string().optional().default(""),
  declaration:       z.string().optional().default(""),
  discount:          z.coerce.number().min(0).default(0),
  roundOff:          z.coerce.number().default(0),
  items:             z.array(itemSchema).min(1, "At least one item required"),
  gstLines:          z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  mode:             "",
  certifiedBillId:  null,
  ogSaleOrderNo:    "",
  saleOrderDate:    "",
  invoiceDate:      "",
  referenceNo:      "",
  referenceDate:    "",
  billToAddress:    "",
  shipToAddress:    "",
  billAbstractNo:   "",
  billAbstractDate: "",
  bankAcId:         null,
  paymentTermsDays: "",
  declaration:      "",
  discount:         0,
  roundOff:         0,
  items:            [],
  gstLines:         DEFAULT_GST_LINES,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val) => {
  const n = Number(val);
  if (!val && val !== 0) return "";
  if (isNaN(n)) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parsePaymentTerms = (val) => {
  if (!val) return "";
  return String(val).replace(/\s*[Dd]ays?\s*$/, "").trim();
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaleBillForm({ mode = "create", billId, onAfterSubmit }) {
  const isViewMode = mode === "view" || mode === "approver";
  const router     = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,          setIsEditing]          = useState(mode === "create");
  const [isSubmitted,        setIsSubmitted]         = useState(false);
  const [allowSubmit,        setAllowSubmit]         = useState(mode === "edit");
  const [isLoading,          setIsLoading]           = useState(false);
  const [initialData,        setInitialData]         = useState(null);
  const [sidebarOpen,        setSidebarOpen]         = useState(true);

  const [saleOrderOpts,      setSaleOrderOpts]       = useState([]);
  const [certifiedBillOpts,  setCertifiedBillOpts]   = useState([]);
  const [certifiedBillsLoading, setCertifiedBillsLoading] = useState(false);
  const [itemsLoading,       setItemsLoading]        = useState(false);
  const [bankOpts,           setBankOpts]            = useState([]);

  const {
    register, control, handleSubmit, reset, getValues, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Computed Totals ────────────────────────────────────────────────────────
  const watchedItems    = watch("items")    || [];
  const watchedGstLines = watch("gstLines") || [];
  const watchedDiscount = Number(watch("discount") || 0);
  const watchedRoundOff = Number(watch("roundOff") || 0);

  const basicTotal = watchedItems.reduce((s, it) => s + Number(it?.basicAmount || 0), 0);

  const gstLinesComputed = watchedGstLines.map((line) => ({
    ...line,
    gstAmount: line.isSelected ? basicTotal * line.percent / 100 : 0,
  }));
  const gstTotal = gstLinesComputed.reduce((s, l) => s + l.gstAmount, 0);
  const totalInvoiceAmount = basicTotal + gstTotal - watchedDiscount + watchedRoundOff;

  // Sync computed gstAmounts into form
  useEffect(() => {
    gstLinesComputed.forEach((line, i) => {
      setValue(`gstLines.${i}.gstAmount`, line.gstAmount);
    });
  }, [basicTotal, watchedGstLines.map(l => l.isSelected).join(",")]);

  // ── Fetch OG Sale Orders ──────────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url:    `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.LIST}?projectCode=${projectCode}&workflowStatus=Approved`,
      method: "GET",
    })
      .then((res) => {
        const orders = (Array.isArray(res.data) ? res.data : []).map((o) => ({
          ...o,
          displayLabel: [o.prefix, o.ogSaleOrderNo, o.suffix].filter(Boolean).join(" | "),
        }));
        setSaleOrderOpts(orders);
      })
      .catch(() => setSaleOrderOpts([]));
  }, [projectCode]);

  // ── Fetch Bank List ────────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.BANK_CASH.LIST, method: "GET" })
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : [];
        setBankOpts(all.filter((b) => b.type === "BANK"));
      })
      .catch(() => setBankOpts([]));
  }, []);

  // ── Fetch Certified Bills for a Sale Order ─────────────────────────────────
  const fetchCertifiedBills = useCallback(async (ogSaleOrderNo) => {
    if (!ogSaleOrderNo || !projectCode) { setCertifiedBillOpts([]); return; }
    setCertifiedBillsLoading(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.SALE_BILL.CERTIFIED_BILLS}?ogSaleOrderNo=${encodeURIComponent(ogSaleOrderNo)}&projectCode=${projectCode}`,
        method: "GET",
      });
      setCertifiedBillOpts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCertifiedBillOpts([]);
    } finally {
      setCertifiedBillsLoading(false);
    }
  }, [projectCode]);

  // ── OG Sale Order Selection ────────────────────────────────────────────────
  const handleOrderSelect = useCallback((value, option) => {
    setValue("ogSaleOrderNo",    value,                          { shouldDirty: true });
    setValue("saleOrderDate",    option?.orderDate || option?.saleOrderDate || "", { shouldDirty: true });
    setValue("certifiedBillId",  null,                          { shouldDirty: true });
    setValue("billAbstractNo",   "",                            { shouldDirty: true });
    setValue("billAbstractDate", "",                            { shouldDirty: true });
    setValue("items",            [],                            { shouldDirty: true });
    setValue("gstLines",         DEFAULT_GST_LINES,             { shouldDirty: true });
    setCertifiedBillOpts([]);
    fetchCertifiedBills(value);
  }, [setValue, fetchCertifiedBills]);

  // ── Certified Bill Selection → populate Abstract No/Date + BASIC items ────
  const handleCertifiedBillSelect = useCallback(async (id, option) => {
    setValue("certifiedBillId",  id ? Number(id) : null, { shouldDirty: true });
    setValue("billAbstractNo",
      option?.billAbstractNo || option?.bill_abstract_no || option?.abstractNo || "",
      { shouldDirty: true },
    );
    setValue("billAbstractDate",
      option?.billAbstractDate || option?.bill_abstract_date || option?.abstractDate || "",
      { shouldDirty: true },
    );

    if (!id || !projectCode) return;
    setItemsLoading(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.SALE_BILL.CERTIFIED_BILL_ITEMS}?certifiedBillId=${encodeURIComponent(id)}&projectCode=${projectCode}`,
        method: "GET",
      });
      const items = (res.data?.items || []).map((it, i) => ({
        slNo:        it.slNo  || i + 1,
        ccCode:      it.ccCode      || "",
        ccName:      it.ccName      || "",
        description: it.description || "",
        hsnSac:      it.hsnSac      || "",
        basicAmount: Number(it.basicAmount || 0),
      }));
      setValue("items", items, { shouldDirty: true });
      setValue("gstLines", DEFAULT_GST_LINES, { shouldDirty: true });
    } catch {
      toast.error("Failed to load certified bill items");
    } finally {
      setItemsLoading(false);
    }
  }, [projectCode, setValue]);

  // ── Load Detail (edit / view) ──────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !billId) return;
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.FINANCE.SALE_BILL.GET_BY_ID}${billId}`,
          method: "GET",
        });
        const d = res.data;
        const formatted = {
          mode:             d.mode            || "",
          certifiedBillId:  d.certifiedBillId || null,
          ogSaleOrderNo:    d.saleOrderNo     || d.ogSaleOrderNo || "",
          saleOrderDate:    d.saleOrderDate   || "",
          invoiceDate:      d.invoiceDate     || "",
          referenceNo:      d.referenceNo     || "",
          referenceDate:    d.referenceDate   || "",
          billToAddress:    d.billToAddress   || "",
          shipToAddress:    d.shipToAddress   || "",
          billAbstractNo:   d.billAbstractNo  || "",
          billAbstractDate: d.billAbstractDate || "",
          bankAcId:         d.bankAcId        || d.bankAc        || null,
          paymentTermsDays: parsePaymentTerms(d.paymentTerms),
          declaration:      d.declaration     || "",
          discount:         d.discount        ?? 0,
          roundOff:         d.roundOff        ?? 0,
          items: (d.items || []).map((it, i) => ({
            slNo:        it.slNo        || i + 1,
            ccCode:      it.ccCode      || "",
            ccName:      it.ccName      || "",
            description: it.description || "",
            hsnSac:      it.hsnSac      || "",
            basicAmount: Number(it.basicAmount || 0),
          })),
          gstLines: (d.gstLines || DEFAULT_GST_LINES).map((l) => ({
            gstType:     l.gstType     || "",
            ccCode:      l.ccCode      || "",
            ccName:      l.ccName      || "",
            description: l.description || "",
            percent:     Number(l.percent  || 0),
            gstAmount:   Number(l.gstAmount || 0),
            isSelected:  !!l.isSelected,
          })),
        };
        if (!formatted.items.length) formatted.items = [];
        reset(formatted);
        setInitialData(formatted);
        if (formatted.ogSaleOrderNo) fetchCertifiedBills(formatted.ogSaleOrderNo);
        const editable = ["draft", "reback"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("Sale Bill already Approved");
          else if (st === "Rejected") toast.info("Sale Bill already Rejected");
          else                         toast.info("Sale Bill already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Sale Bill");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [billId, mode]);

  // ── Edit / Cancel ──────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  // ── Build Payload ──────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v = getValues();
    const paymentTerms = v.paymentTermsDays ? `${v.paymentTermsDays} Days` : "";
    return {
      projectCode,
      mode:             v.mode,
      certifiedBillId:  Number(v.certifiedBillId),
      invoiceDate:      v.invoiceDate      || "",
      referenceNo:      v.referenceNo      || "",
      referenceDate:    v.referenceDate    || "",
      billToAddress:    v.billToAddress    || "",
      shipToAddress:    v.shipToAddress    || "",
      billAbstractNo:   v.billAbstractNo   || "",
      billAbstractDate: v.billAbstractDate || "",
      bankAc:           v.bankAcId         ? Number(v.bankAcId) : null,
      paymentTerms,
      declaration:      v.declaration      || "",
      discount:         Number(v.discount  || 0),
      roundOff:         Number(v.roundOff  || 0),
      items: (v.items || []).map((it, i) => ({
        slNo:        it.slNo || i + 1,
        ccCode:      it.ccCode,
        ccName:      it.ccName,
        description: it.description || "",
        hsnSac:      it.hsnSac      || "",
        basicAmount: Number(it.basicAmount || 0),
      })),
      gstLines: gstLinesComputed.map((l) => ({
        gstType:     l.gstType,
        ccCode:      l.ccCode,
        ccName:      l.ccName,
        description: l.description || "",
        percent:     l.percent,
        gstAmount:   l.gstAmount,
        isSelected:  !!l.isSelected,
      })),
    };
  };

  // ── Save Draft / Update ────────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url:    mode === "create"
          ? API_ENDPOINTS.FINANCE.SALE_BILL.CREATE
          : `${API_ENDPOINTS.FINANCE.SALE_BILL.EDIT}${billId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success(
        mode === "create" ? "Sale Bill created successfully" : "Sale Bill updated successfully",
        { id: tid },
      );
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/sale/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── Submit for Approval ────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!billId) { toast.error("Please save first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.SALE_BILL.SUBMIT}${billId}`,
        method: "POST",
      });
      toast.success("Sale Bill submitted for approval", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: tid });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      {/* Sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Hide left panel" : "Show left panel"}
        className="mb-2 hidden lg:inline-flex p-1 rounded hover:bg-gray-100 text-gray-500 transition"
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>
          <PMSection title="Invoice Details:">

            <PMFormRow label="Mode" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex-1">
                <SearchableSelect
                  options={SALE_BILL_MODES}
                  value={watch("mode") || ""}
                  disabled={disabled}
                  onChange={(value) => setValue("mode", value, { shouldDirty: true })}
                  placeholder="Select Mode"
                  labelKey="label"
                  valueKey="value"
                  searchKeys={["label", "value"]}
                />
                {errors.mode && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors.mode.message}</p>
                )}
              </div>
            </PMFormRow>

            <PMFormRow label="Invoice Number" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input
                type="text"
                value="[Auto]"
                disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
              />
            </PMFormRow>

            <PMFormRow label="Invoice Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput
                {...register("invoiceDate")}
                disabled={disabled}
                hasError={errors.invoiceDate}
                className="max-w-[200px]"
              />
              {errors.invoiceDate && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.invoiceDate.message}</p>
              )}
            </PMFormRow>

            <PMFormRow label="Reference No." labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input
                type="text"
                {...register("referenceNo")}
                disabled={disabled}
                placeholder="Text"
                className={`w-full h-[30px] text-[13px] rounded-sm border px-2 outline-none ${disabled ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500" : "border-[#8f8f8f] bg-white"}`}
              />
            </PMFormRow>

            <PMFormRow label="Reference Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput
                {...register("referenceDate")}
                disabled={disabled}
                className="max-w-[200px]"
              />
            </PMFormRow>
          </PMSection>

          <PMSection title="Sale Order:">
            <PMFormRow label="Sale Order No." required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex-1">
                <SearchableSelect
                  options={saleOrderOpts}
                  value={watch("ogSaleOrderNo") || ""}
                  disabled={disabled}
                  onChange={(value, opt) => handleOrderSelect(value, opt)}
                  placeholder="Select Order"
                  labelKey="displayLabel"
                  valueKey="ogSaleOrderNo"
                  searchKeys={["ogSaleOrderNo", "orderTitle", "displayLabel"]}
                />
                {errors.ogSaleOrderNo && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors.ogSaleOrderNo.message}</p>
                )}
              </div>
            </PMFormRow>

            <PMFormRow label="Sale Order Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input
                type="text"
                value={watch("saleOrderDate") || "[Auto]"}
                disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
              />
            </PMFormRow>

            <PMFormRow label="Certified Bill" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex-1">
                <SearchableSelect
                  options={certifiedBillOpts}
                  value={watch("certifiedBillId") || ""}
                  disabled={disabled || certifiedBillsLoading || itemsLoading || !watch("ogSaleOrderNo")}
                  onChange={(value, opt) => handleCertifiedBillSelect(value, opt)}
                  placeholder={
                    certifiedBillsLoading ? "Loading…" :
                    itemsLoading          ? "Loading items…" :
                    !watch("ogSaleOrderNo") ? "Select order first" :
                    "Select Certified Bill"
                  }
                  labelKey={["certifiedBillNo", "billingNo"]}
                  labelSeparator=""
                  valueKey="id"
                  searchKeys={["certifiedBillNo", "billingNo", "billAbstractNo", "title"]}
                />
                {errors.certifiedBillId && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors.certifiedBillId.message}</p>
                )}
              </div>
            </PMFormRow>

            <PMFormRow label="Bill To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="billToAddress"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Client address"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </PMFormRow>

            <PMFormRow label="Ship To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="shipToAddress"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Site address"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </PMFormRow>
          </PMSection>

          <PMSection title="Abstract & Bank:">
            <PMFormRow label="Bill Abstract No." labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input
                type="text"
                {...register("billAbstractNo")}
                disabled={disabled}
                placeholder="Auto from Certified Bill"
                className={`w-full h-[30px] text-[13px] rounded-sm border px-2 outline-none ${disabled ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500" : "border-[#8f8f8f] bg-white"}`}
              />
            </PMFormRow>

            <PMFormRow label="Bill Abstract Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput
                {...register("billAbstractDate")}
                disabled={disabled}
                className="max-w-[200px]"
              />
            </PMFormRow>

            <PMFormRow label="Bank A/c" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex-1">
                <SearchableSelect
                  options={bankOpts}
                  value={watch("bankAcId") || ""}
                  disabled={disabled}
                  onChange={(value) => setValue("bankAcId", value ? Number(value) : null, { shouldDirty: true })}
                  placeholder="Select Bank"
                  labelKey={["bankName", "bankAcNumber"]}
                  labelSeparator=" — "
                  valueKey="id"
                  searchKeys={["bankName", "bankCode", "bankAcNumber", "branchName"]}
                />
              </div>
            </PMFormRow>

            <PMFormRow label="Payment Terms" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex items-center gap-1.5 max-w-[180px]">
                <input
                  type="number"
                  min="0"
                  {...register("paymentTermsDays")}
                  disabled={disabled}
                  placeholder="Days"
                  className={`w-full h-[30px] text-[13px] rounded-sm border px-2 outline-none ${disabled ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500" : "border-[#8f8f8f] bg-white"}`}
                />
                <span className="text-[13px] text-[#444] whitespace-nowrap shrink-0">Days</span>
              </div>
            </PMFormRow>

            <PMFormRow label="Declaration" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="declaration"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Declaration text"
                    rows={3}
                    maxRows={8}
                  />
                )}
              />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* BASIC Table */}
          <div className="border border-[#b0c5d5] rounded-sm overflow-hidden bg-[#e8e8e8]">
            <div className="px-3 pt-2 pb-0.5">
              <span className="text-[15px] font-semibold text-[#1c3a5e]">BASIC</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#c8d8e8]">
                    <th className="border border-[#aec0cf] px-2 py-1.5 text-center w-[48px]">SL no</th>
                    <th className="border border-[#aec0cf] px-2 py-1.5 text-left w-[80px]">CC Code</th>
                    <th className="border border-[#aec0cf] px-2 py-1.5 text-left w-[160px]">CC Name</th>
                    <th className="border border-[#aec0cf] px-2 py-1.5 text-left">Description</th>
                    <th className="border border-[#aec0cf] px-2 py-1.5 text-left w-[90px]">HSN/SAC</th>
                    <th className="border border-[#aec0cf] px-2 py-1.5 text-right w-[120px]">Basic Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsLoading ? (
                    <tr>
                      <td colSpan={6} className="border border-[#aec0cf] px-3 py-4 text-center text-gray-400">
                        <Loader2 className="animate-spin w-4 h-4 inline mr-1" /> Loading items…
                      </td>
                    </tr>
                  ) : itemFields.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border border-[#aec0cf] px-3 py-4 text-center text-[#bbb] italic text-[12px]">
                        Select a certified bill to load items
                      </td>
                    </tr>
                  ) : (
                    itemFields.map((field, idx) => (
                      <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f4f8fc]"}>
                        <td className="border border-[#aec0cf] px-2 py-1 text-center">{idx + 1}</td>
                        <td className="border border-[#aec0cf] px-2 py-1">{watch(`items.${idx}.ccCode`)}</td>
                        <td className="border border-[#aec0cf] px-2 py-1">{watch(`items.${idx}.ccName`)}</td>
                        <td className="border border-[#aec0cf] p-0">
                          <Controller
                            name={`items.${idx}.description`}
                            control={control}
                            render={({ field: f }) => (
                              <ExpandableTextCell
                                value={f.value || ""}
                                onChange={disabled ? undefined : f.onChange}
                                disabled={disabled}
                                placeholder="Enter description"
                                label="Description"
                              />
                            )}
                          />
                        </td>
                        <td className="border border-[#aec0cf] p-0.5">
                          <input
                            type="text"
                            {...register(`items.${idx}.hsnSac`)}
                            disabled={disabled}
                            placeholder="HSN/SAC"
                            className={`w-full h-[28px] text-[12px] rounded-sm border-0 px-1.5 outline-none ${disabled ? "bg-[#edf8ed] text-gray-500" : "bg-transparent focus:bg-white focus:border focus:border-[#93b5cc]"}`}
                          />
                        </td>
                        <td className="border border-[#aec0cf] px-2 py-1 text-right font-medium">
                          {fmt(watch(`items.${idx}.basicAmount`))}
                        </td>
                      </tr>
                    ))
                  )}
                  {/* Total row */}
                  <tr className="bg-[#d4e4f0] font-semibold">
                    <td colSpan={5} className="border border-[#aec0cf] px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-[#aec0cf] px-2 py-1.5 text-right text-[12px]">{fmt(basicTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* GST Table */}
          <div className="border border-[#d0b8a0] rounded-sm overflow-hidden bg-[#f5ece5]">
            <div className="px-3 pt-2 pb-0.5">
              <span className="text-[15px] font-semibold text-[#5e2c1c]">GST</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#e8cfc0]">
                    <th className="border border-[#c8aa9a] px-2 py-1.5 text-center w-[60px]">Select</th>
                    <th className="border border-[#c8aa9a] px-2 py-1.5 text-left w-[80px]">CC Code</th>
                    <th className="border border-[#c8aa9a] px-2 py-1.5 text-left w-[140px]">CC Name</th>
                    <th className="border border-[#c8aa9a] px-2 py-1.5 text-left">Description</th>
                    <th className="border border-[#c8aa9a] px-2 py-1.5 text-center w-[60px]">%</th>
                    <th className="border border-[#c8aa9a] px-2 py-1.5 text-right w-[120px]">GST Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_GST_LINES.map((_, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf5f2]"}>
                      <td className="border border-[#c8aa9a] px-2 py-1 text-center">
                        <Controller
                          name={`gstLines.${idx}.isSelected`}
                          control={control}
                          render={({ field: f }) => (
                            <input
                              type="checkbox"
                              checked={!!f.value}
                              onChange={(e) => !disabled && f.onChange(e.target.checked)}
                              disabled={disabled}
                              className="w-4 h-4 accent-[#3b6ea5] cursor-pointer disabled:cursor-not-allowed"
                            />
                          )}
                        />
                      </td>
                      <td className="border border-[#c8aa9a] px-2 py-1">{watch(`gstLines.${idx}.ccCode`)}</td>
                      <td className="border border-[#c8aa9a] px-2 py-1">{watch(`gstLines.${idx}.ccName`)}</td>
                      <td className="border border-[#c8aa9a] p-0">
                        <Controller
                          name={`gstLines.${idx}.description`}
                          control={control}
                          render={({ field: f }) => (
                            <ExpandableTextCell
                              value={f.value || ""}
                              onChange={disabled ? undefined : f.onChange}
                              disabled={disabled}
                              placeholder="Description"
                              label="GST Description"
                            />
                          )}
                        />
                      </td>
                      <td className="border border-[#c8aa9a] px-2 py-1 text-center">{watch(`gstLines.${idx}.percent`)}%</td>
                      <td className="border border-[#c8aa9a] px-2 py-1 text-right font-medium">
                        {fmt(gstLinesComputed[idx]?.gstAmount || 0)}
                      </td>
                    </tr>
                  ))}
                  {/* GST Total */}
                  <tr className="bg-[#e8cfc0] font-semibold">
                    <td colSpan={5} className="border border-[#c8aa9a] px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-[#c8aa9a] px-2 py-1.5 text-right text-[12px]">{fmt(gstTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="border border-[#b0c5d5] rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-[13px]">
                <tbody>
                  <SummaryRow label="Basic Amount" value={fmt(basicTotal)} highlight="blue" />
                  <SummaryRow label="GST Amount"   value={fmt(gstTotal)}   highlight="orange" />
                  <SummaryRow
                    label="Discount"
                    highlight="none"
                    input={
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        {...register("discount")}
                        disabled={disabled}
                        placeholder="0.00"
                        className={`w-full h-[30px] text-[13px] text-right rounded-sm border px-2 outline-none ${disabled ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500" : "border-[#8f8f8f] bg-white"}`}
                      />
                    }
                  />
                  <SummaryRow
                    label="Round On/Off."
                    highlight="none"
                    input={
                      <input
                        type="number"
                        step="0.01"
                        {...register("roundOff")}
                        disabled={disabled}
                        placeholder="0.00"
                        className={`w-full h-[30px] text-[13px] text-right rounded-sm border px-2 outline-none ${disabled ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500" : "border-[#8f8f8f] bg-white"}`}
                      />
                    }
                  />
                  <SummaryRow label="Total Invoice Amount (Rs.)" value={fmt(totalInvoiceAmount)} highlight="total" />
                </tbody>
              </table>
            </div>

            {/* Amount in Words */}
            <div className="border-t border-[#b0c5d5] flex flex-col sm:flex-row sm:items-start">
              <div className="bg-[#d6e6f2] border-b sm:border-b-0 sm:border-r border-[#b0c5d5] px-3 py-2 shrink-0 sm:w-[200px]">
                <span className="text-[13px] font-semibold text-[#1c3a5e]">Amount (In word)</span>
              </div>
              <div className="flex-1 px-3 py-2 bg-[#fffde7]">
                <span className="text-[12px] text-[#555] italic leading-relaxed">
                  {totalInvoiceAmount ? amountToWordsIN(totalInvoiceAmount) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {mode !== "create" && (
                <EditButton
                  isEditing={isEditing}
                  onClick={handleEdit}
                  disabled={isSubmitted}
                />
              )}
              {isEditing && (
                <SaveDraftButton
                  onClick={handleSubmit(onSave)}
                  disabled={isSubmitting}
                />
              )}
              {allowSubmit && !isEditing && !isSubmitted && (
                <SaveButton
                  label="Submit"
                  onClick={onSubmitForApproval}
                  disabled={isSubmitting}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Row helper ────────────────────────────────────────────────────────

function SummaryRow({ label, value, highlight = "none", input }) {
  const labelBg =
    highlight === "blue"   ? "bg-[#d6e6f2] border-[#aec0cf]" :
    highlight === "orange" ? "bg-[#fde8d0] border-[#d0b8a0]" :
    highlight === "total"  ? "bg-[#c8dcc0] border-[#9ec09e]" :
    "bg-[#f0f0f0] border-[#c8c8c8]";

  const valueBg =
    highlight === "blue"   ? "bg-[#e8f4fd] text-[#1c3a5e] font-semibold" :
    highlight === "orange" ? "bg-[#fff0e5] text-[#5e2c1c] font-semibold" :
    highlight === "total"  ? "bg-[#e0f0d8] text-[#1c5e1c] font-bold text-[14px]" :
    "bg-white";

  return (
    <tr>
      <td className={`border border-[#b0c5d5] px-3 py-1.5 w-[55%] ${labelBg}`}>
        <span className="text-[13px] font-semibold">{label}</span>
      </td>
      <td className={`border border-[#b0c5d5] px-3 py-1 text-right ${valueBg}`}>
        {input ? input : <span className="text-[13px]">{value ?? "-"}</span>}
      </td>
    </tr>
  );
}
