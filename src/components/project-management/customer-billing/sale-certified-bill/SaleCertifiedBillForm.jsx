"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useFieldArray, Controller } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen, Download } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton            from "@/components/common/SaveButton";
import SaveDraftButton       from "@/components/common/SaveDraftButton";
import EditButton            from "@/components/common/EditButton";
import DeleteRequestButton   from "@/components/common/DeleteRequestButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import FileUploadInput  from "@/components/project-management/common/FileUploadInput";
import PMSection        from "@/components/project-management/common/PMSection";
import PMFormRow        from "@/components/project-management/common/PMFormRow";
import PMDateInput      from "@/components/project-management/common/PMDateInput";
import PMTextarea          from "@/components/project-management/common/PMTextarea";
import ExpandableTextCell  from "@/components/project-management/common/ExpandableTextCell";
import QtyInput            from "@/components/common/QtyInput";
import AmountInput         from "@/components/common/AmountInput";
import GstInput            from "@/components/common/GstInput";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass }   from "@/lib/formStyles";
import { useResizableTable } from "@/hooks/useResizableTable";
import { zodDate } from "@/lib/dateUtils";

const BILL_MODE = "sale_certified_bill";

// ── COLUMN DEFINITIONS ────────────────────────────────────────────────────────
// Entry table: group-level cols (qtyGrp→5 sub-cols, amtGrp→4, gstGrp→3)
const CERT_COLS = [
  { id: "sl",       label: "SL",                      thClass: "w-[40px] text-center" },
  { id: "type",     label: "Type",                    thClass: "w-[75px] text-center" },
  { id: "itemCode", label: "Item Code",               thClass: "w-[100px] text-left px-2" },
  { id: "itemName", label: "Item Name & Description", thClass: "text-left px-2" },
  { id: "orderQty", label: "Order Qty",               thClass: "w-[85px] text-center" },
  { id: "rate",     label: "Rate",                    thClass: "w-[88px] text-center" },
  { id: "unit",     label: "Unit",                    thClass: "w-[60px] text-center" },
  { id: "qtyGrp",  label: "Quantity",                 thClass: "text-center", colSpan: 4, groupBg: "bg-[#25507a]" },
  { id: "amtGrp",  label: "Amount",                   thClass: "text-center", colSpan: 2, groupBg: "bg-[#1a4d2e]" },
  { id: "gstPct",  label: "GST % ✎",                  thClass: "w-[72px] text-center" },
];
// total leaf cols = 7 fixed + 3 qty + 3 amt = 12 (gstPct + gstAmt removed)
const CERT_TOTAL_COLS = 12;

// View table group-level columns (certQtyGrp / certAmtGrp each expand to 3 sub-columns)
const CERT_VIEW_COLS = [
  { id: "sl",          label: "SL",                      thClass: "w-[40px] text-center" },
  { id: "itemCode",    label: "Item Code",               thClass: "w-[100px] text-left px-2" },
  { id: "itemName",    label: "Item Name & Description", thClass: "text-left px-2" },
  { id: "orderQty",    label: "Order Qty",               thClass: "w-[85px] text-center" },
  { id: "rate",        label: "Rate",                    thClass: "w-[90px] text-center" },
  { id: "unit",        label: "Unit",                    thClass: "w-[65px] text-center" },
  { id: "certQtyGrp",  label: "Certified Quantity",      thClass: "text-center", colSpan: 3, groupBg: "bg-[#25507a]" },
  { id: "certAmtGrp",  label: "Certified Amount",        thClass: "text-center", colSpan: 3, groupBg: "bg-[#1a4d2e]" },
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
  orderQty:            z.coerce.number().min(0).optional(),
  claimQty:            z.coerce.number().min(0).optional(),
  preCertifiedQty:     z.coerce.number().min(0).optional(),
  certifiedQty:        z.coerce.number().min(0).optional(),
  preCertifiedAmount:  z.coerce.number().min(0).optional(),
  rate:                z.coerce.number().min(0).optional(),
  gstPercent:          z.coerce.number().min(0).optional(),
});

const schema = z.object({
  claimBillId:        z.coerce.number().min(1, "Claim Bill is required"),
  ogSaleOrderNo:     z.string().min(1, "Order No is required"),
  billingDate: zodDate(z, "billingDate", true),
  erpNo:              z.string().optional(),
  note:               z.string().optional(),
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
  orderQty:           "",
  claimQty:           "",
  preCertifiedQty:    0,
  certifiedQty:       "",
  preCertifiedAmount: 0,
  rate:               "",
  gstPercent:         "",
};

const defaultValues = {
  claimBillId:        null,
  ogSaleOrderNo:     "",
  billingDate:        "",
  erpNo:              "",
  note:               "",
  jobLocation:        "",
  preCertifiedAmount: "",
  items:              [],
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function SaleCertifiedBillForm({ mode = "create", billId, onAfterSubmit, onUuid }) {
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
  const [prevCertBillOpts, setPrevCertBillOpts] = useState([]);
  const [useLocations,    setUseLocations]    = useState([]);
  const [lookupLoading,   setLookupLoading]   = useState(false);
  const [billUuid,        setBillUuid]        = useState("");
  const [erpNo,           setErpNo]           = useState("");
  const [billNo,          setBillNo]          = useState("");

  const [file,         setFile]         = useState(null);
  const [existingUrl,  setExistingUrl]  = useState("");
  const [initialUrl,   setInitialUrl]   = useState("");
  const [fileResetKey, setFileResetKey] = useState(0);

  // ── RESIZABLE TABLE ───────────────────────────────────────────────────────────
  const { tableRef: viewRef, getThProps: viewThProps, columnOrder: viewOrder } =
    useResizableTable({ columns: CERT_VIEW_COLS, storageKey: "saleCertBillView" });

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
  const totalBillAmount       = thisBillAmount + gstAmount;
  const cumulativeCertAmount  = thisBillAmount + Number(watchedPreCertified || 0);

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
          displayLabel: o.orderNo || o.erpDocNumber,
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
      setClaimBillOpts(
        (Array.isArray(res.data) ? res.data : []).map((b) => ({
          ...b,
          displayLabel: b.erpNo,
        }))
      );
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
    setPrevCertBillOpts([]);
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
      const mapLookupItem = (it, type) => ({
        type,
        ogSaleOrderItemId:  it.id || it.ogSaleOrderItemId || null,
        itemDisplayCode:    it.itemDisplayCode || it.itemCode    || "",
        itemCode:           it.itemCode        || "",
        itemName:           it.itemName        || "",
        itemDescription:    it.itemDescription || it.description || "",
        unit:               it.unit            || "",
        orderQty:           it.orderQty        ?? "",
        claimQty:           it.claimQty        ?? "",
        preCertifiedQty:    it.preCertifiedQty ?? 0,
        certifiedQty:       it.claimQty        ?? "",
        preCertifiedAmount: it.preCertifiedAmount ?? 0,
        rate:               it.rate            || "",
        gstPercent:         it.gstPercent      || it.gst  || "",
      });
      const items = [
        ...(d.boqItems || []).map((it) => mapLookupItem(it, "boq")),
        ...(d.items    || []).map((it) => mapLookupItem(it, "non-boq")),
      ];
      if (items.length) setValue("items", items, { shouldDirty: true });

      // fetch prev approved cert bills for reference dropdown
      try {
        const certRes = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.CERT_BILLS_FOR_CLAIM}?claimBillId=${encodeURIComponent(id)}`,
          method: "GET",
        });
        setPrevCertBillOpts(
          (Array.isArray(certRes.data) ? certRes.data : []).map((b) => ({
            ...b,
            displayLabel: b.erpNo,
          }))
        );
      } catch {
        setPrevCertBillOpts([]);
      }
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
        const mapDetailItem = (it, type) => ({
          type,
          ogSaleOrderItemId:  it.ogSaleOrderItemId || null,
          itemDisplayCode:    it.itemDisplayCode   || it.itemCode || "",
          itemCode:           it.itemCode           || "",
          itemName:           it.itemName           || "",
          itemDescription:    it.itemDescription   || "",
          unit:               it.unit               || "",
          orderQty:           it.orderQty           || "",
          claimQty:           it.claimQty           || "",
          preCertifiedQty:    it.preCertifiedQty    ?? 0,
          certifiedQty:       it.certifiedQty       || "",
          preCertifiedAmount: it.preCertifiedAmount ?? 0,
          rate:               it.rate               || "",
          gstPercent:         it.gstPercent         || "",
        });
        const formatted = {
          claimBillId:        d.claimBillId         || null,
          ogSaleOrderNo:     d.ogSaleOrderNo       || "",
          billingDate:        d.billingDate           || "",
          erpNo:              d.erpNo                 || "",
          note:               d.note                  || "",
          jobLocation:        d.jobLocation           || "",
          preCertifiedAmount: d.preCertifiedAmount    || "",
          items: [
            ...(d.boqItems || []).map((it) => mapDetailItem(it, "boq")),
            ...(d.items    || []).map((it) => mapDetailItem(it, "non-boq")),
          ],
        };
        if (!formatted.items.length) formatted.items = [{ ...DEFAULT_ITEM }];
        reset(formatted);
        setInitialData(formatted);
        if (d.ogSaleOrderNo) fetchClaimBills(d.ogSaleOrderNo);
        if (d.claimBillId) {
          apiRequest({
            url:    `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.CERT_BILLS_FOR_CLAIM}?claimBillId=${d.claimBillId}`,
            method: "GET",
          }).then((r) => {
            setPrevCertBillOpts(
              (Array.isArray(r.data) ? r.data : []).map((b) => ({ ...b, displayLabel: b.erpNo }))
            );
          }).catch(() => setPrevCertBillOpts([]));
        }
        onUuid?.(d.billingUuid || "");
        setBillUuid(d.billingUuid || "");
        setErpNo(d.erpNo || "");
        setBillNo(d.billingNo || "");
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
    fd.append("note",        v.note         || "");
    fd.append("jobLocation", v.jobLocation  || "");
    const serializeItems = (list) =>
      JSON.stringify(
        list.map((it, i) => ({
          slNo:              i + 1,
          ogSaleOrderItemId: it.ogSaleOrderItemId || null,
          orderQty:          Number(it.orderQty    || 0),
          claimQty:          Number(it.certifiedQty || 0),
          rate:              Number(it.rate          || 0),
          gstPercent:        Number(it.gstPercent    || 0),
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
      setExistingUrl(res.data?.attachment ?? existingUrl);
      setInitialUrl(res.data?.attachment  ?? existingUrl);
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
        if (res.data?.billingUuid) setBillUuid(res.data.billingUuid);
        if (res.data?.erpNo)       setErpNo(res.data.erpNo);
        if (res.data?.billingNo)   setBillNo(res.data.billingNo);
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

  // ── VIEW TABLE TOTALS ─────────────────────────────────────────────────────────
  const vtotOrderQty = watchedItems.reduce((s, it) => s + Number(it?.orderQty || 0), 0);
  const vtotPrevQty  = watchedItems.reduce((s, it) => s + Number(it?.preCertifiedQty || 0), 0);
  const vtotThisQty  = watchedItems.reduce((s, it) => s + Number(it?.certifiedQty || 0), 0);
  const vtotCumQty   = vtotPrevQty + vtotThisQty;
  const vtotPrevAmt  = watchedItems.reduce((s, it) => s + Number(it?.preCertifiedAmount || 0), 0);
  const vtotThisAmt  = watchedItems.reduce((s, it) => s + Number(it?.certifiedQty || 0) * Number(it?.rate || 0), 0);
  const vtotCumAmt   = vtotPrevAmt + vtotThisAmt;
  const vtotGstAmt   = watchedItems.reduce((s, it) => {
    const a = Number(it?.certifiedQty || 0) * Number(it?.rate || 0);
    return s + a * Number(it?.gstPercent || 0) / 100;
  }, 0);

  const handleDownloadPdf = async () => {
    if (watchedItems.length === 0) { toast.error("No items to export"); return; }
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });

    // Header info
    const pdfBillNo = billNo || erpNo || `#${billId}` || "draft";
    const billDt = watch("billingDate") || "—";
    doc.setFontSize(14);
    doc.setTextColor(28, 58, 94);
    doc.text("Certification Statement", 14, 14);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Bill No: ${pdfBillNo}   Date: ${billDt}`, 14, 20);

    const head = [
      [
        { content: "SL",         rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Item Code",  rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Item Name",  rowSpan: 2, styles: { halign: "left",   valign: "middle" } },
        { content: "Rate",       rowSpan: 2, styles: { halign: "right",  valign: "middle" } },
        { content: "Order Qty",  rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Unit",       rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Certified Quantity", colSpan: 3, styles: { halign: "center", fillColor: [37, 80, 122] } },
        { content: "GST %",      rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "GST Amount", rowSpan: 2, styles: { halign: "right",  valign: "middle" } },
        { content: "Certified Amount",   colSpan: 3, styles: { halign: "center", fillColor: [26, 77, 46] } },
      ],
      [
        { content: "Previous",   styles: { halign: "right", fillColor: [59, 110, 165] } },
        { content: "This Bill",  styles: { halign: "right", fillColor: [59, 110, 165] } },
        { content: "Cumulative", styles: { halign: "right", fillColor: [59, 110, 165] } },
        { content: "Previous",   styles: { halign: "right", fillColor: [45, 110, 71] } },
        { content: "This Bill",  styles: { halign: "right", fillColor: [45, 110, 71] } },
        { content: "Cumulative", styles: { halign: "right", fillColor: [45, 110, 71] } },
      ],
    ];

    const body = watchedItems.map((it, i) => {
      const preCertQty = Number(it?.preCertifiedQty || 0);
      const certQty    = Number(it?.certifiedQty    || 0);
      const rate       = Number(it?.rate            || 0);
      const gstPct     = Number(it?.gstPercent      || 0);
      const preCertAmt = Number(it?.preCertifiedAmount || 0);
      const thisAmt    = certQty * rate;
      const cumAmt     = preCertAmt + thisAmt;
      const gstAmt     = thisAmt * gstPct / 100;
      return [
        i + 1,
        it?.itemDisplayCode || it?.itemCode || "—",
        `${it?.itemName || ""}${it?.itemDescription ? `\n${it.itemDescription}` : ""}`,
        formatAmount(rate),
        Number(it?.orderQty || 0) > 0 ? formatQtyDisplay(Number(it.orderQty)) : "—",
        it?.unit || "—",
        preCertQty > 0 ? formatQtyDisplay(preCertQty) : "—",
        certQty > 0    ? formatQtyDisplay(certQty)    : "—",
        formatQtyDisplay(preCertQty + certQty),
        gstPct > 0     ? `${gstPct}%`                 : "—",
        gstAmt > 0     ? formatAmount(gstAmt)          : "—",
        preCertAmt > 0 ? formatAmount(preCertAmt)      : "—",
        thisAmt > 0    ? formatAmount(thisAmt)         : "—",
        cumAmt > 0     ? formatAmount(cumAmt)          : "—",
      ];
    });

    // Totals row
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

    doc.save(`certification-statement-${pdfBillNo}.pdf`);
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

            <PMFormRow label="Order No" required labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="flex-1">
                <SearchableSelect
                  options={saleOrderOpts}
                  value={watch("ogSaleOrderNo") || ""}
                  disabled={disabled}
                  onChange={(value) => handleOrderSelect(value)}
                  placeholder="Select Order"
                  labelKey="displayLabel"
                  valueKey="erpDocNumber"
                  searchKeys={["erpDocNumber", "orderNo", "orderTitle", "displayLabel"]}
                />
                {errors.ogSaleOrderNo && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors.ogSaleOrderNo.message}</p>
                )}
              </div>
            </PMFormRow>

            <PMFormRow label="ERP No" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <input
                type="text"
                value={erpNo || ""}
                readOnly
                disabled
                placeholder="Auto-copied from claim bill"
                className="flex-1 h-[30px] text-[13px] rounded-sm border border-[#c9d5e0] bg-[#f0f4f8] px-2 text-[#555] outline-none w-full"
              />
            </PMFormRow>

            <PMFormRow label="Bill No" labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <input
                type="text"
                value={billNo || ""}
                readOnly
                disabled
                placeholder="Copied from claim bill"
                className="flex-1 h-[30px] text-[13px] rounded-sm border border-[#c9d5e0] bg-[#f0f4f8] px-2 text-[#555] outline-none w-full"
              />
            </PMFormRow>

            <PMFormRow label="Claim Bill" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <div className="flex-1">
                <SearchableSelect
                  options={claimBillOpts}
                  value={watch("claimBillId") || ""}
                  disabled={disabled || lookupLoading || claimBillLoading || !watch("ogSaleOrderNo")}
                  loading={claimBillLoading || lookupLoading}
                  onChange={(value) => handleClaimBillSelect(value)}
                  placeholder={!watch("ogSaleOrderNo") ? "Select order first" : "Select Claim Bill"}
                  labelKey="displayLabel"
                  valueKey="id"
                  searchKeys={["erpNo", "note", "displayLabel"]}
                />
                {errors.claimBillId && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors.claimBillId.message}</p>
                )}
              </div>
            </PMFormRow>

            {prevCertBillOpts.length > 0 && (() => {
              const latest = prevCertBillOpts[prevCertBillOpts.length - 1];
              return (
                <PMFormRow label="Latest Cert Bill" labelWidth="sm:w-[140px] sm:min-w-[140px]">
                  <a
                    href={`/project-management/customer-billing/sale-bill-certified/${latest.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-blue-600 underline hover:text-blue-800 font-medium"
                  >
                    {latest.erpNo}
                  </a>
                </PMFormRow>
              );
            })()}

            <PMFormRow label="Bill Date" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
              <PMDateInput
                {...register("billingDate")}
                disabled={disabled}
                hasError={errors.billingDate}
                className="max-w-[200px]"
              />
            </PMFormRow>

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

            <div>
              <span className="text-[13px] text-[#444444]">Note</span>
              <Controller
                name="note"
                control={control}
                render={({ field, fieldState }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    hasError={fieldState.error}
                    disabled={disabled}
                    title="Note"
                    placeholder="Text"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </div>

            {/* ── This Bill (Basic) Summary ─────────────────────────────────────── */}
            <p className="text-[12px] font-semibold text-[#1c3a5e] border-b border-[#5f8fbe] pb-0.5 mt-3 mb-1">
              This Bill (Basic) Summary
            </p>

            <PMFormRow label="This Bill (Basic)" labelWidth="sm:w-[155px] sm:min-w-[155px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(thisBillAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="GST Amount" labelWidth="sm:w-[155px] sm:min-w-[155px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(gstAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="Total Bill Amount" labelWidth="sm:w-[155px] sm:min-w-[155px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(totalBillAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            {/* ── Total Bill (Basic) Amount Summary ────────────────────────────── */}
            <p className="text-[12px] font-semibold text-[#1c3a5e] border-b border-[#5f8fbe] pb-0.5 mt-3 mb-1">
              Total Bill (Basic) Amount Summary
            </p>

            <PMFormRow label="Pre Certified Amount" labelWidth="sm:w-[155px] sm:min-w-[155px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(watch("preCertifiedAmount") || 0)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="This Bill Amount" labelWidth="sm:w-[155px] sm:min-w-[155px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(thisBillAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="Cumulative Bill Amount" labelWidth="sm:w-[155px] sm:min-w-[155px]">
              <div className="max-w-[180px]">
                <input type="text" value={formatAmount(cumulativeCertAmount)} disabled readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#3b6ea5] bg-[#c2d8ef] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
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

        {/* ── RIGHT PANEL: TWO TABS ───────────────────────────────────────────── */}
        <div className="w-full lg:flex-1 min-w-0">

          {false && (
          <div className="border border-[#b5b5b5]">
            <div className="bg-[#d6e4f5] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[15px] text-[#1c3a5e]">
              Certified Sale — Entry
            </div>
            <div className="overflow-x-auto overflow-y-auto lg:max-h-[calc(100vh-300px)]">
              <table ref={entryRef} className="w-full border-collapse table-fixed text-[13px]" style={{ minWidth: 1500 }}>
                <thead className="sticky top-0 z-20">
                  {/* Row 1: group headers */}
                  <tr className="bg-[#1c3a5e] text-white text-center">
                    {entryOrder.map((colId) => {
                      const col = CERT_COLS.find((c) => c.id === colId);
                      if (col.colSpan) {
                        return (
                          <th key={colId} colSpan={col.colSpan}
                            {...entryThProps(colId, `border border-[#0f2540] py-1 ${col.groupBg} ${col.thClass}`)}>
                            {col.label}
                          </th>
                        );
                      }
                      return (
                        <th key={colId} rowSpan={2}
                          {...entryThProps(colId, `border border-[#0f2540] py-1.5 px-2 ${col.thClass}`)}>
                          {col.label}
                        </th>
                      );
                    })}
                  </tr>
                  {/* Row 2: sub-headers; amber = editable */}
                  <tr className="bg-[#3b6ea5] text-white text-center text-[12px]">
                    {entryOrder.filter((id) => ["qtyGrp","amtGrp"].includes(id)).map((colId) => {
                      if (colId === "qtyGrp") return (
                        <React.Fragment key={colId}>
                          <th className="border border-[#2a5080] py-1 px-1 w-[85px]">Claim Qty</th>
                          <th className="border border-[#2a5080] py-1 px-1 w-[85px]">Pre Cert Qty</th>
                          <th className="border border-[#2a5080] py-1 px-1 w-[88px] bg-[#b06010]">Cert Qty ✎</th>
                          <th className="border border-[#2a5080] py-1 px-1 w-[90px]">Total Cert Qty</th>
                        </React.Fragment>
                      );
                      return (
                        <React.Fragment key={colId}>
                          <th className="border border-[#2a5080] py-1 px-1 w-[95px]">Cert Amt</th>
                          <th className="border border-[#2a5080] py-1 px-1 w-[105px]">Total Cert Amt</th>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {fields.length === 0 && (
                    <tr>
                      <td colSpan={CERT_TOTAL_COLS} className="text-center text-[#888] py-8 italic border border-[#ccc]">
                        Select an order, then a claim bill above to populate items
                      </td>
                    </tr>
                  )}
                  {fields.map((field, index) => {
                    const item               = watchedItems[index] || {};
                    const orderQty           = Number(item.orderQty           || 0);
                    const claimQty           = Number(item.claimQty           || 0);
                    const preCertifiedQty    = Number(item.preCertifiedQty    || 0);
                    const certifiedQty       = Number(item.certifiedQty       || 0);
                    const totalCertQty       = preCertifiedQty + certifiedQty;
                    const preCertifiedAmount = Number(item.preCertifiedAmount || 0);
                    const rate               = Number(item.rate               || 0);
                    const gstPct             = Number(item.gstPercent         || 0);
                    const certAmt            = certifiedQty * rate;
                    const totalCertAmt       = preCertifiedAmount + certAmt;
                    const gstAmt             = certAmt * gstPct / 100;
                    const overQty            = !disabled && certifiedQty > claimQty && claimQty > 0;
                    const rowBg              = index % 2 === 0 ? "bg-white" : "bg-[#f5f8fc]";

                    const renderCell = (colId) => {
                      switch (colId) {
                        case "sl":
                          return <td key={colId} className="border border-[#ccc] text-center bg-[#edf4fb] font-medium align-middle">{index + 1}</td>;
                        case "type":
                          return (
                            <td key={colId} className="border border-[#ccc] text-center align-middle text-[#555]">
                              {watch(`items.${index}.type`) === "boq" ? "BOQ" : "Non-BOQ"}
                              <input {...register(`items.${index}.type`)} type="hidden" />
                            </td>
                          );
                        case "itemCode":
                          return (
                            <td key={colId} className="border border-[#ccc] p-0 align-middle">
                              <input {...register(`items.${index}.itemDisplayCode`)} disabled placeholder="—"
                                className={`${getInputClass(false, true)} border-0 rounded-none w-full h-[30px] px-1`} />
                              <input {...register(`items.${index}.itemCode`)} type="hidden" />
                              <input {...register(`items.${index}.ogSaleOrderItemId`)} type="hidden" />
                            </td>
                          );
                        case "itemName":
                          return (
                            <td key={colId} className="border border-[#ccc] p-0">
                              <Controller name={`items.${index}.itemName`} control={control}
                                render={({ field: f }) => <ExpandableTextCell value={f.value || ""} onChange={f.onChange} disabled label="Item Name" placeholder="—" textSize="text-[13px]" />} />
                              <Controller name={`items.${index}.itemDescription`} control={control}
                                render={({ field: f }) => <ExpandableTextCell value={f.value || ""} onChange={f.onChange} disabled label="Item Description" placeholder="—" />} />
                            </td>
                          );
                        case "rate":
                          return (
                            <td key={colId} className="border border-[#ccc] p-0 align-middle bg-[#f0faf5]">
                              <AmountInput {...register(`items.${index}.rate`)} value={item.rate ?? ""} disabled={disabled} placeholder="0"
                                className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[30px] text-right pr-2`} />
                            </td>
                          );
                        case "orderQty":
                          return (
                            <td key={colId} className="border border-[#ccc] bg-[#f0f4f8] px-2 text-right align-middle text-[#555] whitespace-nowrap">
                              {orderQty > 0 ? formatQtyDisplay(orderQty) : "—"}
                              <input {...register(`items.${index}.orderQty`)} type="hidden" />
                            </td>
                          );
                        case "unit":
                          return (
                            <td key={colId} className="border border-[#ccc] p-0 align-middle">
                              <input {...register(`items.${index}.unit`)} disabled placeholder="—"
                                className={`${getInputClass(false, true)} border-0 rounded-none w-full h-[30px] text-center`} />
                            </td>
                          );
                        case "qtyGrp":
                          return (
                            <React.Fragment key={colId}>
                              <td className="border border-[#ccc] bg-[#f0f4f8] px-2 text-right align-middle text-[#555] whitespace-nowrap">
                                {claimQty > 0 ? formatQtyDisplay(claimQty) : "—"}
                              </td>
                              <td className="border border-[#ccc] bg-[#f0f4f8] px-2 text-right align-middle text-[#555] whitespace-nowrap">
                                {preCertifiedQty > 0 ? formatQtyDisplay(preCertifiedQty) : "—"}
                                <input {...register(`items.${index}.preCertifiedQty`)} type="hidden" />
                              </td>
                              <td className="border border-[#ccc] p-0 align-middle bg-[#fff8f0]">
                                <Controller control={control} name={`items.${index}.certifiedQty`}
                                  render={({ field: f }) => (
                                    <QtyInput {...f} onChange={(e) => f.onChange(e.target.value)} disabled={disabled} placeholder="0"
                                      title={overQty ? `Above claim qty (${claimQty})` : undefined}
                                      className={`${overQty ? "border-orange-400 bg-orange-50 text-orange-700" : getInputClass(errors?.items?.[index]?.certifiedQty, disabled)} border-0 rounded-none w-full h-[30px] text-right pr-2`} />
                                  )} />
                              </td>
                              <td className="border border-[#ccc] bg-[#edf8f0] px-2 font-medium text-right align-middle whitespace-nowrap">
                                {totalCertQty > 0 ? formatQtyDisplay(totalCertQty) : "—"}
                              </td>
                            </React.Fragment>
                          );
                        case "amtGrp":
                          return (
                            <React.Fragment key={colId}>
                              <td className="border border-[#ccc] bg-[#edf8ed] px-2 font-medium text-right align-middle whitespace-nowrap">{formatAmount(certAmt)}</td>
                              <td className="border border-[#ccc] bg-[#edf8f0] px-2 font-medium text-right align-middle whitespace-nowrap">{formatAmount(totalCertAmt)}</td>
                            </React.Fragment>
                          );
                        case "gstPct":
                          return (
                            <td key={colId} className="border border-[#ccc] p-0 align-middle bg-[#faf0ff]">
                              <GstInput {...register(`items.${index}.gstPercent`)} value={item.gstPercent ?? ""} disabled={disabled} placeholder="0"
                                className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[30px] text-right pr-2`} />
                              <input {...register(`items.${index}.claimQty`)} type="hidden" />
                              <input {...register(`items.${index}.preCertifiedAmount`)} type="hidden" />
                            </td>
                          );
                        default: return null;
                      }
                    };

                    return (
                      <tr key={field.id} className={rowBg}>
                        {entryOrder.map(renderCell)}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-10 bg-[#b7d5f0]">
                  <tr className="font-bold">
                    {entryOrder.map((colId) => {
                      switch (colId) {
                        case "sl":       return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "type":     return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "itemCode": return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "itemName": return <td key={colId} className="border border-[#9ec5e0] px-2 text-right text-[#1c3a5e]">TOTAL</td>;
                        case "rate":     return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "orderQty": return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "unit":     return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "qtyGrp":  return (
                          <React.Fragment key={colId}>
                            <td className="border border-[#9ec5e0]" />
                            <td className="border border-[#9ec5e0]" />
                            <td className="border border-[#9ec5e0]" />
                            <td className="border border-[#9ec5e0]" />
                          </React.Fragment>
                        );
                        case "amtGrp":  return (
                          <React.Fragment key={colId}>
                            <td className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(thisBillAmount)}</td>
                            <td className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(thisBillAmount)}</td>
                          </React.Fragment>
                        );
                        case "gstPct":  return <td key={colId} className="border border-[#9ec5e0]" />;
                        default: return null;
                      }
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          )}

          {/* ── CERTIFICATION STATEMENT ──────────────────────────────────────── */}
          {(
          <div className="border border-[#b5b5b5]">
            <div className="bg-[#d6e4f5] px-3 py-1.5 border-b border-[#b5b5b5] flex items-center justify-between">
              <span className="font-bold text-[15px] text-[#1c3a5e]">Certification Statement</span>
              <button type="button" onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 px-3 py-1 text-[13px] bg-[#3b6ea5] text-white rounded hover:bg-[#2a5080] transition-colors">
                <Download size={14} />Download PDF
              </button>
            </div>
            <div className="overflow-x-auto overflow-y-auto lg:max-h-[calc(100vh-300px)]">
              <table ref={viewRef} className="w-full border-collapse table-fixed text-[13px]" style={{ minWidth: 1300 }}>
                <thead className="sticky top-0 z-20">
                  {/* Row 1: group headers driven by viewOrder */}
                  <tr className="bg-[#1c3a5e] text-white text-center">
                    {viewOrder.map((colId) => {
                      const col = CERT_VIEW_COLS.find((c) => c.id === colId);
                      if (col.colSpan) {
                        return (
                          <th key={colId} colSpan={col.colSpan}
                            {...viewThProps(colId, `border border-[#0f2540] py-1 ${col.groupBg} ${col.thClass}`)}>
                            {col.label}
                          </th>
                        );
                      }
                      return (
                        <th key={colId} rowSpan={2}
                          {...viewThProps(colId, `border border-[#0f2540] py-1.5 px-2 ${col.thClass}`)}>
                          {col.label}
                        </th>
                      );
                    })}
                  </tr>
                  {/* Row 2: sub-headers for groups */}
                  <tr className="bg-[#3b6ea5] text-white text-center text-[12px]">
                    {viewOrder.filter((id) => id === "certQtyGrp" || id === "certAmtGrp").map((colId) =>
                      colId === "certQtyGrp" ? (
                        <React.Fragment key="certQtyGrp">
                          <th className="border border-[#2a5080] py-1 px-1 w-[90px]">Previous</th>
                          <th className="border border-[#2a5080] py-1 px-1 w-[90px]">This Bill</th>
                          <th className="border border-[#2a5080] py-1 px-1 w-[90px]">Cumulative</th>
                        </React.Fragment>
                      ) : (
                        <React.Fragment key="certAmtGrp">
                          <th className="border border-[#2a5080] py-1 px-1 w-[105px] bg-[#2d6e47]">Previous</th>
                          <th className="border border-[#2a5080] py-1 px-1 w-[105px] bg-[#2d6e47]">This Bill</th>
                          <th className="border border-[#2a5080] py-1 px-1 w-[105px] bg-[#2d6e47]">Cumulative</th>
                        </React.Fragment>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {watchedItems.length === 0 && (
                    <tr>
                      <td colSpan={viewOrder.reduce((n, id) => n + (CERT_VIEW_COLS.find(c=>c.id===id)?.colSpan||1), 0)}
                        className="text-center text-[#888] py-8 italic border border-[#ccc]">No items</td>
                    </tr>
                  )}
                  {fields.map((field, index) => {
                    const item        = watchedItems[index] || {};
                    const preCertQty  = Number(item?.preCertifiedQty    || 0);
                    const certQty     = Number(item?.certifiedQty       || 0);
                    const cumQty      = preCertQty + certQty;
                    const rate        = Number(item?.rate               || 0);
                    const gstPct      = Number(item?.gstPercent         || 0);
                    const preCertAmt  = Number(item?.preCertifiedAmount || 0);
                    const thisAmt     = certQty * rate;
                    const cumAmt      = preCertAmt + thisAmt;
                    const gstAmt      = thisAmt * gstPct / 100;
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
                        case "orderQty": return <td key={colId} className="border border-[#ccc] px-2 text-right align-middle text-[#555]">{Number(item?.orderQty||0)>0 ? formatQtyDisplay(Number(item?.orderQty||0)) : "—"}</td>;
                        case "unit":     return <td key={colId} className="border border-[#ccc] text-center align-middle text-[#555]">{item?.unit || "—"}</td>;
                        case "rate":     return <td key={colId} className="border border-[#ccc] px-2 text-right align-middle text-[#555]">{formatAmount(rate)}</td>;
                        case "certQtyGrp": return (
                          <React.Fragment key={colId}>
                            <td className="border border-[#ccc] px-2 text-right align-middle bg-[#f0f4f8]">
                              {preCertQty>0 ? formatQtyDisplay(preCertQty) : "—"}
                              <input {...register(`items.${index}.preCertifiedQty`)} type="hidden" />
                              <input {...register(`items.${index}.preCertifiedAmount`)} type="hidden" />
                              <input {...register(`items.${index}.claimQty`)} type="hidden" />
                            </td>
                            <td className="border border-[#ccc] p-0 align-middle bg-[#fff8f0]">
                              <Controller control={control} name={`items.${index}.certifiedQty`}
                                render={({ field: f }) => (
                                  <QtyInput {...f} onChange={(e) => f.onChange(e.target.value)} disabled={disabled}
                                    placeholder="0"
                                    className={`border-0 rounded-none w-full h-[30px] text-right pr-2 ${disabled ? "bg-[#e8f0f8] text-[#555]" : "bg-[#fff8f0]"}`} />
                                )} />
                            </td>
                            <td className="border border-[#ccc] px-2 text-right align-middle font-semibold bg-[#dce8f5]">
                              {cumQty>0 ? formatQtyDisplay(cumQty) : "—"}
                            </td>
                          </React.Fragment>
                        );
                        case "gstPct":   return (
                          <td key={colId} className="border border-[#ccc] p-0 align-middle">
                            <GstInput {...register(`items.${index}.gstPercent`)} value={item.gstPercent ?? ""} disabled={disabled} placeholder="0"
                              className={`border-0 rounded-none w-full h-[30px] text-right pr-2 ${disabled ? "bg-transparent text-[#555]" : "bg-[#faf0ff]"}`} />
                          </td>
                        );
                        case "gstAmt":   return <td key={colId} className="border border-[#ccc] px-2 text-right align-middle font-medium">{gstAmt>0 ? formatAmount(gstAmt) : "—"}</td>;
                        case "certAmtGrp": return (
                          <React.Fragment key={colId}>
                            <td className="border border-[#ccc] px-2 text-right align-middle bg-[#f0f7f2]">{preCertAmt>0 ? formatAmount(preCertAmt) : "—"}</td>
                            <td className="border border-[#ccc] px-2 text-right align-middle font-medium bg-[#e4f2ea]">{thisAmt>0 ? formatAmount(thisAmt) : "—"}</td>
                            <td className="border border-[#ccc] px-2 text-right align-middle font-semibold bg-[#d6edde]">{cumAmt>0 ? formatAmount(cumAmt) : "—"}</td>
                          </React.Fragment>
                        );
                        default: return null;
                      }
                    };

                    return (
                      <tr key={field.id} className={rowBg}>
                        {viewOrder.map((colId) => viewCell(colId))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-[#b7d5f0] font-bold text-[13px]">
                    {viewOrder.map((colId) => {
                      switch (colId) {
                        case "sl":       return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "itemCode": return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "itemName": return <td key={colId} className="border border-[#9ec5e0] px-2 text-right text-[#1c3a5e]">TOTAL</td>;
                        case "orderQty": return <td key={colId} className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(watchedItems.reduce((s,it)=>s+Number(it?.orderQty||0)*Number(it?.rate||0),0))}</td>;
                        case "unit":     return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "rate":     return <td key={colId} className="border border-[#9ec5e0]" />;
                        case "certQtyGrp": return (
                          <React.Fragment key={colId}>
                            <td className="border border-[#9ec5e0]" />
                            <td className="border border-[#9ec5e0]" />
                            <td className="border border-[#9ec5e0]" />
                          </React.Fragment>
                        );
                        case "certAmtGrp": return (
                          <React.Fragment key={colId}>
                            <td className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(vtotPrevAmt)}</td>
                            <td className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(vtotThisAmt)}</td>
                            <td className="border border-[#9ec5e0] px-2 text-right whitespace-nowrap">{formatAmount(vtotCumAmt)}</td>
                          </React.Fragment>
                        );
                        default: return null;
                      }
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          )}

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

              {mode === "edit" && !isEditing && billId && (
                <DeleteRequestButton
                  moduleCode="BILLING"
                  recordId={Number(billId)}
                  onDeleted={() => router.back()}
                />
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
