"use client";

import { useCallback, useEffect, useState } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }                  from "zod";
import { zodResolver }        from "@hookform/resolvers/zod";
import { toast }              from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";
import PMInput         from "@/components/project-management/common/PMInput";

import SaleBillRightPanel, {
  DEFAULT_GST_LINES,
} from "@/components/finance/account/common/SaleBillRightPanel";

import { apiRequest }        from "@/lib/apiClient";
import { API_ENDPOINTS }     from "@/config/api.config";
import { getLocalStorage }   from "@/lib/localStorage";

const PURCHASE_BILL_MODES = [
  { label: "Purchases Invoice", value: "purchase_invoice" },
  { label: "Proforma Invoice",            value: "proforma_invoice" },
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
  gstType:   z.string(),
  ccCode:    z.string(),
  ccName:    z.string(),
  description: z.string().optional().default(""),
  percent:   z.number(),
  gstAmount: z.coerce.number().default(0),
  isSelected: z.boolean().default(false),
});

const schema = z.object({
  mode:           z.string().min(1, "Mode is required"),
  vendorId:       z.coerce.number().min(1, "Party is required"),
  orderId:        z.coerce.number().nullable().optional(),
  orderType:      z.string().optional().default(""),
  brrId:          z.coerce.number().nullable().optional(),
  processingDate: z.string().min(1, "Processing Date is required"),
  vendorBillNo:   z.string().optional().default(""),
  vendorBillDate: z.string().optional().default(""),
  remarks:        z.string().optional().default(""),
  discount:       z.coerce.number().min(0).default(0),
  roundOff:       z.coerce.number().default(0),
  items:          z.array(itemSchema).min(1, "At least one item required"),
  gstLines:       z.array(gstLineSchema).length(3),
});

// ─── GST line mapping ─────────────────────────────────────────────────────────
// The backend already aggregates GST across all items and splits it into exactly
// one IGST / CGST / SGST row (IGST = CGST + SGST), so the rates and amounts are
// used as-is. Only the order needs normalising: the form and AccountGstTable both
// index these as [IGST, CGST, SGST], while the API sends them SGST-first.
const GST_ORDER = ["IGST", "CGST", "SGST"];

const findType = (apiLines, type) =>
  (apiLines || []).find((l) => String(l.gstType || "").toUpperCase() === type);

// Only the rate, amount and description come from the API. CC code / name stay on
// the fixed IGST / CGST / SGST labels — the API repeats the items' own CC on all
// three rows, which would leave them indistinguishable in the table.
const mapGstLines = (apiLines, { keepSelection = false } = {}) =>
  GST_ORDER.map((type, i) => {
    const def = DEFAULT_GST_LINES[i];
    const l   = findType(apiLines, type);
    // On a fresh BVS load IGST stays pre-selected, as before — the API sends every
    // row unselected. A saved bill keeps whatever the user picked.
    const isSelected = keepSelection ? !!l?.isSelected : i === 0;
    if (!l) return { ...def, isSelected };
    return {
      ...def,
      description: l.description || "",
      percent:     Number(l.percent   || 0),
      gstAmount:   Number(l.gstAmount || 0),
      isSelected,
    };
  });

// Full-rate ("IGST-equivalent") GST — AccountGstTable gives IGST the whole amount
// and CGST/SGST half each, which is exactly how the API splits it.
const igstEquivalentFromApi = (apiLines) => {
  const igst = Number(findType(apiLines, "IGST")?.gstAmount || 0);
  if (igst > 0) return igst;
  const pair = Number(findType(apiLines, "CGST")?.gstAmount || 0)
             + Number(findType(apiLines, "SGST")?.gstAmount || 0);
  return pair > 0 ? pair : null;
};

const DEFAULT_VALUES = {
  mode:           "",
  vendorId:       null,
  orderId:        null,
  orderType:      "",
  brrId:          null,
  processingDate: new Date().toISOString().split("T")[0],
  vendorBillNo:   "",
  vendorBillDate: "",
  remarks:        "",
  discount:       0,
  roundOff:       0,
  items:          [],
  gstLines:       DEFAULT_GST_LINES,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseBillForm({
  mode = "create",
  billId,
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

  const [vendorList,    setVendorList]    = useState([]);
  const [orderOpts,     setOrderOpts]     = useState([]);
  const [brrOpts,       setBrrOpts]       = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [brrLoading,    setBrrLoading]    = useState(false);
  const [itemsLoading,  setItemsLoading]  = useState(false);
  const [erpBillNo,     setErpBillNo]     = useState("");
  // Real GST for this document (IGST-equivalent). null → legacy percent-based maths.
  const [actualGstTotal, setActualGstTotal] = useState(null);

  const {
    register, control, handleSubmit, reset, getValues, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Load Vendors ─────────────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => setVendorList((res.data || []).slice().sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || ""))))
      .catch(() => toast.error("Failed to load vendor list"));
  }, []);

  // ── Fetch helpers (useCallback so setState is inside callback, not effect body) ─
  const fetchVendorOrders = useCallback(
    async (vendorId) => {
      if (!vendorId || !projectCode) { setOrderOpts([]); return; }
      setOrdersLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.VENDOR_ORDERS}?vendorId=${vendorId}&projectCode=${projectCode}`,
          method: "GET",
        });
        setOrderOpts(res.data || []);
      } catch {
        toast.error("Failed to load orders");
      } finally {
        setOrdersLoading(false);
      }
    },
    [projectCode],
  );

  const fetchBrrList = useCallback(
    async (orderId, orderType) => {
      if (!orderId || !projectCode) { setBrrOpts([]); return; }
      setBrrLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.BRR_LIST}?orderId=${orderId}&orderType=${orderType}&projectCode=${projectCode}`,
          method: "GET",
        });
        setBrrOpts(res.data || []);
      } catch {
        toast.error("Failed to load BVS list");
      } finally {
        setBrrLoading(false);
      }
    },
    [projectCode],
  );

  // ── Load Orders when vendor selected ─────────────────────────────────────────
  const selectedVendorId = watch("vendorId");
  useEffect(() => { fetchVendorOrders(selectedVendorId); }, [selectedVendorId, fetchVendorOrders]);

  // ── Load BRR List when order selected ────────────────────────────────────────
  const selectedOrderId   = watch("orderId");
  const selectedOrderType = watch("orderType");
  useEffect(() => { fetchBrrList(selectedOrderId, selectedOrderType); }, [selectedOrderId, selectedOrderType, fetchBrrList]);

  // ── Load BRR Items when BRR selected ─────────────────────────────────────────
  const fetchBrrItems = useCallback(
    async (brrId) => {
      if (!brrId || !projectCode || mode !== "create") return;
      setItemsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.BRR_ITEMS}?brrId=${brrId}&projectCode=${projectCode}`,
          method: "GET",
        });
        const d = res.data || {};
        setValue("vendorBillNo",   d.vendorBillNo   || "");
        setValue("vendorBillDate", d.vendorBillDate || "");
        const mapped = (d.items || []).map((it, i) => ({
          slNo:        i + 1,
          ccCode:      it.ccCode      || "",
          ccName:      it.ccName      || "",
          description: it.description || "",
          hsnSac:      it.hsnSac      || "",
          basicAmount: Number(it.basicAmount || 0),
        }));
        setValue("items",    mapped, { shouldDirty: true });
        setValue("gstLines", mapGstLines(d.gstLines), { shouldDirty: true });
        setActualGstTotal(igstEquivalentFromApi(d.gstLines));
        setAllowSubmit(false);
      } catch {
        setActualGstTotal(null);
        toast.error("Failed to load BVS items");
      } finally {
        setItemsLoading(false);
      }
    },
    [projectCode, mode, setValue],
  );

  const selectedBrrId = watch("brrId");
  useEffect(() => { fetchBrrItems(selectedBrrId); }, [selectedBrrId, fetchBrrItems]);

  // ── Fetch Detail (edit/view) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!billId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.GET_BY_ID}${billId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        const formatted = {
          mode:           d.mode           || "",
          vendorId:       d.vendorId       || null,
          orderId:        d.orderId        || null,
          orderType:      d.orderType      || "",
          brrId:          d.brrId          || null,
          processingDate: d.processingDate || "",
          vendorBillNo:   d.vendorBillNo   || "",
          vendorBillDate: d.vendorBillDate || "",
          remarks:        d.remarks        || "",
          discount:       Number(d.discount || 0),
          roundOff:       Number(d.roundOff || 0),
          items: (d.items || []).map((it, i) => ({
            slNo:        i + 1,
            ccCode:      it.ccCode      || "",
            ccName:      it.ccName      || "",
            description: it.description || "",
            hsnSac:      it.hsnSac      || "",
            basicAmount: Number(it.basicAmount || 0),
          })),
          gstLines: d.gstLines?.length
            ? mapGstLines(d.gstLines, { keepSelection: true })
            : DEFAULT_GST_LINES,
        };
        reset(formatted);

        // Rebuild the document's real GST from the saved rates, so a reopened bill
        // renders exactly like a freshly loaded one. Derived from percent rather than
        // gstAmount because unselected rows are stored with a zero amount.
        const savedBasic = formatted.items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
        const igstPct    = Number(formatted.gstLines[0]?.percent || 0);
        const pairPct    = Number(formatted.gstLines[1]?.percent || 0)
                         + Number(formatted.gstLines[2]?.percent || 0);
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
    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.PURCHASE_BILL.CREATE
      : `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.EDIT}${billId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      mode:           v.mode,
      vendorId:       v.vendorId,
      orderId:        v.orderId   || null,
      orderType:      v.orderType || "",
      brrId:          v.brrId     || null,
      processingDate: v.processingDate,
      vendorBillNo:   v.vendorBillNo   || "",
      vendorBillDate: v.vendorBillDate || "",
      remarks:        v.remarks        || "",
      items:          v.items,
      gstLines:       v.gstLines,
      discount:       Number(v.discount || 0),
      roundOff:       Number(v.roundOff || 0),
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
        if (newId)
          setTimeout(() => router.push(`/finance-management/account/purchases/bill/${newId}`), 400);
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

          {/* Header */}
          <PMSection title="Bill Details:">
            <PMFormRow label="ERP Doc. No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={erpBillNo || "[Auto]"} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>

            <PMFormRow label="Processing Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("processingDate")} disabled={disabled} hasError={errors.processingDate} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          {/* Party & Order chain */}
          <PMSection title="Party Details:">
            <PMFormRow label="Party Name" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorId" control={control} render={({ field }) => (
                <SearchableSelect
                  options={vendorList}
                  value={field.value ? String(field.value) : ""}
                  disabled={disabled}
                  onChange={(v) => {
                    field.onChange(v ? Number(v) : null);
                    setValue("orderId",   null, { shouldDirty: true });
                    setValue("orderType", "",   { shouldDirty: true });
                    setValue("brrId",     null, { shouldDirty: true });
                    setValue("items",     [],   { shouldDirty: true });
                    setActualGstTotal(null);
                    setBrrOpts([]);
                  }}
                  placeholder="Select from Vendor List"
                  labelKey="ledgerName"
                  valueKey="ledgerId"
                  searchKeys={["ledgerName"]}
                />
              )} />
            </PMFormRow>

            <PMFormRow label="Order Number" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="orderId" control={control} render={({ field }) => (
                <SearchableSelect
                  options={orderOpts}
                  value={field.value ? String(field.value) : ""}
                  disabled={disabled || !selectedVendorId || ordersLoading}
                  onChange={(v) => {
                    const order = orderOpts.find((o) => String(o.id) === String(v));
                    field.onChange(v ? Number(v) : null);
                    setValue("orderType", order?.orderType || "", { shouldDirty: true });
                    setValue("brrId",     null,                   { shouldDirty: true });
                    setValue("items",     [],                     { shouldDirty: true });
                    setActualGstTotal(null);
                  }}
                  placeholder={ordersLoading ? "Loading…" : "Filter List from Vendor Order"}
                  labelKey="orderNo"
                  valueKey="id"
                  searchKeys={["orderNo"]}
                />
              )} />
            </PMFormRow>

            <PMFormRow label="BVS Number" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="brrId" control={control} render={({ field }) => (
                <SearchableSelect
                  options={brrOpts}
                  value={field.value ? String(field.value) : ""}
                  disabled={disabled || !selectedOrderId || brrLoading}
                  onChange={(v) => {
                    field.onChange(v ? Number(v) : null);
                    setValue("items", [], { shouldDirty: true });
                    setActualGstTotal(null);
                  }}
                  placeholder={brrLoading ? "Loading…" : "Filter List from Bill Entry"}
                  labelKey="brrNo"
                  valueKey="id"
                  searchKeys={["brrNo"]}
                />
              )} />
            </PMFormRow>

            <PMFormRow label="BVS Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input
                value={brrOpts.find((b) => String(b.id) === String(watch("brrId")))?.brrDate || ""}
                disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none max-w-[200px]"
                placeholder="[From Data Base]"
              />
            </PMFormRow>

            <PMFormRow label="Vendor Bill No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorBillNo" control={control} render={({ field }) => (
                <PMInput {...field} disabled placeholder="[From BVS]" fieldLabel="Vendor Bill No" />
              )} />
            </PMFormRow>

            <PMFormRow label="Vendor Bill Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorBillDate" control={control} render={({ field }) => (
                <PMDateInput {...field} disabled className="max-w-[200px]" />
              )} />
            </PMFormRow>
          </PMSection>

          {/* Remarks */}
          <PMSection title="Other:">
            <PMFormRow label="Remarks" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="remarks" control={control} render={({ field }) => (
                <PMTextarea
                  value={field.value || ""}
                  onChange={field.onChange}
                  disabled={disabled}
                  placeholder="Text"
                  rows={3}
                  maxRows={8}
                />
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
            itemsLoading={itemsLoading}
            itemFields={itemFields}
            actualGstTotal={actualGstTotal}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
