"use client";

import { useEffect, useState, useCallback } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
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

// Source badge colours by index (cycles)
const SOURCE_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-800",
  "bg-emerald-100 border-emerald-300 text-emerald-800",
  "bg-amber-100 border-amber-300 text-amber-800",
  "bg-purple-100 border-purple-300 text-purple-800",
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const sourceSchema = z.object({
  saleOrderId:    z.coerce.number().nullable().optional(),
  erpDocNumber:   z.string().optional().default(""),
  saleOrderDate:  z.string().optional().default(""),
  certifiedBillId: z.coerce.number().nullable().optional(),
  certifiedBillNo: z.string().optional().default(""),
  billingDate:     z.string().optional().default(""),
  basicAmount:     z.coerce.number().min(0).default(0),
});

const itemSchema = z.object({
  slNo:        z.number(),
  ccCode:      z.string(),
  ccName:      z.string(),
  description: z.string().optional().default(""),
  hsnSac:      z.string().optional().default(""),
  basicAmount: z.coerce.number().min(0).default(0),
  sourceIndex: z.number().nullable().optional(),
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

const DEFAULT_SOURCE = {
  saleOrderId: null,
  erpDocNumber: "",
  saleOrderDate: "",
  certifiedBillId: null,
  certifiedBillNo: "",
  billingDate: "",
  basicAmount: 0,
};

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
  sources: [{ ...DEFAULT_SOURCE }],
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

  // Per-source dropdown state: saleOrderOpts is shared, certBillOpts and loading per index
  const [saleOrderOpts, setSaleOrderOpts]         = useState([]);
  const [certBillOptsMap, setCertBillOptsMap]     = useState({});   // { [sourceIdx]: [] }
  const [certBillLoadingMap, setCertBillLoadingMap] = useState({}); // { [sourceIdx]: bool }
  const [itemsLoadingMap, setItemsLoadingMap]     = useState({});   // { [sourceIdx]: bool }
  const [bankOpts, setBankOpts]                   = useState([]);

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

  const { fields: sourceFields, append: appendSource, remove: removeSource } =
    useFieldArray({ control, name: "sources" });
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

  // ── Fetch Certified Bills for a source index ────────────────────────────────
  const fetchCertifiedBills = useCallback(
    async (erpDocNumber, sourceIdx) => {
      if (!erpDocNumber || !projectCode) {
        setCertBillOptsMap((m) => ({ ...m, [sourceIdx]: [] }));
        return;
      }
      setCertBillLoadingMap((m) => ({ ...m, [sourceIdx]: true }));
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_BILL.CERTIFIED_BILLS}?erpDocNumber=${encodeURIComponent(erpDocNumber)}&projectCode=${projectCode}`,
          method: "GET",
        });
        setCertBillOptsMap((m) => ({
          ...m,
          [sourceIdx]: (Array.isArray(res.data) ? res.data : []).map((b) => ({
            ...b,
            displayLabel: b.erpNo ? `${b.billingNo} | ${b.erpNo}` : b.billingNo,
          })),
        }));
      } catch {
        setCertBillOptsMap((m) => ({ ...m, [sourceIdx]: [] }));
      } finally {
        setCertBillLoadingMap((m) => ({ ...m, [sourceIdx]: false }));
      }
    },
    [projectCode],
  );

  // ── Handle Sale Order selection for a source row ────────────────────────────
  const handleOrderSelect = useCallback(
    (value, option, sourceIdx) => {
      setValue(`sources.${sourceIdx}.erpDocNumber`, value, { shouldDirty: true });
      setValue(`sources.${sourceIdx}.saleOrderId`, option?.id || null, { shouldDirty: true });
      setValue(`sources.${sourceIdx}.saleOrderDate`, option?.ogSaleOrderDate || "", { shouldDirty: true });
      setValue(`sources.${sourceIdx}.certifiedBillId`, null, { shouldDirty: true });
      setValue(`sources.${sourceIdx}.certifiedBillNo`, "", { shouldDirty: true });
      setValue(`sources.${sourceIdx}.billingDate`, "", { shouldDirty: true });
      // Remove items that belong to this source
      const currentItems = getValues("items") || [];
      setValue("items", currentItems.filter((it) => it.sourceIndex !== sourceIdx), { shouldDirty: true });
      setCertBillOptsMap((m) => ({ ...m, [sourceIdx]: [] }));
      fetchCertifiedBills(value, sourceIdx);
    },
    [setValue, getValues, fetchCertifiedBills],
  );

  // ── Handle Certified Bill selection → load items for that source ────────────
  const handleCertifiedBillSelect = useCallback(
    async (id, option, sourceIdx) => {
      setValue(`sources.${sourceIdx}.certifiedBillId`, id ? Number(id) : null, { shouldDirty: true });
      setValue(`sources.${sourceIdx}.certifiedBillNo`, option?.billingNo || "", { shouldDirty: true });
      setValue(`sources.${sourceIdx}.billingDate`, option?.billingDate || "", { shouldDirty: true });

      // Set bill abstract from first source
      if (sourceIdx === 0) {
        setValue("billAbstractNo", option?.billingNo || "", { shouldDirty: true });
        setValue("billAbstractDate", option?.billingDate || "", { shouldDirty: true });
      }

      if (!id || !projectCode) return;
      setItemsLoadingMap((m) => ({ ...m, [sourceIdx]: true }));
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_BILL.CERTIFIED_BILL_ITEMS}?certifiedBillId=${encodeURIComponent(id)}&projectCode=${projectCode}`,
          method: "GET",
        });
        const newItems = (res.data?.items || []).map((it, i) => ({
          slNo: it.slNo || i + 1,
          ccCode: it.ccCode || "",
          ccName: it.ccName || "",
          description: it.description || "",
          hsnSac: it.hsnSac || "",
          basicAmount: Number(it.basicAmount || 0),
          sourceIndex: sourceIdx,
        }));

        // Merge: keep items from other sources + replace items from this source
        const existingItems = (getValues("items") || []).filter(
          (it) => it.sourceIndex !== sourceIdx,
        );
        const merged = [...existingItems, ...newItems];
        setValue("items", merged, { shouldDirty: true });

        // Update source basicAmount from sum of its items
        const srcBasic = newItems.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
        setValue(`sources.${sourceIdx}.basicAmount`, srcBasic, { shouldDirty: true });

        // Update GST from first loaded source (or aggregate)
        if (sourceIdx === 0 || existingItems.length === 0) {
          setValue("gstLines", mapApiGstLines(res.data?.gstLines), { shouldDirty: true });
          setActualGstTotal(igstEquivalent(res.data?.gstLines));
        }
      } catch {
        setActualGstTotal(null);
        toast.error("Failed to load certified bill items");
      } finally {
        setItemsLoadingMap((m) => ({ ...m, [sourceIdx]: false }));
      }
    },
    [projectCode, setValue, getValues],
  );

  // ── Add a new empty source row ──────────────────────────────────────────────
  const handleAddSource = () => {
    appendSource({ ...DEFAULT_SOURCE });
  };

  // ── Remove a source row and its items ──────────────────────────────────────
  const handleRemoveSource = (sourceIdx) => {
    const currentItems = getValues("items") || [];
    // Remove items for deleted source, re-index items from later sources
    const remaining = currentItems
      .filter((it) => it.sourceIndex !== sourceIdx)
      .map((it) => ({
        ...it,
        sourceIndex: it.sourceIndex > sourceIdx ? it.sourceIndex - 1 : it.sourceIndex,
      }));
    setValue("items", remaining, { shouldDirty: true });

    // Shift certBillOpts keys
    setCertBillOptsMap((m) => {
      const updated = {};
      Object.keys(m).forEach((k) => {
        const ki = Number(k);
        if (ki < sourceIdx) updated[ki] = m[k];
        else if (ki > sourceIdx) updated[ki - 1] = m[k];
      });
      return updated;
    });
    setCertBillLoadingMap((m) => {
      const updated = {};
      Object.keys(m).forEach((k) => {
        const ki = Number(k);
        if (ki < sourceIdx) updated[ki] = m[k];
        else if (ki > sourceIdx) updated[ki - 1] = m[k];
      });
      return updated;
    });

    removeSource(sourceIdx);
  };

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
            saleOrderId:     s.saleOrderId || null,
            erpDocNumber:    s.saleOrderNo || "",
            saleOrderDate:   "",
            certifiedBillId: s.certifiedBillId || null,
            certifiedBillNo: s.certifiedBillNo || "",
            billingDate:     s.billingDate || "",
            basicAmount:     Number(s.basicAmount || 0),
          }));
        } else {
          // Legacy single-source bill
          sourcesData = [{
            saleOrderId:     d.saleOrderId || null,
            erpDocNumber:    d.saleOrderNo || "",
            saleOrderDate:   "",
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
            slNo:        it.slNo || i + 1,
            ccCode:      it.ccCode || "",
            ccName:      it.ccName || "",
            description: it.description || "",
            hsnSac:      it.hsnSac || "",
            basicAmount: Number(it.basicAmount || 0),
            sourceIndex: it.sourceIndex ?? null,
          })),
          gstLines: d.gstLines?.length
            ? mapApiGstLines(d.gstLines, { keepSelection: true })
            : DEFAULT_GST_LINES,
        };
        reset(formatted);
        setInitialData(formatted);

        // Pre-load cert bill opts for each source
        sourcesData.forEach((src, idx) => {
          if (src.erpDocNumber) fetchCertifiedBills(src.erpDocNumber, idx);
        });

        const savedBasic = formatted.items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
        const igstPct  = Number(formatted.gstLines[0]?.percent || 0);
        const pairPct  = Number(formatted.gstLines[1]?.percent || 0) + Number(formatted.gstLines[2]?.percent || 0);
        const effPct   = igstPct > 0 ? igstPct : pairPct;
        setActualGstTotal(effPct > 0 && savedBasic > 0 ? (savedBasic * effPct) / 100 : null);

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
    const gstLines = v.gstLines || DEFAULT_GST_LINES;
    const basicTotal = (v.items || []).reduce((s, it) => s + Number(it.basicAmount || 0), 0);
    const isIGST    = !!gstLines[0]?.isSelected;
    const isCGSTSGST = !!gstLines[1]?.isSelected;
    const hasActual  = actualGstTotal !== null && actualGstTotal !== undefined;

    const computedGst = gstLines.map((l, i) => {
      let amt = 0;
      const legacy = (basicTotal * l.percent) / 100;
      if (i === 0 && isIGST)    amt = hasActual ? actualGstTotal : legacy;
      if (i === 1 && isCGSTSGST) amt = hasActual ? actualGstTotal / 2 : legacy;
      if (i === 2 && isCGSTSGST) amt = hasActual ? actualGstTotal / 2 : legacy;
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
        saleOrderId:     s.saleOrderId || null,
        saleOrderNo:     s.erpDocNumber || "",
        certifiedBillId: s.certifiedBillId ? Number(s.certifiedBillId) : null,
        certifiedBillNo: s.certifiedBillNo || "",
        basicAmount:     Number(s.basicAmount || 0),
      })),
      items: (v.items || []).map((it, i) => ({
        slNo:        it.slNo || i + 1,
        ccCode:      it.ccCode,
        ccName:      it.ccName,
        description: it.description || "",
        hsnSac:      it.hsnSac || "",
        basicAmount: Number(it.basicAmount || 0),
        sourceIndex: it.sourceIndex ?? null,
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

  const watchedSources = watch("sources") || [];

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

          {/* ── Sources Section ───────────────────────────────────────────── */}
          <PMSection title="Sources (Sale Orders & Certified Bills):">
            <div className="space-y-3 px-1">
              {sourceFields.map((field, sourceIdx) => {
                const colorClass = SOURCE_COLORS[sourceIdx % SOURCE_COLORS.length];
                const certOpts   = certBillOptsMap[sourceIdx] || [];
                const certLoading = certBillLoadingMap[sourceIdx] || false;
                const itmLoading  = itemsLoadingMap[sourceIdx] || false;
                const orderVal    = watchedSources[sourceIdx]?.erpDocNumber || "";
                const certVal     = watchedSources[sourceIdx]?.certifiedBillId || "";

                return (
                  <div
                    key={field.id}
                    className={`border rounded-md p-2 space-y-1.5 ${colorClass}`}
                  >
                    {/* Source header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide">
                        Source {sourceIdx + 1}
                      </span>
                      {sourceFields.length > 1 && !disabled && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSource(sourceIdx)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                          title="Remove source"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Sale Order */}
                    <div>
                      <p className="text-[11px] text-gray-600 mb-0.5">Sale Order</p>
                      <SearchableSelect
                        options={saleOrderOpts}
                        value={orderVal}
                        disabled={disabled}
                        onChange={(v, opt) => handleOrderSelect(v, opt, sourceIdx)}
                        placeholder="Select Sale Order"
                        labelKey="displayLabel"
                        valueKey="erpDocNumber"
                        searchKeys={["orderNo", "erpDocNumber", "displayLabel"]}
                      />
                    </div>

                    {/* Certified Bill */}
                    <div>
                      <p className="text-[11px] text-gray-600 mb-0.5">Certified Bill (Abstract No.)</p>
                      <SearchableSelect
                        options={certOpts}
                        value={certVal}
                        disabled={disabled || certLoading || itmLoading || !orderVal}
                        onChange={(v, opt) => handleCertifiedBillSelect(v, opt, sourceIdx)}
                        placeholder={
                          certLoading ? "Loading…"
                          : itmLoading ? "Loading items…"
                          : !orderVal ? "Select order first"
                          : "Select Certified Bill"
                        }
                        labelKey="displayLabel"
                        valueKey="id"
                        searchKeys={["billingNo", "erpNo", "displayLabel"]}
                      />
                    </div>

                    {/* Bill date auto-filled */}
                    {watchedSources[sourceIdx]?.billingDate && (
                      <p className="text-[11px] text-gray-500">
                        Date: {watchedSources[sourceIdx].billingDate}
                      </p>
                    )}

                    {itmLoading && (
                      <p className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Loader2 size={11} className="animate-spin" /> Loading items…
                      </p>
                    )}
                  </div>
                );
              })}

              {!disabled && (
                <button
                  type="button"
                  onClick={handleAddSource}
                  className="flex items-center gap-1.5 text-[12px] text-blue-600 hover:text-blue-800 font-medium mt-1"
                >
                  <Plus size={13} /> Add Another Source
                </button>
              )}
            </div>
          </PMSection>

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
            itemsLoading={Object.values(itemsLoadingMap).some(Boolean)}
            itemFields={itemFields}
            actualGstTotal={actualGstTotal}
            sources={watchedSources}
            sourceColors={SOURCE_COLORS}
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
