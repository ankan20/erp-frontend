"use client";

import { useEffect, useState, useCallback } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection from "@/components/project-management/common/PMSection";
import PMFormRow from "@/components/project-management/common/PMFormRow";
import PMDateInput from "@/components/project-management/common/PMDateInput";
import PMTextarea from "@/components/project-management/common/PMTextarea";
import PMInput from "@/components/project-management/common/PMInput";

import AccountSummary from "@/components/finance/account/common/AccountSummary";
import SaleBillSourceTree from "@/components/finance/account/sale/SaleBillSourceTree";
import SaleBillBasicGstTable from "@/components/finance/account/sale/SaleBillBasicGstTable";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate } from "@/lib/dateUtils";
import AiPanel from "@/components/ai/AiPanel";

const SALE_BILL_MODES = [
  { label: "Sale Invoice",     value: "Sale Invoice" },
  { label: "Proforma Invoice", value: "Proforma Invoice" },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const sourceSchema = z.object({
  saleOrderId:       z.coerce.number().nullable().optional(),
  saleOrderNo:       z.string().optional().default(""),
  certifiedBillId:   z.coerce.number().nullable().optional(),
  certifiedBillNo:   z.string().optional().default(""),
  billingDate:       z.string().optional().default(""),
  basicAmount:       z.coerce.number().min(0).default(0),
  gstAmount:         z.coerce.number().min(0).default(0),
  gstType:           z.string().optional().default("IGST"),
  hsnSac:            z.string().optional().default(""),
  thisBillClaim:     z.coerce.number().optional().default(0),
  thisBillGstAmount: z.coerce.number().optional().default(0),
});

const schema = z.object({
  mode:             z.string().min(1, "Mode is required"),
  invoiceDate:      zodDate(z, "invoiceDate", true),
  referenceNo:      z.string().optional().default(""),
  referenceDate:    zodDate(z, "referenceDate"),
  billToAddress:    z.string().optional().default(""),
  shipToAddress:    z.string().optional().default(""),
  billAbstractNo:   z.string().optional().default(""),
  billAbstractDate: zodDate(z, "billAbstractDate"),
  bankAcId:         z.coerce.number().nullable().optional(),
  paymentTermsDays: z.string().optional().default(""),
  declaration:      z.string().optional().default(""),
  discount:         z.coerce.number().min(0).default(0),
  roundOff:         z.coerce.number().default(0),
  sources:          z.array(sourceSchema).min(1, "At least one source required"),
});

const DEFAULT_VALUES = {
  mode: "",
  invoiceDate: "",
  referenceNo: "",
  referenceDate: "",
  billToAddress: "",
  shipToAddress: "",
  billAbstractNo: "",
  billAbstractDate: "",
  bankAcId: null,
  paymentTermsDays: "",
  declaration: "",
  discount: 0,
  roundOff: 0,
  sources: [],
};

const parsePaymentTerms = (val) =>
  val ? String(val).replace(/\s*[Dd]ays?\s*$/, "").trim() : "";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaleBillForm({
  mode = "create",
  billId,
  onAfterSubmit,
  onUuid,
}) {
  const isViewMode = mode === "view" || mode === "approver";
  const router = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [isLoading,   setIsLoading]   = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [erpBillNo,   setErpBillNo]   = useState("");

  const [saleOrderOpts, setSaleOrderOpts] = useState([]);
  const [bankOpts,      setBankOpts]      = useState([]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: sourceFields } = useFieldArray({ control, name: "sources" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  const sources  = watch("sources") || [];
  const discount = Number(watch("discount") || 0);
  const roundOff = Number(watch("roundOff") || 0);

  const basicTotal = sources.reduce((s, r) => s + Number(r?.basicAmount || 0), 0);
  const gstTotal   = sources.reduce((s, r) => {
    const gstType = r?.gstType || "IGST";
    const gstAmt  = Number(r?.gstAmount || 0);
    return s + gstAmt;
  }, 0);
  const totalInvoice = basicTotal + gstTotal - discount + roundOff;

  // Auto round-off
  useEffect(() => {
    const subtotal = basicTotal + gstTotal - discount;
    const auto = parseFloat((Math.round(subtotal) - subtotal).toFixed(2));
    setValue("roundOff", auto, { shouldDirty: false });
  }, [basicTotal, gstTotal, discount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch OG Sale Orders ────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.LIST}?projectCode=${projectCode}&workflowStatus=Approved`,
      method: "GET",
    })
      .then((res) => {
        const orders = (Array.isArray(res.data) ? res.data : []).map((o) => ({
          ...o,
          displayLabel: o.orderNo ? `${o.orderNo} | ${o.erpDocNumber}` : o.erpDocNumber,
        }));
        setSaleOrderOpts(orders);
      })
      .catch(() => setSaleOrderOpts([]));
  }, [projectCode]);

  // ── Fetch Bank List ─────────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.BANK_CASH.LIST, method: "GET" })
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : [];
        setBankOpts(all.filter((b) => b.type === "BANK"));
      })
      .catch(() => setBankOpts([]));
  }, []);

  // ── Tree selection → sources ───────────────────────────────────────────────
  const handleTreeSelectionChange = useCallback(
    ({ sources: newSources }) => {
      // Preserve gstType from existing sources if same cert bill
      const existingSources = getValues("sources") || [];
      const gstTypeMap = {};
      const hsnSacMap  = {};
      for (const s of existingSources) {
        if (s.certifiedBillId) {
          gstTypeMap[s.certifiedBillId] = s.gstType || "IGST";
          hsnSacMap[s.certifiedBillId]  = s.hsnSac  || "";
        }
      }
      const merged = newSources.map((s) => ({
        ...s,
        gstType: gstTypeMap[s.certifiedBillId] || "IGST",
        hsnSac:  hsnSacMap[s.certifiedBillId]  || "",
      }));
      setValue("sources", merged, { shouldDirty: true });

      if (merged[0]?.certifiedBillNo) {
        setValue("billAbstractNo",   merged[0].certifiedBillNo, { shouldDirty: false });
        setValue("billAbstractDate", merged[0].billingDate || "", { shouldDirty: false });
      }
    },
    [setValue, getValues],
  );

  // ── GST type change per source row ─────────────────────────────────────────
  const handleGstTypeChange = useCallback((idx, gstType) => {
    const src = (getValues("sources") || [])[idx];
    if (!src) return;
    setValue(`sources.${idx}.gstType`, gstType, { shouldDirty: true });
  }, [setValue, getValues]);

  // ── Load Detail ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !billId) return;
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_BILL.GET_BY_ID}${billId}`,
          method: "GET",
        });
        const d = res.data;

        let sourcesData = [];
        if (Array.isArray(d.sources) && d.sources.length > 0) {
          sourcesData = d.sources.map((s) => ({
            saleOrderId:       s.saleOrderId     || null,
            saleOrderNo:       s.saleOrderNo     || "",
            certifiedBillId:   s.certifiedBillId || null,
            certifiedBillNo:   s.certifiedBillNo || "",
            billingDate:       s.billingDate     || "",
            basicAmount:       Number(s.basicAmount || 0),
            gstAmount:         Number(s.gstAmount   || 0),
            gstType:           s.gstType          || "IGST",
            hsnSac:            s.hsnSac           || "",
            thisBillClaim:     Number(s.thisBillClaim     || 0),
            thisBillGstAmount: Number(s.thisBillGstAmount || 0),
          }));
        } else {
          sourcesData = [{
            saleOrderId:       d.saleOrderId     || null,
            saleOrderNo:       d.saleOrderNo     || "",
            certifiedBillId:   d.certifiedBillId || null,
            certifiedBillNo:   d.certifiedBillNo || "",
            billingDate:       "",
            basicAmount:       0,
            gstAmount:         0,
            gstType:           "IGST",
            hsnSac:            "",
            thisBillClaim:     0,
            thisBillGstAmount: 0,
          }];
        }

        const formatted = {
          mode:             d.mode || "",
          invoiceDate:      d.invoiceDate || "",
          referenceNo:      d.referenceNo || "",
          referenceDate:    d.referenceDate || "",
          billToAddress:    d.billToAddress || "",
          shipToAddress:    d.shipToAddress || "",
          billAbstractNo:   d.billAbstractNo || "",
          billAbstractDate: d.billAbstractDate || "",
          bankAcId:         d.bankAcId || null,
          paymentTermsDays: parsePaymentTerms(d.paymentTerms),
          declaration:      d.declaration || "",
          discount:         d.discount ?? 0,
          roundOff:         d.roundOff ?? 0,
          sources: sourcesData,
        };
        reset(formatted);
        setInitialData(formatted);

        if (d.saleBillNo) setErpBillNo(d.saleBillNo);
        if (d.saleBillUuid && onUuid) onUuid(d.saleBillUuid);

        const editable = ["draft", "reback"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if (st === "Approved") toast.info("Sale Bill already Approved");
          else if (st === "Rejected") toast.info("Sale Bill already Rejected");
          else toast.info("Sale Bill already Submitted");
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
  }, [billId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Build payload ───────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v = getValues();
    const srcs = v.sources || [];

    // Build gstLines from sources for backend compatibility
    const igstTotal  = srcs.reduce((s, r) => (r?.gstType || "IGST") === "IGST"     ? s + Number(r.gstAmount || 0) : s, 0);
    const cgstSgstTotal = srcs.reduce((s, r) => r?.gstType === "CGST_SGST" ? s + Number(r.gstAmount || 0) : s, 0);
    const hasIGST    = srcs.some((r) => (r?.gstType || "IGST") === "IGST");
    const hasCGST    = srcs.some((r) => r?.gstType === "CGST_SGST");

    const gstLines = [
      {
        gstType: "IGST", ccCode: "CRIN", ccName: "Output-IGST", description: "",
        percent: 0, gstAmount: hasIGST ? igstTotal : 0, isSelected: hasIGST,
      },
      {
        gstType: "CGST", ccCode: "CRIN", ccName: "Output-CGST", description: "",
        percent: 0, gstAmount: hasCGST ? cgstSgstTotal / 2 : 0, isSelected: hasCGST,
      },
      {
        gstType: "SGST", ccCode: "CRIN", ccName: "Output-SGST", description: "",
        percent: 0, gstAmount: hasCGST ? cgstSgstTotal / 2 : 0, isSelected: hasCGST,
      },
    ];

    // Build items: one per source (cert bill level)
    const items = srcs.map((s, i) => ({
      slNo:          i + 1,
      ccCode:        "CRIN",
      ccName:        s.certifiedBillNo || "",
      description:   "",
      hsnSac:        s.hsnSac || "",
      basicAmount:   Number(s.basicAmount || 0),
      gstPercent:    0,
      billingItemId: null,
      sourceIndex:   i,
    }));

    const basicTotal   = srcs.reduce((s, r) => s + Number(r?.basicAmount || 0), 0);
    const gstTotal     = srcs.reduce((s, r) => s + Number(r?.gstAmount   || 0), 0);
    const totalInvoice = basicTotal + gstTotal - Number(v.discount || 0) + Number(v.roundOff || 0);

    return {
      projectCode,
      mode:             v.mode,
      invoiceDate:      v.invoiceDate || "",
      referenceNo:      v.referenceNo || "",
      referenceDate:    v.referenceDate || "",
      billToAddress:    v.billToAddress || "",
      shipToAddress:    v.shipToAddress || "",
      billAbstractNo:   v.billAbstractNo || "",
      billAbstractDate: v.billAbstractDate || "",
      bankAc:           v.bankAcId ? Number(v.bankAcId) : null,
      paymentTerms:     v.paymentTermsDays ? `${v.paymentTermsDays} Days` : "",
      declaration:      v.declaration || "",
      discount:         Number(v.discount || 0),
      roundOff:         Number(v.roundOff || 0),
      sources: srcs.map((s) => ({
        saleOrderId:     s.saleOrderId     || null,
        saleOrderNo:     s.saleOrderNo     || "",
        certifiedBillId: s.certifiedBillId ? Number(s.certifiedBillId) : null,
        certifiedBillNo: s.certifiedBillNo || "",
        basicAmount:     Number(s.basicAmount || 0),
        gstAmount:       Number(s.gstAmount   || 0),
        gstType:         s.gstType || "IGST",
        hsnSac:          s.hsnSac  || "",
      })),
      items,
      gstLines,
    };
  };

  // ── Save Draft ──────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url: mode === "create"
          ? API_ENDPOINTS.FINANCE.SALE_BILL.CREATE
          : `${API_ENDPOINTS.FINANCE.SALE_BILL.EDIT}${billId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success(mode === "create" ? "Sale Bill created" : "Sale Bill updated", { id: tid });
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/sale/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── Submit for Approval ─────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!billId) { toast.error("Please save first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.SALE_BILL.SUBMIT}${billId}`,
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 space-y-3">

      {/* ── TOP: Mode + Invoice Details (two columns) ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PMSection title="Mode:">
          <PMFormRow label="Mode" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
            <div className="flex-1">
              <SearchableSelect
                options={SALE_BILL_MODES}
                value={watch("mode") || ""}
                disabled={disabled}
                onChange={(v) => setValue("mode", v, { shouldDirty: true })}
                placeholder="Sale Invoice / Proforma Invoice"
                labelKey="label"
                valueKey="value"
                searchKeys={["label"]}
              />
            </div>
          </PMFormRow>
        </PMSection>

        <PMSection title="Invoice Details:">
          <PMFormRow label="Invoice Number" labelWidth="sm:w-[150px] sm:min-w-[150px]">
            <PMInput value={erpBillNo || "[Auto]"} disabled readOnly />
          </PMFormRow>
          <PMFormRow label="Invoice Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
            <PMDateInput {...register("invoiceDate")} disabled={disabled} hasError={errors.invoiceDate} className="max-w-[200px]" />
          </PMFormRow>
          <PMFormRow label="Reference No." labelWidth="sm:w-[150px] sm:min-w-[150px]">
            <PMInput {...register("referenceNo")} disabled={disabled} placeholder="Reference No." fieldLabel="Reference No." />
          </PMFormRow>
          <PMFormRow label="Reference Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
            <PMDateInput {...register("referenceDate")} disabled={disabled} className="max-w-[200px]" />
          </PMFormRow>
        </PMSection>
      </div>

      {/* ── SOURCE SELECTION (full width, above BASIC) ────────────────────── */}
      <SaleBillSourceTree
        saleOrders={saleOrderOpts}
        projectCode={projectCode}
        disabled={disabled}
        onSelectionChange={handleTreeSelectionChange}
        initialSources={mode !== "create" ? (watch("sources") || []) : []}
      />

      {/* ── BASIC + GST table (full width) ────────────────────────────────── */}
      <SaleBillBasicGstTable
        sources={sources}
        disabled={disabled}
        register={register}
        watch={watch}
        onGstTypeChange={handleGstTypeChange}
      />

      {/* ── Bottom details: Addresses + Bill Abstract + Bank (three columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <PMSection title="Addresses:">
          <PMFormRow label="Bill To Address" labelWidth="sm:w-[120px] sm:min-w-[120px]">
            <Controller
              name="billToAddress"
              control={control}
              render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Client address" rows={2} maxRows={5} />
              )}
            />
          </PMFormRow>
          <PMFormRow label="Ship To Address" labelWidth="sm:w-[120px] sm:min-w-[120px]">
            <Controller
              name="shipToAddress"
              control={control}
              render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Site address" rows={2} maxRows={5} />
              )}
            />
          </PMFormRow>
        </PMSection>

        <PMSection title="Bill Abstract:">
          <PMFormRow label="Abstract No." labelWidth="sm:w-[110px] sm:min-w-[110px]">
            <PMInput {...register("billAbstractNo")} disabled={disabled} placeholder="[Auto from Source 1]" />
          </PMFormRow>
          <PMFormRow label="Abstract Date" labelWidth="sm:w-[110px] sm:min-w-[110px]">
            <PMInput value={watch("billAbstractDate") || "[Auto]"} disabled readOnly />
          </PMFormRow>
        </PMSection>

        <PMSection title="Bank & Payment:">
          <PMFormRow label="Bank A/c" labelWidth="sm:w-[110px] sm:min-w-[110px]">
            <div className="flex-1">
              <SearchableSelect
                options={bankOpts}
                value={watch("bankAcId") || ""}
                disabled={disabled}
                onChange={(v) => setValue("bankAcId", v ? Number(v) : null, { shouldDirty: true })}
                placeholder="Select Bank"
                labelKey={["bankName", "bankAcNumber"]}
                labelSeparator=" — "
                valueKey="id"
                searchKeys={["bankName", "bankCode", "bankAcNumber", "branchName"]}
              />
            </div>
          </PMFormRow>
          <PMFormRow label="Payment Terms" labelWidth="sm:w-[110px] sm:min-w-[110px]">
            <div className="flex items-center gap-1.5 max-w-[180px]">
              <PMInput type="number" min="0" {...register("paymentTermsDays")} disabled={disabled} placeholder="e.g. 30" fieldLabel="Payment Terms (Days)" />
              <span className="text-[13px] text-[#444] shrink-0">Days</span>
            </div>
          </PMFormRow>
          <PMFormRow label="Declaration" labelWidth="sm:w-[110px] sm:min-w-[110px]">
            <Controller
              name="declaration"
              control={control}
              render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Declaration text" rows={3} maxRows={8} />
              )}
            />
          </PMFormRow>
        </PMSection>
      </div>

      {/* ── Summary ───────────────────────────────────────────────────────── */}
      <AccountSummary
        basicTotal={basicTotal}
        gstTotal={gstTotal}
        totalInvoice={totalInvoice}
        register={register}
        watch={watch}
        disabled={disabled}
      />

      {/* ── Action Buttons ────────────────────────────────────────────────── */}
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
            confirmationTitle="Submit Sale Bill?"
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
            <DeleteRequestButton moduleCode="SALE_BILL" recordId={Number(billId)} onDeleted={() => router.back()} />
          )}
        </div>
      )}

      <AiPanel
        projectCode={projectCode}
        endpoint={API_ENDPOINTS.AI.SUGGEST_SALE_BILL}
        method="POST"
        onApply={() => {}}
        applyLabel="Use this suggestion"
        title="Sale Bill AI"
      />
    </div>
  );
}
