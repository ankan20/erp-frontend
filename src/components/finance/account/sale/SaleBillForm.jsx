"use client";

import { useEffect, useState, useCallback } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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

import SaleBillRightPanel, {
  DEFAULT_GST_LINES,
  mapApiGstLines,
  igstEquivalent,
} from "@/components/finance/account/common/SaleBillRightPanel";

import SaleBillSourceTree from "@/components/finance/account/sale/SaleBillSourceTree";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate } from "@/lib/dateUtils";
import AiPanel from "@/components/ai/AiPanel";

// ─── Constants ────────────────────────────────────────────────────────────────

const SALE_BILL_MODES = [
  { label: "Sale Invoice", value: "Sale Invoice" },
  { label: "Proforma Invoice", value: "Proforma Invoice" },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const sourceSchema = z.object({
  saleOrderId:     z.coerce.number().nullable().optional(),
  saleOrderNo:     z.string().optional().default(""),
  certifiedBillId: z.coerce.number().nullable().optional(),
  certifiedBillNo: z.string().optional().default(""),
  billingDate:     z.string().optional().default(""),
  basicAmount:     z.coerce.number().min(0).default(0),
});

const itemSchema = z.object({
  slNo:           z.number(),
  ccCode:         z.string(),
  ccName:         z.string(),
  description:    z.string().optional().default(""),
  hsnSac:         z.string().optional().default(""),
  basicAmount:    z.coerce.number().min(0).default(0),
  gstPercent:     z.coerce.number().min(0).default(0),
  billingItemId:  z.number().nullable().optional(),
  certBillId:     z.number().nullable().optional(),
  sourceIndex:    z.number().nullable().optional(),
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
  items:            z.array(itemSchema).min(1, "At least one item required"),
  gstLines:         z.array(gstLineSchema).length(3),
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
  items: [],
  gstLines: DEFAULT_GST_LINES,
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

  const [isEditing, setIsEditing]       = useState(mode === "create");
  const [isSubmitted, setIsSubmitted]   = useState(false);
  const [allowSubmit, setAllowSubmit]   = useState(mode === "edit");
  const [isLoading, setIsLoading]       = useState(false);
  const [initialData, setInitialData]   = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [erpBillNo, setErpBillNo]       = useState("");
  const [actualGstTotal, setActualGstTotal] = useState(null);

  const [saleOrderOpts, setSaleOrderOpts] = useState([]);
  const [bankOpts, setBankOpts]           = useState([]);

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

  const { fields: itemFields } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

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

  // ── Handle tree selection changes ─────────────────────────────────────────
  const handleTreeSelectionChange = useCallback(
    ({ items, sources }) => {
      setValue("items",   items,   { shouldDirty: true });
      setValue("sources", sources, { shouldDirty: true });

      // Compute per-item GST total for the right panel
      const perItemGst = items.reduce((sum, it) => {
        return sum + (Number(it.basicAmount || 0) * Number(it.gstPercent || 0)) / 100;
      }, 0);
      setActualGstTotal(perItemGst > 0 ? perItemGst : null);

      // Set bill abstract from first source (auto-fill)
      if (sources[0]?.certifiedBillNo) {
        setValue("billAbstractNo",   sources[0].certifiedBillNo, { shouldDirty: false });
        setValue("billAbstractDate", sources[0].billingDate || "", { shouldDirty: false });
      }
    },
    [setValue],
  );

  // ── Load Detail (edit / view) ───────────────────────────────────────────────
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

        // Build sources from API response
        let sourcesData = [];
        if (Array.isArray(d.sources) && d.sources.length > 0) {
          sourcesData = d.sources.map((s) => ({
            saleOrderId:     s.saleOrderId     || null,
            saleOrderNo:     s.saleOrderNo     || "",
            certifiedBillId: s.certifiedBillId || null,
            certifiedBillNo: s.certifiedBillNo || "",
            billingDate:     s.billingDate     || "",
            basicAmount:     Number(s.basicAmount || 0),
          }));
        } else {
          // Legacy single-source bill
          sourcesData = [{
            saleOrderId:     d.saleOrderId     || null,
            saleOrderNo:     d.saleOrderNo     || "",
            certifiedBillId: d.certifiedBillId || null,
            certifiedBillNo: d.certifiedBillNo || "",
            billingDate:     "",
            basicAmount:     0,
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
          items: (d.items || []).map((it, i) => ({
            slNo:          it.slNo || i + 1,
            ccCode:        it.ccCode || "",
            ccName:        it.ccName || "",
            description:   it.description || "",
            hsnSac:        it.hsnSac || "",
            basicAmount:   Number(it.basicAmount || 0),
            gstPercent:    Number(it.gstPercent  || 0),
            billingItemId: it.billingItemId || null,
            certBillId:    null,
            sourceIndex:   it.sourceIndex ?? null,
          })),
          gstLines: d.gstLines?.length
            ? mapApiGstLines(d.gstLines, { keepSelection: true })
            : DEFAULT_GST_LINES,
        };
        reset(formatted);
        setInitialData(formatted);

        // Compute per-item GST total for right panel
        const perItemGst = formatted.items.reduce((s, it) => {
          return s + (Number(it.basicAmount || 0) * Number(it.gstPercent || 0)) / 100;
        }, 0);
        if (perItemGst > 0) {
          setActualGstTotal(perItemGst);
        } else {
          const savedBasic = formatted.items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
          const igstPct    = Number(formatted.gstLines[0]?.percent || 0);
          const pairPct    = Number(formatted.gstLines[1]?.percent || 0) + Number(formatted.gstLines[2]?.percent || 0);
          const effPct     = igstPct > 0 ? igstPct : pairPct;
          setActualGstTotal(effPct > 0 && savedBasic > 0 ? (savedBasic * effPct) / 100 : null);
        }

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

  // ── Edit / Cancel ───────────────────────────────────────────────────────────
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
    const gstLines   = v.gstLines || DEFAULT_GST_LINES;
    const items      = v.items    || [];
    const basicTotal = items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);

    // Per-item GST aggregation: sum item.basicAmount × item.gstPercent/100
    const perItemGstTotal = items.reduce((s, it) => {
      return s + (Number(it.basicAmount || 0) * Number(it.gstPercent || 0)) / 100;
    }, 0);

    const hasPerItem  = perItemGstTotal > 0;
    const isIGST      = !!gstLines[0]?.isSelected;
    const isCGSTSGST  = !!gstLines[1]?.isSelected;
    const hasActual   = actualGstTotal !== null && actualGstTotal !== undefined;
    const gstTotal    = hasPerItem ? perItemGstTotal : (hasActual ? actualGstTotal : 0);

    // Build gst lines for backend: use per-item total; fall back to form values
    const computedGst = gstLines.map((l, i) => {
      let amt = 0;
      const legacy = (basicTotal * l.percent) / 100;
      if (i === 0 && isIGST)     amt = hasPerItem ? gstTotal     : (hasActual ? actualGstTotal     : legacy);
      if (i === 1 && isCGSTSGST) amt = hasPerItem ? gstTotal / 2 : (hasActual ? actualGstTotal / 2 : legacy);
      if (i === 2 && isCGSTSGST) amt = hasPerItem ? gstTotal / 2 : (hasActual ? actualGstTotal / 2 : legacy);
      return { ...l, gstAmount: amt, isSelected: i === 0 ? isIGST : isCGSTSGST };
    });

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
      sources: (v.sources || []).map((s) => ({
        saleOrderId:     s.saleOrderId     || null,
        saleOrderNo:     s.saleOrderNo     || "",
        certifiedBillId: s.certifiedBillId ? Number(s.certifiedBillId) : null,
        certifiedBillNo: s.certifiedBillNo || "",
        basicAmount:     Number(s.basicAmount || 0),
      })),
      items: items.map((it, i) => ({
        slNo:          it.slNo || i + 1,
        ccCode:        it.ccCode      || "CRIN",
        ccName:        it.ccName      || "",
        description:   it.description || "",
        hsnSac:        it.hsnSac      || "",
        basicAmount:   Number(it.basicAmount  || 0),
        gstPercent:    Number(it.gstPercent   || 0),
        billingItemId: it.billingItemId || null,
        sourceIndex:   it.sourceIndex  ?? null,
      })),
      gstLines: computedGst.map((l) => ({
        gstType:     l.gstType,
        ccCode:      l.ccCode,
        ccName:      l.ccName,
        description: l.description || "",
        percent:     l.percent,
        gstAmount:   l.gstAmount,
        isSelected:  l.isSelected,
      })),
    };
  };

  // ── Save Draft / Update ─────────────────────────────────────────────────────
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
        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          {/* Mode */}
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

          {/* Invoice Details */}
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

          {/* ── Sources Section: Hierarchical Tree ───────────────────────── */}
          <div className="mt-1">
            <SaleBillSourceTree
              saleOrders={saleOrderOpts}
              projectCode={projectCode}
              disabled={disabled}
              onSelectionChange={handleTreeSelectionChange}
              initialItems={mode !== "create" ? (watch("items") || []) : []}
              initialSources={mode !== "create" ? (watch("sources") || []) : []}
            />
          </div>

          {/* Bill To / Ship To */}
          <PMSection title="Addresses:">
            <PMFormRow label="Bill To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="billToAddress"
                control={control}
                render={({ field }) => (
                  <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Client address" rows={2} maxRows={5} />
                )}
              />
            </PMFormRow>
            <PMFormRow label="Ship To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="shipToAddress"
                control={control}
                render={({ field }) => (
                  <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Site address" rows={2} maxRows={5} />
                )}
              />
            </PMFormRow>
          </PMSection>

          {/* Bill Abstract (auto from first source) */}
          <PMSection title="Bill Abstract:">
            <PMFormRow label="Abstract No." labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput {...register("billAbstractNo")} disabled={disabled} placeholder="[Auto from Source 1]" />
            </PMFormRow>
            <PMFormRow label="Abstract Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={watch("billAbstractDate") || "[Auto]"} disabled readOnly />
            </PMFormRow>
          </PMSection>

          {/* Bank & Payment */}
          <PMSection title="Bank & Payment:">
            <PMFormRow label="Bank A/c" labelWidth="sm:w-[150px] sm:min-w-[150px]">
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
            <PMFormRow label="Payment Terms" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex items-center gap-1.5 max-w-[180px]">
                <PMInput type="number" min="0" {...register("paymentTermsDays")} disabled={disabled} placeholder="e.g. 30" fieldLabel="Payment Terms (Days)" />
                <span className="text-[13px] text-[#444] shrink-0">Days</span>
              </div>
            </PMFormRow>
            <PMFormRow label="Declaration" labelWidth="sm:w-[150px] sm:min-w-[150px]">
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

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">
          <SaleBillRightPanel
            control={control}
            watch={watch}
            setValue={setValue}
            register={register}
            disabled={disabled}
            itemsLoading={false}
            itemFields={itemFields}
            actualGstTotal={actualGstTotal}
            sources={[]}
            sourceColors={[]}
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
        </div>
      </div>

      {/* AI Assistant Panel */}
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
