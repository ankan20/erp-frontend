"use client";

import { useEffect, useState, useCallback } from "react";
import { useFieldArray, Controller } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton       from "@/components/common/SaveButton";
import SaveDraftButton  from "@/components/common/SaveDraftButton";
import EditButton       from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import FileUploadInput  from "@/components/project-management/common/FileUploadInput";
import PMSection        from "@/components/project-management/common/PMSection";
import PMFormRow        from "@/components/project-management/common/PMFormRow";
import PMDateInput      from "@/components/project-management/common/PMDateInput";
import PMTextarea          from "@/components/project-management/common/PMTextarea";
import ExpandableTextCell  from "@/components/project-management/common/ExpandableTextCell";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass }   from "@/lib/formStyles";

const BILL_MODE = "sale_certified_bill";

// ── SCHEMA ────────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  ogSaleOrderItemId: z.number().nullable().optional(),
  itemDisplayCode:   z.string().optional(),
  itemCode:          z.string().optional(),
  itemName:          z.string().optional(),
  itemDescription:   z.string().optional(),
  unit:              z.string().optional(),
  orderQty:          z.coerce.number().min(0).optional(),
  certifiedQty:      z.coerce.number().min(0).optional(),
  rate:              z.coerce.number().min(0).optional(),
  gstPercent:        z.coerce.number().min(0).optional(),
});

const schema = z.object({
  claimBillId:        z.coerce.number().min(1, "Claim Bill is required"),
  ogSaleOrderNo:      z.string().min(1, "Order No is required"),
  billingDate:        z.string().min(1, "Bill Date is required"),
  title:              z.string().min(1, "Title is required"),
  jobLocation:        z.string().min(1, "Job Location is required"),
  preCertifiedAmount: z.coerce.number().min(0).optional(),
  items:              z.array(itemSchema).min(1),
});

const DEFAULT_ITEM = {
  ogSaleOrderItemId: null,
  itemDisplayCode:   "",
  itemCode:          "",
  itemName:          "",
  itemDescription:   "",
  unit:              "",
  orderQty:          "",
  certifiedQty:      "",
  rate:              "",
  gstPercent:        "",
};

const defaultValues = {
  claimBillId:        null,
  ogSaleOrderNo:      "",
  billingDate:        "",
  title:              "",
  jobLocation:        "",
  preCertifiedAmount: "",
  items:              [],
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = (val) => {
  const n = Number(val);
  if (!val && val !== 0) return "";
  if (isNaN(n)) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function SaleCertifiedBillForm({ mode = "create", billId, onAfterSubmit }) {
  const isViewMode  = mode === "view" || mode === "approver";
  const router      = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  // ── STATE
  const [isEditing,     setIsEditing]     = useState(mode === "create");
  const [isSubmitted,   setIsSubmitted]   = useState(false);
  const [allowSubmit,   setAllowSubmit]   = useState(mode === "edit");
  const [isLoading,       setIsLoading]       = useState(false);
  const [initialData,     setInitialData]     = useState(null);
  const [sidebarOpen,     setSidebarOpen]     = useState(true);
  const [saleOrderOpts,   setSaleOrderOpts]   = useState([]);
  const [claimBillOpts,   setClaimBillOpts]   = useState([]);
  const [claimBillLoading, setClaimBillLoading] = useState(false);
  const [useLocations,    setUseLocations]    = useState([]);
  const [lookupLoading,   setLookupLoading]   = useState(false);

  const [file,         setFile]         = useState(null);
  const [existingUrl,  setExistingUrl]  = useState("");
  const [initialUrl,   setInitialUrl]   = useState("");
  const [fileResetKey, setFileResetKey] = useState(0);

  const {
    register, control, handleSubmit, reset, getValues, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  const { fields } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── COMPUTED TOTALS (certifiedQty × rate) ────────────────────────────────────
  const watchedItems        = watch("items") || [];
  const watchedPreCertified = watch("preCertifiedAmount") || 0;

  const thisBillAmount = watchedItems.reduce(
    (sum, item) => sum + Number(item?.certifiedQty || 0) * Number(item?.rate || 0), 0,
  );
  const gstAmount = watchedItems.reduce((sum, item) => {
    const amt = Number(item?.certifiedQty || 0) * Number(item?.rate || 0);
    return sum + amt * Number(item?.gstPercent || 0) / 100;
  }, 0);
  const totalBillAmount = thisBillAmount + Number(watchedPreCertified || 0);

  // ── FETCH APPROVED OG SALE ORDERS ────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url:    `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.LIST}?projectCode=${projectCode}&workflowStatus=Approved`,
      method: "GET",
    })
      .then((res) => {
        const orders = (Array.isArray(res.data) ? res.data : []).map((o) => ({
          ...o,
          displayLabel: o.orderTitle ? `${o.ogSaleOrderNo} — ${o.orderTitle}` : o.ogSaleOrderNo,
        }));
        setSaleOrderOpts(orders);
      })
      .catch(() => setSaleOrderOpts([]));
  }, [projectCode]);

  // ── FETCH CLAIM BILLS FOR A GIVEN OG SALE ORDER ───────────────────────────────
  const fetchClaimBills = useCallback(async (ogSaleOrderNo) => {
    if (!ogSaleOrderNo || !projectCode) { setClaimBillOpts([]); return; }
    setClaimBillLoading(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.LIST}?projectCode=${projectCode}&mode=sale_claim_bill&workflowStatus=Approved&ogSaleOrderNo=${encodeURIComponent(ogSaleOrderNo)}`,
        method: "GET",
      });
      setClaimBillOpts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setClaimBillOpts([]);
    } finally {
      setClaimBillLoading(false);
    }
  }, [projectCode]);

  // ── FETCH USE LOCATIONS ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION.LIST}/${projectCode}`, method: "GET" })
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : [];
        setUseLocations(all.filter((l) => l.locationType === "Use"));
      })
      .catch(() => setUseLocations([]));
  }, [projectCode]);

  // ── OG SALE ORDER SELECTION — fetches claim bills for that order ─────────────
  const handleOrderSelect = useCallback((value) => {
    setValue("ogSaleOrderNo", value, { shouldDirty: true });
    setValue("claimBillId",   null,  { shouldDirty: true });
    setValue("items",         [],    { shouldDirty: true });
    setValue("preCertifiedAmount", "", { shouldDirty: true });
    setClaimBillOpts([]);
    fetchClaimBills(value);
  }, [setValue, fetchClaimBills]);

  // ── CLAIM BILL SELECTION — calls order-lookup to pre-fill items ──────────────
  const handleClaimBillSelect = useCallback(async (id) => {
    setValue("claimBillId", id ? Number(id) : null, { shouldDirty: true });
    if (!id || !projectCode) return;
    setLookupLoading(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.ORDER_LOOKUP}?claimBillId=${encodeURIComponent(id)}&projectCode=${projectCode}&mode=${BILL_MODE}`,
        method: "GET",
      });
      const d = res.data || {};
      if (d.preCertifiedAmount !== undefined) {
        setValue("preCertifiedAmount", d.preCertifiedAmount, { shouldDirty: true });
      }
      const items = (d.items || []).map((it) => ({
        ogSaleOrderItemId: it.id || it.ogSaleOrderItemId || null,
        itemDisplayCode:   it.itemDisplayCode || it.itemCode   || "",
        itemCode:          it.itemCode        || "",
        itemName:          it.itemName        || "",
        itemDescription:   it.itemDescription || it.description || "",
        unit:              it.unit            || "",
        orderQty:          it.orderQty        || it.qty || "",
        certifiedQty:      it.claimQty        || "",
        rate:              it.rate            || "",
        gstPercent:        it.gstPercent      || it.gst  || "",
      }));
      if (items.length) setValue("items", items, { shouldDirty: true });
    } catch {
      toast.error("Failed to load claim bill details");
    } finally {
      setLookupLoading(false);
    }
  }, [projectCode, setValue]);

  // ── FETCH DETAIL (edit / view mode) ──────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !billId) return;
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.GET_BY_ID}${billId}`,
          method: "GET",
        });
        const d = res.data;
        const formatted = {
          claimBillId:        d.claimBillId         || null,
          ogSaleOrderNo:      d.ogSaleOrderNo        || "",
          billingDate:        d.billingDate           || "",
          title:              d.title                 || "",
          jobLocation:        d.jobLocation           || "",
          preCertifiedAmount: d.preCertifiedAmount    || "",
          items: (d.items || []).map((it) => ({
            ogSaleOrderItemId: it.ogSaleOrderItemId || null,
            itemDisplayCode:   it.itemDisplayCode   || it.itemCode || "",
            itemCode:          it.itemCode           || "",
            itemName:          it.itemName           || "",
            itemDescription:   it.itemDescription   || "",
            unit:              it.unit               || "",
            orderQty:          it.orderQty           || "",
            certifiedQty:      it.claimQty           || "",
            rate:              it.rate               || "",
            gstPercent:        it.gstPercent         || "",
          })),
        };
        if (!formatted.items.length) formatted.items = [{ ...DEFAULT_ITEM }];
        reset(formatted);
        setInitialData(formatted);
        if (d.ogSaleOrderNo) fetchClaimBills(d.ogSaleOrderNo);
        setExistingUrl(d.attachment || "");
        setInitialUrl(d.attachment  || "");
        const editable = ["draft", "reback"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("Certified Bill already Approved");
          else if (st === "Rejected") toast.info("Certified Bill already Rejected");
          else                         toast.info("Certified Bill already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Certified Bill");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [billId, mode]);

  // ── EDIT / CANCEL ──────────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setFile(null);
      setExistingUrl(initialUrl);
      setFileResetKey((k) => k + 1);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  // ── BUILD PAYLOAD ─────────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();
    fd.append("mode",        BILL_MODE);
    if (mode === "create") fd.append("projectCode", projectCode);
    fd.append("claimBillId", v.claimBillId || "");
    fd.append("billingDate", v.billingDate  || "");
    fd.append("title",       v.title        || "");
    fd.append("jobLocation", v.jobLocation  || "");
    fd.append(
      "items",
      JSON.stringify(
        v.items.map((it, i) => ({
          slNo:              i + 1,
          ogSaleOrderItemId: it.ogSaleOrderItemId || null,
          claimQty:          Number(it.certifiedQty || 0),
          rate:              Number(it.rate          || 0),
          gstPercent:        Number(it.gstPercent    || 0),
        })),
      ),
    );
    if (file) fd.append("attachment", file);
    return fd;
  };

  // ── SAVE DRAFT / UPDATE ───────────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url:    mode === "create"
          ? API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.CREATE
          : `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.UPDATE}${billId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });
      setExistingUrl(res.data?.attachment || existingUrl);
      setInitialUrl(res.data?.attachment  || existingUrl);
      setFile(null);
      setFileResetKey((k) => k + 1);
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success(
        mode === "create" ? "Certified Bill created successfully" : "Certified Bill updated successfully",
        { id: tid },
      );
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/project-management/customer-billing/sale-bill-certified/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── SUBMIT FOR APPROVAL ───────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!billId) { toast.error("Please save first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.SUBMIT}${billId}`,
        method: "POST",
      });
      toast.success("Certified Bill submitted for approval", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: tid });
    }
  };

  // ── LOADING ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
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

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[385px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>
          <PMSection title="Certified Bill Details:">

            <PMFormRow label="Order No" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="flex-1">
                <SearchableSelect
                  options={saleOrderOpts}
                  value={watch("ogSaleOrderNo") || ""}
                  disabled={disabled}
                  onChange={(value) => handleOrderSelect(value)}
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

            <PMFormRow label="Claim Bill" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="flex-1">
                <SearchableSelect
                  options={claimBillOpts}
                  value={watch("claimBillId") || ""}
                  disabled={disabled || lookupLoading || claimBillLoading || !watch("ogSaleOrderNo")}
                  onChange={(value) => handleClaimBillSelect(value)}
                  placeholder={claimBillLoading ? "Loading…" : lookupLoading ? "Loading…" : !watch("ogSaleOrderNo") ? "Select order first" : "Select Claim Bill"}
                  labelKey="billingNo"
                  valueKey="id"
                  searchKeys={["billingNo", "title"]}
                />
                {errors.claimBillId && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors.claimBillId.message}</p>
                )}
              </div>
            </PMFormRow>

            <PMFormRow label="Bill Date" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <PMDateInput
                {...register("billingDate")}
                disabled={disabled}
                hasError={errors.billingDate}
                className="max-w-[200px]"
              />
            </PMFormRow>

            <div>
              <span className="text-[13px] text-[#444444]">
                Title{!disabled && <span className="text-red-500 ml-0.5">*</span>}
              </span>
              <Controller
                name="title"
                control={control}
                render={({ field, fieldState }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    hasError={fieldState.error}
                    disabled={disabled}
                    title="Title"
                    placeholder="Text"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </div>

            <PMFormRow label="Job Location" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="flex-1">
                <SearchableSelect
                  options={useLocations}
                  value={watch("jobLocation") || ""}
                  disabled={disabled}
                  onChange={(value) => setValue("jobLocation", value, { shouldDirty: true })}
                  placeholder="Select"
                  labelKey="locationName"
                  valueKey="locationName"
                  searchKeys={["locationName"]}
                />
                {errors.jobLocation && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors.jobLocation.message}</p>
                )}
              </div>
            </PMFormRow>

            <PMFormRow label="Pre Certified" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="max-w-[180px]">
                <input
                  type="text"
                  value={fmt(watch("preCertifiedAmount") || 0)}
                  disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#b5b5b5] bg-[#f5f5f5] text-right px-2 text-[#555] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="This Bill Amount" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="max-w-[180px]">
                <input type="text" value={fmt(thisBillAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="GST Amount" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="max-w-[180px]">
                <input type="text" value={fmt(gstAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="Total Bill Amount" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="max-w-[180px]">
                <input type="text" value={fmt(totalBillAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <div className="pt-2">
              <FileUploadInput
                label="Attachment"
                showLabel
                disabled={disabled}
                existingFileUrl={existingUrl}
                onFileChange={(f) => setFile(f)}
                onClearExisting={() => setExistingUrl("")}
                resetKey={fileResetKey}
              />
            </div>

          </PMSection>
        </div>

        {/* ── RIGHT PANEL: BOQ TABLE ──────────────────────────────────────────── */}
        <div className="w-full lg:flex-1 min-w-0">
          <div className="border border-[#b5b5b5]">

            <div className="bg-[#d6e4f5] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[15px] text-[#1c3a5e]">
              Certified Sale
            </div>

            <div className="overflow-x-auto overflow-y-auto lg:max-h-[calc(100vh-260px)]">
              <table className="w-full border-collapse text-sm" style={{ minWidth: 960 }}>

                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#3b6ea5] text-white">
                    <th className="border border-[#2a5080] w-[44px] text-center text-[13px] py-1.5">SL no</th>
                    <th className="border border-[#2a5080] w-[110px] text-left px-2 text-[13px] py-1.5">Item Code</th>
                    <th className="border border-[#2a5080] text-left px-2 text-[13px] py-1.5">Item Name &amp; Description</th>
                    <th className="border border-[#2a5080] w-[60px] text-center text-[13px] py-1.5">Unit</th>
                    <th className="border border-[#2a5080] w-[85px] text-right px-2 text-[13px] py-1.5">Order Qty</th>
                    <th className="border border-[#2a5080] w-[90px] text-right px-2 text-[13px] py-1.5">Certified Qty</th>
                    <th className="border border-[#2a5080] w-[90px] text-right px-2 text-[13px] py-1.5">Rate</th>
                    <th className="border border-[#2a5080] w-[65px] text-right px-2 text-[13px] py-1.5">GST %</th>
                    <th className="border border-[#2a5080] w-[105px] text-right px-2 text-[13px] py-1.5">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {fields.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center text-[13px] text-[#888] py-8 italic border border-[#ccc]"
                      >
                        Select an order, then a claim bill above to populate items
                      </td>
                    </tr>
                  )}
                  {fields.map((field, index) => {
                    const orderQty     = Number(watch(`items.${index}.orderQty`)     || 0);
                    const certifiedQty = Number(watch(`items.${index}.certifiedQty`) || 0);
                    const rate         = Number(watch(`items.${index}.rate`)          || 0);
                    const amount       = certifiedQty * rate;
                    const overQty      = !disabled && certifiedQty > orderQty && orderQty > 0;

                    return (
                      <tr key={field.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f8fc]"}>

                        {/* SL */}
                        <td className="border border-[#ccc] text-center bg-[#edf4fb] text-[13px] font-medium align-middle">
                          {index + 1}
                        </td>

                        {/* ITEM CODE — read-only */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            {...register(`items.${index}.itemDisplayCode`)}
                            disabled placeholder="—"
                            className={`${getInputClass(false, true)} border-0 rounded-none w-full h-[30px] text-[13px] px-1`}
                          />
                          <input {...register(`items.${index}.itemCode`)}          type="hidden" />
                          <input {...register(`items.${index}.ogSaleOrderItemId`)} type="hidden" />
                        </td>

                        {/* ITEM NAME & DESCRIPTION — name read-only, desc expandable */}
                        <td className="border border-[#ccc] p-0">
                          <Controller
                            name={`items.${index}.itemName`}
                            control={control}
                            render={({ field }) => (
                              <ExpandableTextCell
                                value={field.value || ""}
                                onChange={field.onChange}
                                disabled={true}
                                label="Item Name"
                                placeholder="—"
                                textSize="text-[13px]"
                              />
                            )}
                          />
                          <Controller
                            name={`items.${index}.itemDescription`}
                            control={control}
                            render={({ field }) => (
                              <ExpandableTextCell
                                value={field.value || ""}
                                onChange={field.onChange}
                                disabled={true}
                                label="Item Description"
                                placeholder="—"
                              />
                            )}
                          />
                        </td>

                        {/* UNIT — read-only */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            {...register(`items.${index}.unit`)}
                            disabled placeholder="—"
                            className={`${getInputClass(false, true)} border-0 rounded-none w-full h-[30px] text-[13px] text-center`}
                          />
                        </td>

                        {/* ORDER QTY — read-only reference */}
                        <td className="border border-[#ccc] bg-[#f0f4f8] px-2 text-[13px] text-right align-middle text-[#555]">
                          {orderQty > 0 ? fmt(orderQty) : "—"}
                          <input {...register(`items.${index}.orderQty`)} type="hidden" />
                        </td>

                        {/* CERTIFIED QTY — editable, capped at orderQty */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            type="number" min={0} step="any"
                            {...register(`items.${index}.certifiedQty`, {
                              onChange: (e) => {
                                const v   = Number(e.target.value);
                                const max = Number(watch(`items.${index}.orderQty`) || Infinity);
                                if (v < 0)            e.target.value = 0;
                                if (v > max && max > 0) e.target.value = max;
                              },
                            })}
                            disabled={disabled} placeholder="0"
                            title={overQty ? `Cannot exceed order qty (${orderQty})` : undefined}
                            className={`
                              ${overQty
                                ? "border-red-400 bg-red-50 text-red-700"
                                : getInputClass(errors?.items?.[index]?.certifiedQty, disabled)
                              }
                              border-0 rounded-none w-full h-[30px] text-[13px] text-right pr-2
                            `}
                          />
                          {overQty && (
                            <p className="text-[10px] text-red-500 px-1">Max: {fmt(orderQty)}</p>
                          )}
                        </td>

                        {/* RATE — editable */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            type="number" min={0} step="any"
                            {...register(`items.${index}.rate`, {
                              onChange: (e) => { if (Number(e.target.value) < 0) e.target.value = 0; },
                            })}
                            disabled={disabled} placeholder="0"
                            className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[30px] text-[13px] text-right pr-2`}
                          />
                        </td>

                        {/* GST % */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            type="number" min={0} max={100} step="any"
                            {...register(`items.${index}.gstPercent`, {
                              onChange: (e) => { if (Number(e.target.value) < 0) e.target.value = 0; },
                            })}
                            disabled={disabled} placeholder="0"
                            className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[30px] text-[13px] text-right pr-2`}
                          />
                        </td>

                        {/* AMOUNT */}
                        <td className="border border-[#ccc] bg-[#edf8ed] px-2 text-[13px] font-medium text-right align-middle">
                          {fmt(amount)}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="sticky bottom-0 z-10 bg-[#b7d5f0]">
                  <tr className="font-bold">
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0] px-2 text-right text-[13px]">TOTAL=</td>
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0] px-2 text-right text-[13px]">{fmt(thisBillAmount)}</td>
                  </tr>
                </tfoot>

              </table>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          {!isViewMode && (
            <div className="flex flex-wrap justify-end gap-3 pt-4 mt-4 border-t border-[#d8e6f0]">
              {isEditing && (
                <SaveDraftButton
                  onClick={() => handleSubmit(onSave)()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  requireConfirmation
                  confirmationTitle="Save Certified Bill as Draft?"
                  confirmationMessage="This entry will be saved as a draft and can be edited or submitted later."
                >
                  Save as Draft
                </SaveDraftButton>
              )}

              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                requireConfirmation
                confirmationTitle="Submit Certified Bill?"
                confirmationMessage="Once submitted, this entry will be sent for approval."
              >
                Submit
              </SaveButton>

              {mode === "edit" && !isSubmitted && (
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
