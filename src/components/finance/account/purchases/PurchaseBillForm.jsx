"use client";

import { useCallback, useEffect, useState } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }              from "zod";
import { zodResolver }    from "@hookform/resolvers/zod";
import { toast }          from "sonner";
import { useRouter }      from "next/navigation";
import { Loader2, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";

import SaveButton          from "@/components/common/SaveButton";
import SaveDraftButton     from "@/components/common/SaveDraftButton";
import EditButton          from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";
import SearchableSelect    from "@/components/common/SearchableSelect";
import PMSection           from "@/components/project-management/common/PMSection";
import PMFormRow           from "@/components/project-management/common/PMFormRow";
import PMDateInput         from "@/components/project-management/common/PMDateInput";
import PMTextarea          from "@/components/project-management/common/PMTextarea";
import PMInput             from "@/components/project-management/common/PMInput";

import SaleBillRightPanel, {
  DEFAULT_GST_LINES,
  mapApiGstLines,
  igstEquivalent,
} from "@/components/finance/account/common/SaleBillRightPanel";

import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import AiPanel           from "@/components/ai/AiPanel";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate }       from "@/lib/dateUtils";

const PURCHASE_BILL_MODES = [
  { label: "Purchases Invoice", value: "purchase_invoice" },
  { label: "Proforma Invoice",  value: "proforma_invoice" },
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
  orderId:   z.coerce.number().nullable().optional(),
  orderType: z.string().optional().default(""),
  orderNo:   z.string().optional().default(""),
  brrId:     z.coerce.number().nullable().optional(),
  brrNo:     z.string().optional().default(""),
  brrDate:   z.string().optional().default(""),
  basicAmount: z.coerce.number().min(0).default(0),
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
  mode:           z.string().min(1, "Mode is required"),
  vendorId:       z.coerce.number().min(1, "Party is required"),
  processingDate: zodDate(z, "processingDate", true),
  vendorBillNo:   z.string().optional().default(""),
  vendorBillDate: zodDate(z, "vendorBillDate"),
  remarks:        z.string().optional().default(""),
  discount:       z.coerce.number().min(0).default(0),
  roundOff:       z.coerce.number().default(0),
  sources:        z.array(sourceSchema).min(1, "At least one source required"),
  items:          z.array(itemSchema).min(1, "At least one item required"),
  gstLines:       z.array(gstLineSchema).length(3),
});

const DEFAULT_SOURCE = {
  orderId: null, orderType: "", orderNo: "",
  brrId: null, brrNo: "", brrDate: "", basicAmount: 0,
};

const DEFAULT_VALUES = {
  mode: "",
  vendorId: null,
  processingDate: new Date().toISOString().split("T")[0],
  vendorBillNo: "",
  vendorBillDate: "",
  remarks: "",
  discount: 0,
  roundOff: 0,
  sources: [{ ...DEFAULT_SOURCE }],
  items: [],
  gstLines: DEFAULT_GST_LINES,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseBillForm({ mode = "create", billId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [erpBillNo,   setErpBillNo]   = useState("");
  const [actualGstTotal, setActualGstTotal] = useState(null);

  const [vendorList, setVendorList] = useState([]);
  // Per-source dropdown state
  const [orderOptsMap,     setOrderOptsMap]     = useState({});  // { [sourceIdx]: [] }
  const [orderLoadingMap,  setOrderLoadingMap]  = useState({});
  const [brrOptsMap,       setBrrOptsMap]       = useState({});
  const [brrLoadingMap,    setBrrLoadingMap]    = useState({});
  const [itemsLoadingMap,  setItemsLoadingMap]  = useState({});

  const {
    register, control, handleSubmit, reset, getValues, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: sourceFields, append: appendSource, remove: removeSource } =
    useFieldArray({ control, name: "sources" });
  const { fields: itemFields } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;
  const watchedSources = watch("sources") || [];

  // ── Load Vendors ─────────────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => setVendorList((res.data || []).slice().sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || ""))))
      .catch(() => toast.error("Failed to load vendor list"));
  }, []);

  // ── Fetch orders for a source (called when vendor or source index changes) ───
  const fetchOrdersForSource = useCallback(
    async (vendorId, sourceIdx) => {
      if (!vendorId || !projectCode) {
        setOrderOptsMap((m) => ({ ...m, [sourceIdx]: [] }));
        return;
      }
      setOrderLoadingMap((m) => ({ ...m, [sourceIdx]: true }));
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.VENDOR_ORDERS}?vendorId=${vendorId}&projectCode=${projectCode}`,
          method: "GET",
        });
        setOrderOptsMap((m) => ({ ...m, [sourceIdx]: res.data || [] }));
      } catch {
        toast.error("Failed to load orders");
      } finally {
        setOrderLoadingMap((m) => ({ ...m, [sourceIdx]: false }));
      }
    },
    [projectCode],
  );

  // ── Fetch BRR list for order in a source ────────────────────────────────────
  const fetchBrrForSource = useCallback(
    async (orderId, orderType, sourceIdx) => {
      if (!orderId || !projectCode) {
        setBrrOptsMap((m) => ({ ...m, [sourceIdx]: [] }));
        return;
      }
      setBrrLoadingMap((m) => ({ ...m, [sourceIdx]: true }));
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.BRR_LIST}?orderId=${orderId}&orderType=${orderType}&projectCode=${projectCode}`,
          method: "GET",
        });
        setBrrOptsMap((m) => ({ ...m, [sourceIdx]: res.data || [] }));
      } catch {
        toast.error("Failed to load BVS list");
      } finally {
        setBrrLoadingMap((m) => ({ ...m, [sourceIdx]: false }));
      }
    },
    [projectCode],
  );

  // ── Fetch BRR items and merge into items array ───────────────────────────────
  const fetchBrrItems = useCallback(
    async (brrId, sourceIdx) => {
      if (!brrId || !projectCode) return;
      setItemsLoadingMap((m) => ({ ...m, [sourceIdx]: true }));
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.BRR_ITEMS}?brrId=${brrId}&projectCode=${projectCode}`,
          method: "GET",
        });
        const d = res.data || {};
        // Fill vendor bill no/date from first source
        if (sourceIdx === 0) {
          setValue("vendorBillNo",   d.vendorBillNo   || "");
          setValue("vendorBillDate", d.vendorBillDate || "");
        }
        const newItems = (d.items || []).map((it, i) => ({
          slNo:        i + 1,
          ccCode:      it.ccCode      || "",
          ccName:      it.ccName      || "",
          description: it.description || "",
          hsnSac:      it.hsnSac      || "",
          basicAmount: Number(it.basicAmount || 0),
          sourceIndex: sourceIdx,
        }));
        // Merge: keep other sources' items, replace this source's items
        const existing = (getValues("items") || []).filter((it) => it.sourceIndex !== sourceIdx);
        setValue("items", [...existing, ...newItems], { shouldDirty: true });

        // Update source basicAmount
        const srcBasic = newItems.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
        setValue(`sources.${sourceIdx}.basicAmount`, srcBasic, { shouldDirty: true });

        // Update GST from first loaded source
        if (sourceIdx === 0 || existing.length === 0) {
          setValue("gstLines", mapApiGstLines(d.gstLines), { shouldDirty: true });
          setActualGstTotal(igstEquivalent(d.gstLines));
        }
        setAllowSubmit(false);
      } catch {
        setActualGstTotal(null);
        toast.error("Failed to load BVS items");
      } finally {
        setItemsLoadingMap((m) => ({ ...m, [sourceIdx]: false }));
      }
    },
    [projectCode, getValues, setValue],
  );

  // ── Reload orders for all existing sources when vendor changes ───────────────
  const selectedVendorId = watch("vendorId");
  useEffect(() => {
    if (!selectedVendorId) return;
    sourceFields.forEach((_, idx) => fetchOrdersForSource(selectedVendorId, idx));
  }, [selectedVendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle Vendor selection ──────────────────────────────────────────────────
  const handleVendorChange = (v) => {
    setValue("vendorId", v ? Number(v) : null, { shouldDirty: true });
    // Reset all sources
    setValue("sources", [{ ...DEFAULT_SOURCE }], { shouldDirty: true });
    setValue("items", [], { shouldDirty: true });
    setActualGstTotal(null);
    setOrderOptsMap({});
    setBrrOptsMap({});
  };

  // ── Handle Order selection for a source ─────────────────────────────────────
  const handleOrderSelect = (v, option, sourceIdx) => {
    setValue(`sources.${sourceIdx}.orderId`,   v ? Number(v) : null, { shouldDirty: true });
    setValue(`sources.${sourceIdx}.orderType`, option?.orderType || "", { shouldDirty: true });
    setValue(`sources.${sourceIdx}.orderNo`,   option?.orderNo   || "", { shouldDirty: true });
    setValue(`sources.${sourceIdx}.brrId`,     null,                   { shouldDirty: true });
    setValue(`sources.${sourceIdx}.brrNo`,     "",                     { shouldDirty: true });
    setValue(`sources.${sourceIdx}.brrDate`,   "",                     { shouldDirty: true });
    // Clear items for this source
    const existing = (getValues("items") || []).filter((it) => it.sourceIndex !== sourceIdx);
    setValue("items", existing, { shouldDirty: true });
    setBrrOptsMap((m) => ({ ...m, [sourceIdx]: [] }));
    if (v) fetchBrrForSource(Number(v), option?.orderType || "", sourceIdx);
  };

  // ── Handle BRR selection for a source ───────────────────────────────────────
  const handleBrrSelect = (v, option, sourceIdx) => {
    setValue(`sources.${sourceIdx}.brrId`,   v ? Number(v) : null, { shouldDirty: true });
    setValue(`sources.${sourceIdx}.brrNo`,   option?.brrNo   || "", { shouldDirty: true });
    setValue(`sources.${sourceIdx}.brrDate`, option?.brrDate || "", { shouldDirty: true });
    // Clear items for this source
    const existing = (getValues("items") || []).filter((it) => it.sourceIndex !== sourceIdx);
    setValue("items", existing, { shouldDirty: true });
    setActualGstTotal(null);
    if (v) fetchBrrItems(Number(v), sourceIdx);
  };

  // ── Add source row ───────────────────────────────────────────────────────────
  const handleAddSource = () => {
    const newIdx = sourceFields.length;
    appendSource({ ...DEFAULT_SOURCE });
    if (selectedVendorId) fetchOrdersForSource(selectedVendorId, newIdx);
  };

  // ── Remove source row and its items ─────────────────────────────────────────
  const handleRemoveSource = (sourceIdx) => {
    const existing = (getValues("items") || [])
      .filter((it) => it.sourceIndex !== sourceIdx)
      .map((it) => ({ ...it, sourceIndex: it.sourceIndex > sourceIdx ? it.sourceIndex - 1 : it.sourceIndex }));
    setValue("items", existing, { shouldDirty: true });

    // Shift map keys
    const shiftMap = (m) => {
      const updated = {};
      Object.keys(m).forEach((k) => {
        const ki = Number(k);
        if (ki < sourceIdx) updated[ki] = m[k];
        else if (ki > sourceIdx) updated[ki - 1] = m[k];
      });
      return updated;
    };
    setOrderOptsMap(shiftMap);
    setBrrOptsMap(shiftMap);
    setBrrLoadingMap(shiftMap);
    setItemsLoadingMap(shiftMap);

    removeSource(sourceIdx);
  };

  // ── Load Detail (edit/view) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!billId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.GET_BY_ID}${billId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};

        // Build sources from API
        let sourcesData = [];
        if (Array.isArray(d.sources) && d.sources.length > 0) {
          sourcesData = d.sources.map((s) => ({
            orderId:   s.orderId   || null,
            orderType: s.orderType || "",
            orderNo:   s.orderNo   || "",
            brrId:     s.brrId     || null,
            brrNo:     s.brrNo     || "",
            brrDate:   s.brrDate   || "",
            basicAmount: Number(s.basicAmount || 0),
          }));
        } else {
          // Legacy single-source bill
          sourcesData = [{
            orderId:   d.orderId   || null,
            orderType: d.orderType || "",
            orderNo:   d.orderNo   || "",
            brrId:     d.brrId     || null,
            brrNo:     d.brrNo     || "",
            brrDate:   d.brrDate   || "",
            basicAmount: 0,
          }];
        }

        const formatted = {
          mode:           d.mode           || "",
          vendorId:       d.vendorId       || null,
          processingDate: d.processingDate || "",
          vendorBillNo:   d.vendorBillNo   || "",
          vendorBillDate: d.vendorBillDate || "",
          remarks:        d.remarks        || "",
          discount:       Number(d.discount || 0),
          roundOff:       Number(d.roundOff || 0),
          sources: sourcesData,
          items: (d.items || []).map((it, i) => ({
            slNo:        i + 1,
            ccCode:      it.ccCode      || "",
            ccName:      it.ccName      || "",
            description: it.description || "",
            hsnSac:      it.hsnSac      || "",
            basicAmount: Number(it.basicAmount || 0),
            sourceIndex: it.sourceIndex ?? null,
          })),
          gstLines: d.gstLines?.length
            ? mapApiGstLines(d.gstLines, { keepSelection: true })
            : DEFAULT_GST_LINES,
        };
        reset(formatted);

        // Pre-load orders for each source
        if (d.vendorId) {
          sourcesData.forEach((_, idx) => fetchOrdersForSource(d.vendorId, idx));
        }
        // Pre-load BRR opts for each source
        sourcesData.forEach((src, idx) => {
          if (src.orderId) fetchBrrForSource(src.orderId, src.orderType, idx);
        });

        const savedBasic = formatted.items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
        const igstPct    = Number(formatted.gstLines[0]?.percent || 0);
        const pairPct    = Number(formatted.gstLines[1]?.percent || 0) + Number(formatted.gstLines[2]?.percent || 0);
        const effPct     = igstPct > 0 ? igstPct : pairPct;
        setActualGstTotal(effPct > 0 && savedBasic > 0 ? (savedBasic * effPct) / 100 : null);

        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.purchaseBillNo) setErpBillNo(d.purchaseBillNo);
        if (d.purchaseBillUuid && onUuid) onUuid(d.purchaseBillUuid);
      })
      .catch(() => toast.error("Failed to load bill details"));
  }, [billId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Draft ───────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    const igstSelected    = !!v.gstLines?.[0]?.isSelected;
    const cgstSgstSelected = !!v.gstLines?.[1]?.isSelected;
    if (!igstSelected && !cgstSgstSelected) {
      toast.error("Please select a GST type — either IGST or CGST + SGST — before saving.");
      return;
    }

    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.PURCHASE_BILL.CREATE
      : `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.EDIT}${billId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      mode:           v.mode,
      vendorId:       v.vendorId,
      processingDate: v.processingDate,
      vendorBillNo:   v.vendorBillNo   || "",
      vendorBillDate: v.vendorBillDate || "",
      remarks:        v.remarks        || "",
      discount:       Number(v.discount || 0),
      roundOff:       Number(v.roundOff || 0),
      sources: (v.sources || []).map((s) => ({
        orderId:     s.orderId   || null,
        orderType:   s.orderType || "",
        orderNo:     s.orderNo   || "",
        brrId:       s.brrId     ? Number(s.brrId) : null,
        brrNo:       s.brrNo     || "",
        basicAmount: Number(s.basicAmount || 0),
      })),
      items: (v.items || []).map((it, i) => ({
        slNo:        it.slNo || i + 1,
        ccCode:      it.ccCode,
        ccName:      it.ccName,
        description: it.description || "",
        hsnSac:      it.hsnSac      || "",
        basicAmount: Number(it.basicAmount || 0),
        sourceIndex: it.sourceIndex ?? null,
      })),
      gstLines: (v.gstLines || []).map((l) => ({
        gstType:     l.gstType,
        ccCode:      l.ccCode,
        ccName:      l.ccName,
        description: l.description || "",
        percent:     l.percent,
        gstAmount:   l.gstAmount,
        isSelected:  l.isSelected,
      })),
    };

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Bill saved as draft" : "Bill updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.purchaseBillUuid && onUuid) onUuid(res.data.purchaseBillUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/purchases/bill/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  // ── Submit for Approval ───────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.SUBMIT}${billId}`, method: "POST" });
      toast.success("Bill submitted for approval");
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

  // ── Render ───────────────────────────────────────────────────────────────────
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

          {/* Mode */}
          <PMSection title="Mode:">
            <PMFormRow label="Mode" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <SearchableSelect
                options={PURCHASE_BILL_MODES}
                value={watch("mode") || ""}
                disabled={disabled}
                onChange={(v) => setValue("mode", v, { shouldDirty: true })}
                placeholder="Select Mode"
                labelKey="label"
                valueKey="value"
                searchKeys={["label"]}
              />
            </PMFormRow>
          </PMSection>

          {/* Bill Details */}
          <PMSection title="Bill Details:">
            <PMFormRow label="ERP Doc. No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={erpBillNo || "[Auto]"} disabled readOnly />
            </PMFormRow>
            <PMFormRow label="Processing Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("processingDate")} disabled={disabled} hasError={errors.processingDate} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          {/* Vendor */}
          <PMSection title="Party:">
            <PMFormRow label="Party Name" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorId" control={control} render={({ field }) => (
                <SearchableSelect
                  options={vendorList}
                  value={field.value ? String(field.value) : ""}
                  disabled={disabled}
                  onChange={(v) => handleVendorChange(v)}
                  placeholder="Select from Vendor List"
                  labelKey="ledgerName"
                  valueKey="ledgerId"
                  searchKeys={["ledgerName"]}
                />
              )} />
            </PMFormRow>
          </PMSection>

          {/* ── Sources Section ───────────────────────────────────────────── */}
          <PMSection title="Sources (Orders & BVS):">
            <div className="space-y-3 px-1">
              {sourceFields.map((field, sourceIdx) => {
                const colorClass    = SOURCE_COLORS[sourceIdx % SOURCE_COLORS.length];
                const orderOpts     = orderOptsMap[sourceIdx] || [];
                const orderLoading  = orderLoadingMap[sourceIdx] || false;
                const brrOpts       = brrOptsMap[sourceIdx] || [];
                const brrLoading    = brrLoadingMap[sourceIdx] || false;
                const itmLoading    = itemsLoadingMap[sourceIdx] || false;
                const orderVal      = watchedSources[sourceIdx]?.orderId ? String(watchedSources[sourceIdx].orderId) : "";
                const brrVal        = watchedSources[sourceIdx]?.brrId   ? String(watchedSources[sourceIdx].brrId)   : "";

                return (
                  <div key={field.id} className={`border rounded-md p-2 space-y-1.5 ${colorClass}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide">
                        Source {sourceIdx + 1}
                      </span>
                      {sourceFields.length > 1 && !disabled && (
                        <button type="button" onClick={() => handleRemoveSource(sourceIdx)} className="text-red-500 hover:text-red-700 p-0.5" title="Remove source">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Order */}
                    <div>
                      <p className="text-[11px] text-gray-600 mb-0.5">Order Number</p>
                      <SearchableSelect
                        options={orderOpts}
                        value={orderVal}
                        disabled={disabled || !selectedVendorId || orderLoading}
                        onChange={(v, opt) => handleOrderSelect(v, opt, sourceIdx)}
                        placeholder={orderLoading ? "Loading…" : !selectedVendorId ? "Select vendor first" : "Filter from Vendor Orders"}
                        labelKey="orderNo"
                        valueKey="id"
                        searchKeys={["orderNo"]}
                      />
                    </div>

                    {/* BRR */}
                    <div>
                      <p className="text-[11px] text-gray-600 mb-0.5">BVS Number</p>
                      <SearchableSelect
                        options={brrOpts}
                        value={brrVal}
                        disabled={disabled || !orderVal || brrLoading}
                        onChange={(v, opt) => handleBrrSelect(v, opt, sourceIdx)}
                        placeholder={brrLoading ? "Loading…" : !orderVal ? "Select order first" : "Filter from Bill Entry"}
                        labelKey="brrNo"
                        valueKey="id"
                        searchKeys={["brrNo"]}
                      />
                    </div>

                    {/* BVS date auto */}
                    {watchedSources[sourceIdx]?.brrDate && (
                      <p className="text-[11px] text-gray-500">BVS Date: {watchedSources[sourceIdx].brrDate}</p>
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
                  <Plus size={13} /> Add Another Order
                </button>
              )}
            </div>
          </PMSection>

          {/* Vendor Bill details */}
          <PMSection title="Vendor Bill:">
            <PMFormRow label="Vendor Bill No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorBillNo" control={control} render={({ field }) => (
                <PMInput {...field} disabled={disabled} placeholder="[From BVS]" fieldLabel="Vendor Bill No" />
              )} />
            </PMFormRow>
            <PMFormRow label="Vendor Bill Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorBillDate" control={control} render={({ field }) => (
                <PMDateInput {...field} disabled={disabled} className="max-w-[200px]" />
              )} />
            </PMFormRow>
          </PMSection>

          {/* Remarks */}
          <PMSection title="Other:">
            <PMFormRow label="Remarks" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="remarks" control={control} render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Text" rows={3} maxRows={8} />
              )} />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
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
                confirmationTitle="Submit Purchase Bill?"
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
                <DeleteRequestButton moduleCode="PURCHASE_BILL" recordId={Number(billId)} onDeleted={() => router.back()} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant Panel */}
      <AiPanel
        projectCode={projectCode}
        endpoint={API_ENDPOINTS.AI.SUGGEST_PURCHASE_BILL}
        method="POST"
        onApply={() => toast.info("AI suggestion ready — check the AI panel for vendor & item details.", { duration: 4000 })}
        applyLabel="Use this suggestion"
        title="Purchase Bill AI"
      />
    </div>
  );
}
