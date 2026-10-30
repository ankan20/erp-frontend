"use client";

import { useEffect, useState, useCallback } from "react";
import { useFieldArray, Controller } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen, Download, ClipboardList, TableProperties } from "lucide-react";
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
import QtyInput            from "@/components/common/QtyInput";
import GstInput            from "@/components/common/GstInput";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";

import { apiRequest }          from "@/lib/apiClient";
import { API_ENDPOINTS }       from "@/config/api.config";
import { getLocalStorage }     from "@/lib/localStorage";
import { getInputClass }       from "@/lib/formStyles";
import { zodDate }             from "@/lib/dateUtils";
import { useResizableTable }   from "@/hooks/useResizableTable";

const BILL_MODE = "sale_claim_bill";

// ── COLUMN DEFINITIONS ─────────────────────────────────────────────────────────
const ENTRY_COLS = [
  { id: "sl",          label: "SL",                        thClass: "w-[40px] text-center" },
  { id: "itemCode",    label: "Item Code",                 thClass: "w-[100px] text-left px-2" },
  { id: "itemName",    label: "Item Name & Description",   thClass: "text-left px-2" },
  { id: "unit",        label: "Unit",                      thClass: "w-[60px] text-center" },
  { id: "rate",        label: "Rate",                      thClass: "w-[90px] text-right px-2" },
  { id: "orderQty",    label: "Order Qty",                 thClass: "w-[90px] text-right px-2" },
  { id: "claimQty",    label: "Claim Qty",                 thClass: "w-[100px] text-right px-2" },
  { id: "gstPct",      label: "GST %",                     thClass: "w-[80px] text-right px-2" },
];

// View table uses group-level IDs for drag-to-reorder; "certQty"/"certAmt" are 3-col groups
const VIEW_GROUP_COLS = [
  { id: "sl",       label: "SL",                      thClass: "w-[40px] text-center" },
  { id: "itemCode", label: "Item Code",               thClass: "w-[90px] text-left px-2" },
  { id: "itemName", label: "Item Name & Description", thClass: "text-left px-2" },
  { id: "orderQty", label: "Order Qty",               thClass: "w-[80px] text-center" },
  { id: "unit",     label: "Unit",                    thClass: "w-[60px] text-center" },
  { id: "rate",     label: "Rate",                    thClass: "w-[90px] text-center" },
  { id: "certQty",  label: "Certified Quantity",      thClass: "text-center", colSpan: 3, groupBg: "bg-[#25507a]" },
  { id: "gstPct",   label: "GST %",                   thClass: "w-[65px] text-center" },
  { id: "gstAmt",   label: "GST Amount",              thClass: "w-[100px] text-center" },
  { id: "certAmt",  label: "Certified Amount",        thClass: "text-center", colSpan: 3, groupBg: "bg-[#1a4d2e]" },
];

// ── SCHEMA ────────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  type:              z.string().optional().default("non-boq"),
  ogSaleOrderItemId: z.number().nullable().optional(),
  itemDisplayCode:   z.string().optional(),
  itemCode:          z.string().optional(),
  itemName:          z.string().optional(),
  itemDescription:   z.string().optional(),
  unit:              z.string().optional(),
  orderQty:          z.coerce.number().min(0).optional(),
  claimQty:          z.coerce.number().min(0).optional(),
  certifiedQty:      z.coerce.number().min(0).optional(),
  certifiedAmount:   z.coerce.number().min(0).optional(),
  rate:              z.coerce.number().min(0).optional(),
  gstPercent:        z.coerce.number().min(0).optional(),
});

const schema = z.object({
  ogSaleOrderNo:      z.string().min(1, "Order No is required"),
  billingDate: zodDate(z, "billingDate", true),
  title:              z.string().min(1, "Title is required"),
  jobLocation:        z.string().min(1, "Job Location is required"),
  preCertifiedAmount: z.coerce.number().min(0).optional(),
  items:              z.array(itemSchema).min(1),
});

const DEFAULT_ITEM = {
  type:              "non-boq",
  ogSaleOrderItemId: null,
  itemDisplayCode:   "",
  itemCode:          "",
  itemName:          "",
  itemDescription:   "",
  unit:              "",
  orderQty:          "",
  claimQty:          "",
  certifiedQty:      0,
  certifiedAmount:   0,
  rate:              "",
  gstPercent:        "",
};

const defaultValues = {
  ogSaleOrderNo:      "",
  billingDate:        "",
  title:              "",
  jobLocation:        "",
  preCertifiedAmount: "",
  items:              [],
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function SaleClaimBillForm({ mode = "create", billId, onAfterSubmit, onUuid }) {
  const isViewMode  = mode === "view" || mode === "approver";
  const router      = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [activeTab,     setActiveTab]     = useState("entry"); // "entry" | "view"
  const [isEditing,     setIsEditing]     = useState(mode === "create");
  const [isSubmitted,   setIsSubmitted]   = useState(false);
  const [allowSubmit,   setAllowSubmit]   = useState(mode === "edit");
  const [isLoading,     setIsLoading]     = useState(false);
  const [initialData,   setInitialData]   = useState(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [saleOrderOpts, setSaleOrderOpts] = useState([]);
  const [useLocations,  setUseLocations]  = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [billUuid,      setBillUuid]      = useState("");
  const [billingNo,     setBillingNo]     = useState("");

  const [file,         setFile]         = useState(null);
  const [existingUrl,  setExistingUrl]  = useState("");
  const [initialUrl,   setInitialUrl]   = useState("");
  const [fileResetKey, setFileResetKey] = useState(0);

  // ── hooks must be at top level — NOT inside inner components ─────────────────
  const { columnOrder: entryOrder, tableRef: entryRef, getThProps: entryThProps } =
    useResizableTable({ columns: ENTRY_COLS, storageKey: "saleClaimBillEntry" });

  const { tableRef: viewRef, getThProps: viewThProps, columnOrder: viewOrder } = useResizableTable({
    columns:    VIEW_GROUP_COLS,
    storageKey: "saleClaimBillView2",
  });

  const {
    register, control, handleSubmit, reset, getValues, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  const { fields } = useFieldArray({ control, name: "items" });
  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── COMPUTED TOTALS ───────────────────────────────────────────────────────────
  const watchedItems        = watch("items") || [];
  const watchedPreCertified = watch("preCertifiedAmount") || 0;

  const thisBillBasic = watchedItems.reduce(
    (sum, it) => sum + Number(it?.claimQty || 0) * Number(it?.rate || 0), 0,
  );
  const gstAmount = watchedItems.reduce((sum, it) => {
    const amt = Number(it?.claimQty || 0) * Number(it?.rate || 0);
    return sum + amt * Number(it?.gstPercent || 0) / 100;
  }, 0);
  const totalClaim = thisBillBasic + Number(watchedPreCertified || 0);

  // ── FETCH OG SALE ORDERS ──────────────────────────────────────────────────────
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

  // ── ORDER SELECTION ───────────────────────────────────────────────────────────
  const handleOrderSelect = useCallback(async (value) => {
    setValue("ogSaleOrderNo", value, { shouldDirty: true });
    if (!value || !projectCode) return;
    setLookupLoading(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.ORDER_LOOKUP}?ogSaleOrderNo=${encodeURIComponent(value)}&projectCode=${projectCode}&mode=${BILL_MODE}`,
        method: "GET",
      });
      const d = res.data || {};
      if (d.preCertifiedAmount !== undefined)
        setValue("preCertifiedAmount", d.preCertifiedAmount, { shouldDirty: true });
      const mapOrderItem = (it, type) => ({
        type,
        ogSaleOrderItemId: it.id || it.ogSaleOrderItemId || null,
        itemDisplayCode:   it.itemDisplayCode || it.itemCode  || "",
        itemCode:          it.itemCode        || "",
        itemName:          it.itemName        || "",
        itemDescription:   it.itemDescription || it.description || "",
        unit:              it.unit            || "",
        orderQty:          it.orderQty        || it.qty || "",
        claimQty:          "",
        certifiedQty:      it.certifiedQty    ?? 0,
        certifiedAmount:   it.certifiedAmount ?? 0,
        rate:              it.rate            || "",
        gstPercent:        it.gstPercent      || it.gst  || "",
      });
      const items = [
        ...(d.boqItems || []).map((it) => mapOrderItem(it, "boq")),
        ...(d.items    || []).map((it) => mapOrderItem(it, "non-boq")),
      ];
      if (items.length) setValue("items", items, { shouldDirty: true });
    } catch {
      toast.error("Failed to load order details");
    } finally {
      setLookupLoading(false);
    }
  }, [projectCode, setValue]);

  // ── FETCH DETAIL ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !billId) return;
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.GET_BY_ID}${billId}`,
          method: "GET",
        });
        const d = res.data;
        const mapDetailItem = (it, type) => ({
          type,
          ogSaleOrderItemId: it.ogSaleOrderItemId || null,
          itemDisplayCode:   it.itemDisplayCode   || it.itemCode || "",
          itemCode:          it.itemCode           || "",
          itemName:          it.itemName           || "",
          itemDescription:   it.itemDescription   || "",
          unit:              it.unit               || "",
          orderQty:          it.orderQty           || "",
          claimQty:          it.claimQty           || "",
          certifiedQty:      it.certifiedQty       ?? 0,
          certifiedAmount:   it.certifiedAmount    ?? 0,
          rate:              it.rate               || "",
          gstPercent:        it.gstPercent         || "",
        });
        const formatted = {
          ogSaleOrderNo:      d.ogSaleOrderNo      || "",
          billingDate:        d.billingDate         || "",
          title:              d.title               || "",
          jobLocation:        d.jobLocation         || "",
          preCertifiedAmount: d.preCertifiedAmount  || "",
          items: [
            ...(d.boqItems || []).map((it) => mapDetailItem(it, "boq")),
            ...(d.items    || []).map((it) => mapDetailItem(it, "non-boq")),
          ],
        };
        if (!formatted.items.length) formatted.items = [{ ...DEFAULT_ITEM }];
        reset(formatted);
        setInitialData(formatted);
        setExistingUrl(d.attachment || "");
        setInitialUrl(d.attachment  || "");
        setBillUuid(d.billingUuid || "");
        setBillingNo(d.billingNo  || "");
        onUuid?.(d.billingUuid || "");
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
    fd.append("mode",          BILL_MODE);
    if (mode === "create") fd.append("projectCode", projectCode);
    fd.append("ogSaleOrderNo", v.ogSaleOrderNo || "");
    fd.append("billingDate",   v.billingDate   || "");
    fd.append("title",         v.title         || "");
    fd.append("jobLocation",   v.jobLocation   || "");
    const serializeItems = (list) =>
      JSON.stringify(
        list.map((it, i) => ({
          slNo:              i + 1,
          ogSaleOrderItemId: it.ogSaleOrderItemId || null,
          orderQty:          Number(it.orderQty   || 0),
          claimQty:          Number(it.claimQty   || 0),
          rate:              Number(it.rate        || 0),
          gstPercent:        Number(it.gstPercent  || 0),
        })),
      );
    const nonBoqItems = (v.items || []).filter((it) => it.type !== "boq");
    const boqItems    = (v.items || []).filter((it) => it.type === "boq");
    fd.append("items",    serializeItems(nonBoqItems));
    fd.append("boqItems", serializeItems(boqItems));
    if (file) fd.append("attachment", file);
    else if (mode === "edit" && !existingUrl) fd.append("clearAttachment", "true");
    return fd;
  };

  // ── SAVE DRAFT ────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url:    mode === "create"
          ? API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.CREATE
          : `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.UPDATE}${billId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });
      setExistingUrl(res.data?.attachment ?? existingUrl);
      setInitialUrl(res.data?.attachment  ?? existingUrl);
      setFile(null);
      setFileResetKey((k) => k + 1);
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success(
        mode === "create" ? "Sale Bill created successfully" : "Sale Bill updated successfully",
        { id: tid },
      );
      if (res.data?.billingNo) setBillingNo(res.data.billingNo);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/project-management/customer-billing/sale-bill-claim/${newId}`), 400);
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
        url:    `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.SUBMIT}${billId}`,
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

  // ── TAB BAR ────────────────────────────────────────────────────────────────────
  const tabBarJsx = (
    <div className="flex border-b border-[#b5b5b5] mb-3">
      <button
        type="button"
        onClick={() => setActiveTab("entry")}
        className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
          activeTab === "entry"
            ? "border-[#3b6ea5] text-[#3b6ea5] bg-[#eef4fb]"
            : "border-transparent text-[#666] hover:text-[#3b6ea5] hover:bg-[#f5f9fd]"
        }`}
      >
        <ClipboardList size={15} />
        Entry
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("view")}
        className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
          activeTab === "view"
            ? "border-[#3b6ea5] text-[#3b6ea5] bg-[#eef4fb]"
            : "border-transparent text-[#666] hover:text-[#3b6ea5] hover:bg-[#f5f9fd]"
        }`}
      >
        <TableProperties size={15} />
        Certification Statement
      </button>
    </div>
  );

  // ── ENTRY TABLE (Tab 1) ────────────────────────────────────────────────────────
  const renderEntryCell = (colId, index) => {
      const item     = watchedItems[index] || {};
      const orderQty = Number(item.orderQty || 0);
      const claimQty = Number(item.claimQty || 0);
      const overQty  = !disabled && claimQty > orderQty && orderQty > 0;

      switch (colId) {
        case "sl":
          return <td key={colId} className="border border-[#ccc] text-center bg-[#edf4fb] text-[13px] font-medium align-middle">{index + 1}</td>;
        case "itemCode":
          return (
            <td key={colId} className="border border-[#ccc] p-0 align-middle">
              <input {...register(`items.${index}.itemDisplayCode`)} disabled placeholder="—"
                className={`${getInputClass(false, true)} border-0 rounded-none w-full h-[30px] text-[13px] px-1`} />
              <input {...register(`items.${index}.itemCode`)} type="hidden" />
              <input {...register(`items.${index}.ogSaleOrderItemId`)} type="hidden" />
              <input {...register(`items.${index}.type`)} type="hidden" />
              <input {...register(`items.${index}.certifiedQty`)} type="hidden" />
              <input {...register(`items.${index}.certifiedAmount`)} type="hidden" />
              <input {...register(`items.${index}.orderQty`)} type="hidden" />
              <input {...register(`items.${index}.rate`)} type="hidden" />
            </td>
          );
        case "itemName":
          return (
            <td key={colId} className="border border-[#ccc] p-0">
              <Controller name={`items.${index}.itemName`} control={control}
                render={({ field: f }) => <ExpandableTextCell value={f.value || ""} onChange={f.onChange} disabled={true} label="Item Name" placeholder="—" textSize="text-[13px]" />} />
              <Controller name={`items.${index}.itemDescription`} control={control}
                render={({ field: f }) => <ExpandableTextCell value={f.value || ""} onChange={f.onChange} disabled={true} label="Description" placeholder="—" />} />
            </td>
          );
        case "unit":
          return (
            <td key={colId} className="border border-[#ccc] p-0 align-middle">
              <input {...register(`items.${index}.unit`)} disabled placeholder="—"
                className={`${getInputClass(false, true)} border-0 rounded-none w-full h-[30px] text-[13px] text-center`} />
            </td>
          );
        case "orderQty":
          return (
            <td key={colId} className="border border-[#ccc] bg-[#f0f4f8] px-2 text-[13px] text-right align-middle text-[#555]">
              {orderQty > 0 ? formatQtyDisplay(orderQty) : "—"}
            </td>
          );
        case "rate":
          return (
            <td key={colId} className="border border-[#ccc] bg-[#f0f4f8] px-2 text-[13px] text-right align-middle text-[#555]">
              {formatAmount(Number(item.rate || 0))}
            </td>
          );
        case "claimQty":
          return (
            <td key={colId} className="border border-[#ccc] p-0 align-middle">
              <Controller control={control} name={`items.${index}.claimQty`}
                render={({ field: f }) => (
                  <QtyInput {...f} onChange={(e) => f.onChange(e.target.value)} disabled={disabled} placeholder="0"
                    title={overQty ? `Above order qty (${orderQty})` : undefined}
                    className={`${overQty ? "border-orange-400 bg-orange-50 text-orange-700" : getInputClass(errors?.items?.[index]?.claimQty, disabled)} border-0 rounded-none w-full h-[30px] text-[13px] text-right pr-2`} />
                )} />
            </td>
          );
        case "gstPct":
          return (
            <td key={colId} className="border border-[#ccc] p-0 align-middle">
              <GstInput {...register(`items.${index}.gstPercent`)} value={item.gstPercent ?? ""} disabled={disabled} placeholder="0"
                className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[30px] text-[13px] text-right pr-2`} />
            </td>
          );
        default: return null;
      }
    };

  const entryTableJsx = (
    <div className="border border-[#b5b5b5]">
      <div className="bg-[#d6e4f5] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[15px] text-[#1c3a5e]">
        Bill of Quantity [BOQ] — Claim Entry
      </div>
      <div className="overflow-x-auto overflow-y-auto lg:max-h-[calc(100vh-300px)]">
        <table ref={entryRef} className="w-full border-collapse table-fixed text-sm" style={{ minWidth: 700 }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#3b6ea5] text-white">
              {entryOrder.map((colId) => {
                const col = ENTRY_COLS.find((c) => c.id === colId);
                return (
                  <th
                    key={colId}
                    {...entryThProps(colId, `border border-[#2a5080] text-[13px] py-1.5 ${col.thClass}`)}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={ENTRY_COLS.length} className="text-center text-[13px] text-[#888] py-8 italic border border-[#ccc]">
                  Select an order above to populate items
                </td>
              </tr>
            )}
            {fields.map((field, index) => (
              <tr key={field.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f8fc]"}>
                {entryOrder.map((colId) => renderEntryCell(colId, index))}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-10 bg-[#b7d5f0]">
            <tr className="font-bold text-[13px]">
              {entryOrder.map((colId) => {
                if (colId === "orderQty") return <td key={colId} className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatQtyDisplay(watchedItems.reduce((s, it) => s + Number(it?.orderQty || 0), 0))}</td>;
                if (colId === "claimQty") return <td key={colId} className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatQtyDisplay(watchedItems.reduce((s, it) => s + Number(it?.claimQty || 0), 0))}</td>;
                if (colId === "rate")     return <td key={colId} className="border border-[#9ec5e0] px-2 text-right text-[#1c3a5e]">TOTAL</td>;
                return <td key={colId} className="border border-[#9ec5e0]" />;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  // ── VIEW TABLE totals (top-level, not inside a sub-component) ───────────────
  const vtotPrevQty = watchedItems.reduce((s, it) => s + Number(it?.certifiedQty   || 0), 0);
  const vtotThisQty = watchedItems.reduce((s, it) => s + Number(it?.claimQty       || 0), 0);
  const vtotCumQty  = vtotPrevQty + vtotThisQty;
  const vtotPrevAmt = watchedItems.reduce((s, it) => s + Number(it?.certifiedAmount || 0), 0);
  const vtotThisAmt = watchedItems.reduce((s, it) => s + Number(it?.claimQty || 0) * Number(it?.rate || 0), 0);
  const vtotCumAmt  = vtotPrevAmt + vtotThisAmt;
  const vtotGstAmt  = watchedItems.reduce((s, it) => {
    const a = Number(it?.claimQty || 0) * Number(it?.rate || 0);
    return s + a * Number(it?.gstPercent || 0) / 100;
  }, 0);

  const handleDownloadPdf = async () => {
    if (watchedItems.length === 0) { toast.error("No items to export"); return; }
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });

    const billNo = billingNo || `#${billId}` || "draft";
    const billDt = watch("billingDate") || "—";
    doc.setFontSize(14);
    doc.setTextColor(28, 58, 94);
    doc.text("Certification Statement", 14, 14);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Bill No: ${billNo}   Date: ${billDt}`, 14, 20);

    const head = [
      [
        { content: "SL",        rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Item Code", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Item Name", rowSpan: 2, styles: { halign: "left",   valign: "middle" } },
        { content: "Order Qty", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Unit",      rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Rate",      rowSpan: 2, styles: { halign: "right",  valign: "middle" } },
        { content: "Claim Quantity", colSpan: 3, styles: { halign: "center", fillColor: [37, 80, 122] } },
        { content: "GST %",     rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "GST Amount",rowSpan: 2, styles: { halign: "right",  valign: "middle" } },
        { content: "Claim Amount",   colSpan: 3, styles: { halign: "center", fillColor: [26, 77, 46] } },
      ],
      [
        { content: "Prev Certified", styles: { halign: "right", fillColor: [59, 110, 165] } },
        { content: "This Claim",     styles: { halign: "right", fillColor: [59, 110, 165] } },
        { content: "Cumulative",     styles: { halign: "right", fillColor: [59, 110, 165] } },
        { content: "Prev Certified", styles: { halign: "right", fillColor: [45, 110, 71] } },
        { content: "This Claim",     styles: { halign: "right", fillColor: [45, 110, 71] } },
        { content: "Cumulative",     styles: { halign: "right", fillColor: [45, 110, 71] } },
      ],
    ];

    const body = watchedItems.map((it, i) => {
      const certQty    = Number(it?.certifiedQty    || 0);
      const claimQty   = Number(it?.claimQty        || 0);
      const cumQty     = certQty + claimQty;
      const rate       = Number(it?.rate            || 0);
      const gstPct     = Number(it?.gstPercent      || 0);
      const certAmt    = Number(it?.certifiedAmount || 0);
      const thisBillAmt= claimQty * rate;
      const cumAmt     = certAmt + thisBillAmt;
      const gstAmt     = thisBillAmt * gstPct / 100;
      return [
        i + 1,
        it?.itemDisplayCode || it?.itemCode || "—",
        `${it?.itemName || ""}${it?.itemDescription ? `\n${it.itemDescription}` : ""}`,
        Number(it?.orderQty || 0) > 0 ? formatQtyDisplay(Number(it.orderQty)) : "—",
        it?.unit || "—",
        formatAmount(rate),
        certQty    > 0 ? formatQtyDisplay(certQty)    : "—",
        claimQty   > 0 ? formatQtyDisplay(claimQty)   : "—",
        formatQtyDisplay(cumQty),
        gstPct     > 0 ? `${gstPct}%`                 : "—",
        gstAmt     > 0 ? formatAmount(gstAmt)          : "—",
        certAmt    > 0 ? formatAmount(certAmt)         : "—",
        thisBillAmt> 0 ? formatAmount(thisBillAmt)     : "—",
        cumAmt     > 0 ? formatAmount(cumAmt)          : "—",
      ];
    });

    body.push([
      { content: "TOTAL", colSpan: 6, styles: { fontStyle: "bold", halign: "right", fillColor: [183, 213, 240] } },
      { content: formatQtyDisplay(vtotPrevQty), styles: { fontStyle: "bold", halign: "right", fillColor: [183, 213, 240] } },
      { content: formatQtyDisplay(vtotThisQty), styles: { fontStyle: "bold", halign: "right", fillColor: [183, 213, 240] } },
      { content: formatQtyDisplay(vtotCumQty),  styles: { fontStyle: "bold", halign: "right", fillColor: [183, 213, 240] } },
      { content: "",                             styles: { fillColor: [183, 213, 240] } },
      { content: formatAmount(vtotGstAmt),       styles: { fontStyle: "bold", halign: "right", fillColor: [183, 213, 240] } },
      { content: formatAmount(vtotPrevAmt),      styles: { fontStyle: "bold", halign: "right", fillColor: [183, 213, 240] } },
      { content: formatAmount(vtotThisAmt),      styles: { fontStyle: "bold", halign: "right", fillColor: [183, 213, 240] } },
      { content: formatAmount(vtotCumAmt),       styles: { fontStyle: "bold", halign: "right", fillColor: [183, 213, 240] } },
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 25,
      theme: "grid",
      headStyles: { fillColor: [28, 58, 94], textColor: 255, fontStyle: "bold", fontSize: 8, valign: "middle" },
      bodyStyles: { fontSize: 8, valign: "middle" },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center" },
        1: { cellWidth: 20, halign: "left"   },
        2: { cellWidth: 55, halign: "left"   },
        3: { cellWidth: 18, halign: "right"  },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 18, halign: "right"  },
        6: { cellWidth: 22, halign: "right"  },
        7: { cellWidth: 22, halign: "right"  },
        8: { cellWidth: 22, halign: "right"  },
        9: { cellWidth: 14, halign: "right"  },
        10:{ cellWidth: 22, halign: "right"  },
        11:{ cellWidth: 22, halign: "right"  },
        12:{ cellWidth: 22, halign: "right"  },
        13:{ cellWidth: 22, halign: "right"  },
      },
      alternateRowStyles: { fillColor: [245, 248, 252] },
    });

    doc.save(`claim-statement-${billNo}.pdf`);
  };

  const viewTableJsx = (
      <div className="border border-[#b5b5b5]">
        {/* header row with download button */}
        <div className="bg-[#d6e4f5] px-3 py-1.5 border-b border-[#b5b5b5] flex items-center justify-between">
          <span className="font-bold text-[15px] text-[#1c3a5e]">Certification Statement</span>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1 text-[13px] bg-[#3b6ea5] text-white rounded hover:bg-[#2a5080] transition-colors"
          >
            <Download size={14} />
            Download PDF
          </button>
        </div>

        <div className="overflow-x-auto overflow-y-auto lg:max-h-[calc(100vh-300px)]">
          <table ref={viewRef} className="w-full border-collapse table-fixed text-[13px]" style={{ minWidth: 1300 }}>
            <thead className="sticky top-0 z-20">
              {/* Row 1: group headers — driven by viewOrder for drag-to-reorder */}
              <tr className="bg-[#1c3a5e] text-white text-center">
                {viewOrder.map((colId) => {
                  const col = VIEW_GROUP_COLS.find((c) => c.id === colId);
                  if (col.colSpan) {
                    return (
                      <th key={colId} colSpan={col.colSpan}
                        {...viewThProps(colId, `border border-[#0f2540] py-1 ${col.groupBg} ${col.thClass}`)}
                      >
                        {col.label}
                      </th>
                    );
                  }
                  return (
                    <th key={colId} rowSpan={2}
                      {...viewThProps(colId, `border border-[#0f2540] py-1.5 px-2 ${col.thClass}`)}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
              {/* Row 2: individual <th> for each sub-column so useColumnResize can find them */}
              <tr className="bg-[#3b6ea5] text-white text-center text-[12px]">
                {viewOrder.filter((id) => id === "certQty" || id === "certAmt").map((colId) =>
                  colId === "certQty" ? (
                    <>
                      <th key="prevQty-h" className="border border-[#2a5080] py-1 px-1 w-[90px]">Previous</th>
                      <th key="thisQty-h" className="border border-[#2a5080] py-1 px-1 w-[90px]">This Bill</th>
                      <th key="cumQty-h"  className="border border-[#2a5080] py-1 px-1 w-[90px]">Cumulative</th>
                    </>
                  ) : (
                    <>
                      <th key="prevAmt-h" className="border border-[#2a5080] py-1 px-1 w-[105px] bg-[#2d6e47]">Previous</th>
                      <th key="thisAmt-h" className="border border-[#2a5080] py-1 px-1 w-[105px] bg-[#2d6e47]">This Bill</th>
                      <th key="cumAmt-h"  className="border border-[#2a5080] py-1 px-1 w-[105px] bg-[#2d6e47]">Cumulative</th>
                    </>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {watchedItems.length === 0 && (
                <tr>
                  <td colSpan={viewOrder.reduce((n, id) => n + (VIEW_GROUP_COLS.find(c=>c.id===id)?.colSpan || 1), 0)}
                    className="text-center text-[#888] py-8 italic border border-[#ccc]">
                    No items
                  </td>
                </tr>
              )}
              {watchedItems.map((item, index) => {
                const certQty     = Number(item?.certifiedQty   || 0);
                const claimQty    = Number(item?.claimQty       || 0);
                const certAmt     = Number(item?.certifiedAmount || 0);
                const rate        = Number(item?.rate           || 0);
                const gstPct      = Number(item?.gstPercent     || 0);
                const thisBillAmt = claimQty * rate;
                const gstAmt      = thisBillAmt * gstPct / 100;
                const cumQty      = certQty + claimQty;
                const cumAmt      = certAmt + thisBillAmt;
                const rowBg       = index % 2 === 0 ? "bg-white" : "bg-[#f5f8fc]";

                const viewCell = (colId) => {
                  switch (colId) {
                    case "sl":       return <td key={colId} className="border border-[#ccc] text-center align-middle font-medium bg-[#edf4fb]">{index + 1}</td>;
                    case "itemCode": return <td key={colId} className="border border-[#ccc] px-2 align-middle text-[#555]">{item?.itemDisplayCode || item?.itemCode || "—"}</td>;
                    case "itemName": return (
                      <td key={colId} className="border border-[#ccc] p-0">
                        <ExpandableTextCell value={item?.itemName || ""} onChange={() => {}} disabled label="Item Name" placeholder="—" textSize="text-[13px] font-medium" />
                        {item?.itemDescription && <ExpandableTextCell value={item.itemDescription} onChange={() => {}} disabled label="Description" placeholder="" />}
                      </td>
                    );
                    case "orderQty": return <td key={colId} className="border border-[#ccc] px-2 text-right align-middle text-[#555]">{Number(item?.orderQty || 0) > 0 ? formatQtyDisplay(Number(item?.orderQty || 0)) : "—"}</td>;
                    case "unit":     return <td key={colId} className="border border-[#ccc] text-center align-middle text-[#555]">{item?.unit || "—"}</td>;
                    case "rate":     return <td key={colId} className="border border-[#ccc] px-2 text-right align-middle text-[#555]">{formatAmount(rate)}</td>;
                    case "certQty":  return (
                      <>
                        <td key="prevQty" className="border border-[#ccc] px-2 text-right align-middle bg-[#f0f4f8]">{certQty > 0 ? formatQtyDisplay(certQty) : "—"}</td>
                        <td key="thisQty" className="border border-[#ccc] px-2 text-right align-middle font-medium bg-[#e8f0f8]">{claimQty > 0 ? formatQtyDisplay(claimQty) : "—"}</td>
                        <td key="cumQty"  className="border border-[#ccc] px-2 text-right align-middle font-semibold bg-[#dce8f5]">{cumQty > 0 ? formatQtyDisplay(cumQty) : "—"}</td>
                      </>
                    );
                    case "gstPct":  return <td key={colId} className="border border-[#ccc] px-2 text-right align-middle text-[#555]">{gstPct > 0 ? `${gstPct}%` : "—"}</td>;
                    case "gstAmt":  return <td key={colId} className="border border-[#ccc] px-2 text-right align-middle font-medium">{gstAmt > 0 ? formatAmount(gstAmt) : "—"}</td>;
                    case "certAmt": return (
                      <>
                        <td key="prevAmt" className="border border-[#ccc] px-2 text-right align-middle bg-[#f0f7f2]">{certAmt > 0 ? formatAmount(certAmt) : "—"}</td>
                        <td key="thisAmt" className="border border-[#ccc] px-2 text-right align-middle font-medium bg-[#e4f2ea]">{thisBillAmt > 0 ? formatAmount(thisBillAmt) : "—"}</td>
                        <td key="cumAmt"  className="border border-[#ccc] px-2 text-right align-middle font-semibold bg-[#d6edde]">{cumAmt > 0 ? formatAmount(cumAmt) : "—"}</td>
                      </>
                    );
                    default: return null;
                  }
                };

                return (
                  <tr key={index} className={rowBg}>
                    {viewOrder.map((colId) => viewCell(colId))}
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-[#b7d5f0] font-bold text-[13px]">
                {viewOrder.map((colId) => {
                  switch (colId) {
                    case "sl":      return <td key={colId} className="border border-[#9ec5e0]" />;
                    case "itemCode":return <td key={colId} className="border border-[#9ec5e0]" />;
                    case "itemName":return <td key={colId} className="border border-[#9ec5e0] px-2 text-right text-[#1c3a5e]">TOTAL AMOUNT (BASIC)</td>;
                    case "orderQty":return <td key={colId} className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatQtyDisplay(watchedItems.reduce((s,it)=>s+Number(it?.orderQty||0),0))}</td>;
                    case "unit":    return <td key={colId} className="border border-[#9ec5e0]" />;
                    case "rate":    return <td key={colId} className="border border-[#9ec5e0]" />;
                    case "certQty": return (
                      <>
                        <td key="fprevQty" className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatQtyDisplay(vtotPrevQty)}</td>
                        <td key="fthisQty" className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatQtyDisplay(vtotThisQty)}</td>
                        <td key="fcumQty"  className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatQtyDisplay(vtotCumQty)}</td>
                      </>
                    );
                    case "gstPct":  return <td key={colId} className="border border-[#9ec5e0]" />;
                    case "gstAmt":  return <td key={colId} className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(vtotGstAmt)}</td>;
                    case "certAmt": return (
                      <>
                        <td key="fprevAmt" className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(vtotPrevAmt)}</td>
                        <td key="fthisAmt" className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(vtotThisAmt)}</td>
                        <td key="fcumAmt"  className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(vtotCumAmt)}</td>
                      </>
                    );
                    default: return null;
                  }
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
  );

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
          <PMSection title="Sale Bill Details:">

            <PMFormRow label="Order No" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="flex-1">
                <SearchableSelect
                  options={saleOrderOpts}
                  value={watch("ogSaleOrderNo") || ""}
                  disabled={disabled || lookupLoading}
                  onChange={(value) => handleOrderSelect(value)}
                  placeholder={lookupLoading ? "Loading…" : "Select Order"}
                  labelKey="displayLabel"
                  valueKey="ogSaleOrderNo"
                  searchKeys={["ogSaleOrderNo", "orderTitle", "displayLabel"]}
                />
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
              </div>
            </PMFormRow>

            <PMFormRow label="Pre Certified" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="max-w-[180px]">
                <input
                  type="text"
                  value={formatAmount(watch("preCertifiedAmount") || 0)}
                  disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#b5b5b5] bg-[#f5f5f5] text-right px-2 text-[#555] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="This Bill (Basic)" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(thisBillBasic)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="GST Amount" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(gstAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="Total Claim" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(totalClaim)} disabled readOnly
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

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
        <div className="w-full lg:flex-1 min-w-0">

          {tabBarJsx}

          {activeTab === "entry" ? entryTableJsx : viewTableJsx}

          {/* ACTION BUTTONS */}
          {!isViewMode && (
            <div className="flex flex-wrap justify-end gap-3 pt-4 mt-4 border-t border-[#d8e6f0]">
              {isEditing && (
                <SaveDraftButton
                  onClick={() => handleSubmit(onSave)()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  requireConfirmation
                  confirmationTitle="Save Sale Bill as Draft?"
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
                confirmationTitle="Submit Sale Bill?"
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
