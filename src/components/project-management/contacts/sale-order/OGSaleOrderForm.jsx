"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, Controller } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton         from "@/components/common/SaveButton";
import SaveDraftButton    from "@/components/common/SaveDraftButton";
import EditButton         from "@/components/common/EditButton";
import FileUploadInput    from "@/components/project-management/common/FileUploadInput";
import PMSection          from "@/components/project-management/common/PMSection";
import PMFormRow          from "@/components/project-management/common/PMFormRow";
import PMInput            from "@/components/project-management/common/PMInput";
import PMDateInput        from "@/components/project-management/common/PMDateInput";
import PMTextarea         from "@/components/project-management/common/PMTextarea";
import ExpandableTextCell from "@/components/project-management/common/ExpandableTextCell";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass }   from "@/lib/formStyles";

// ── SCHEMA ────────────────────────────────────────────────────────────────────
const rowSchema = z.object({
  type:            z.enum(["boq", "non-boq"]).default("non-boq"),
  itemCode:        z.string().optional().default(""),
  itemName:        z.string().optional().default(""),
  itemDescription: z.string().optional().default(""),
  unit:            z.string().optional().default(""),
  orderQty:        z.coerce.number().min(0).optional(),
  rate:            z.coerce.number().min(0).optional(),
  gstPercent:      z.coerce.number().min(0).optional(),
});

const schema = z.object({
  ogSaleOrderNo:   z.string().optional(),
  ogSaleOrderDate: z.string().min(1, "Order Date is required"),
  orderNo:         z.string().optional(),
  orderValidity:   z.string().optional(),
  orderTitle:      z.string().min(1, "Order Title is required"),
  rows:            z.array(rowSchema).min(1),
});

const DEFAULT_ROW = {
  type:            "non-boq",
  itemCode:        "",
  itemName:        "",
  itemDescription: "",
  unit:            "",
  orderQty:        "",
  rate:            "",
  gstPercent:      "",
};

const defaultValues = {
  ogSaleOrderNo:   "",
  ogSaleOrderDate: "",
  orderNo:         "",
  orderValidity:   "",
  orderTitle:      "",
  rows:            [{ ...DEFAULT_ROW }],
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = (val) => {
  const n = Number(val);
  if (!val && val !== 0) return "";
  if (isNaN(n)) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const rowSubtotal = (item) =>
  Number(item?.orderQty || 0) * Number(item?.rate || 0);

const mapRow = (it, type) => ({
  type,
  itemCode:        it.itemCode        || "",
  itemName:        it.itemName        || "",
  itemDescription: it.itemDescription || "",
  unit:            it.unit            || "",
  orderQty:        it.orderQty        || "",
  rate:            it.rate            || "",
  gstPercent:      it.gstPercent      || "",
});

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function OGSaleOrderForm({ mode = "create", saleOrderId, onAfterSubmit, onUuid }) {
  const isViewMode  = mode === "view" || mode === "approver";
  const router      = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [isLoading,   setIsLoading]   = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unitOptions, setUnitOptions] = useState([]);

  const [files,        setFiles]        = useState({ att1: null, att2: null, att3: null });
  const [existingUrls, setExistingUrls] = useState({ att1: "", att2: "", att3: "" });
  const [initialUrls,  setInitialUrls]  = useState({ att1: "", att2: "", att3: "" });
  const [fileResetKey, setFileResetKey] = useState(0);

  const {
    register, control, handleSubmit, reset, getValues, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  const scrollRef = useRef(null);

  const addRow = () => {
    append({ ...DEFAULT_ROW });
    setTimeout(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 0);
  };

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── TOTALS ────────────────────────────────────────────────────────────────────
  const watchedRows = watch("rows") || [];

  const boqBasic  = watchedRows.filter((r) => r.type === "boq").reduce((s, it) => s + rowSubtotal(it), 0);
  const basicAmount = boqBasic;

  const gstAmount = watchedRows.filter((r) => r.type === "boq").reduce((s, it) => {
    return s + rowSubtotal(it) * Number(it?.gstPercent || 0) / 100;
  }, 0);

  const totalAmount = basicAmount + gstAmount;

  // ── FETCH UNIT LIST ───────────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_UNIT, method: "GET" })
      .then((res) => setUnitOptions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUnitOptions([]));
  }, []);

  // ── FETCH DETAIL ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !saleOrderId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.GET_BY_ID}${saleOrderId}`,
          method: "GET",
        });
        const d = res.data;

        const allRows = [
          ...(d.items    || []).map((it) => mapRow(it, "non-boq")),
          ...(d.boqItems || []).map((it) => mapRow(it, "boq")),
        ];

        const formatted = {
          ogSaleOrderNo:   d.ogSaleOrderNo   || "",
          ogSaleOrderDate: d.ogSaleOrderDate || "",
          orderNo:         d.orderNo         || "",
          orderValidity:   d.orderValidity   || "",
          orderTitle:      d.orderTitle      || "",
          rows: allRows.length ? allRows : [{ ...DEFAULT_ROW }],
        };

        reset(formatted);
        setInitialData(formatted);

        const urls = { att1: d.attachment1 || "", att2: d.attachment2 || "", att3: d.attachment3 || "" };
        setExistingUrls(urls);
        setInitialUrls(urls);

        onUuid?.(d.ogSaleOrderUuid || "");

        const editable = ["draft", "reback"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("Sale Order already Approved");
          else if (st === "Rejected") toast.info("Sale Order already Rejected");
          else                        toast.info("Sale Order already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Sale Order");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [saleOrderId, mode]);

  // ── EDIT / CANCEL ─────────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setFiles({ att1: null, att2: null, att3: null });
      setExistingUrls(initialUrls);
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

    if (mode === "create") fd.append("projectCode", projectCode);
    fd.append("ogSaleOrderDate", v.ogSaleOrderDate || "");
    fd.append("orderNo",         v.orderNo         || "");
    fd.append("orderValidity",   v.orderValidity   || "");
    fd.append("orderTitle",      v.orderTitle      || "");

    const serializeRows = (rows) =>
      JSON.stringify(
        (rows || [])
          .filter((it) => (it.itemCode || "").trim() || (it.itemName || "").trim())
          .map((it, i) => ({
            slNo:            i + 1,
            itemCode:        it.itemCode        || "",
            itemName:        it.itemName        || "",
            itemDescription: it.itemDescription || "",
            unit:            it.unit            || "",
            orderQty:        Number(it.orderQty   || 0),
            rate:            Number(it.rate       || 0),
            gstPercent:      Number(it.gstPercent || 0),
          })),
      );

    const allRows   = v.rows || [];
    const itemRows  = allRows.filter((r) => r.type === "non-boq");
    const boqRows   = allRows.filter((r) => r.type === "boq");

    fd.append("items",    serializeRows(itemRows));
    fd.append("boqItems", serializeRows(boqRows));

    if (files.att1) fd.append("attachment_1", files.att1);
    if (files.att2) fd.append("attachment_2", files.att2);
    if (files.att3) fd.append("attachment_3", files.att3);

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
          ? API_ENDPOINTS.PROJECT.OG_SALE_ORDER.CREATE
          : `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.UPDATE}${saleOrderId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });

      if (res?.data?.ogSaleOrderNo)   setValue("ogSaleOrderNo", res.data.ogSaleOrderNo);
      if (res?.data?.ogSaleOrderUuid) onUuid?.(res.data.ogSaleOrderUuid);

      const urls = {
        att1: res.data?.attachment1 || existingUrls.att1,
        att2: res.data?.attachment2 || existingUrls.att2,
        att3: res.data?.attachment3 || existingUrls.att3,
      };
      setExistingUrls(urls);
      setInitialUrls(urls);
      setFiles({ att1: null, att2: null, att3: null });
      setFileResetKey((k) => k + 1);
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);

      toast.success(
        mode === "create" ? "Sale Order created successfully" : "Sale Order updated successfully",
        { id: tid },
      );

      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/project-management/contacts/sale-order/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── SUBMIT FOR APPROVAL ───────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!saleOrderId) { toast.error("Please save first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.SUBMIT}${saleOrderId}`,
        method: "POST",
      });
      toast.success("Sale Order submitted for approval", { id: tid });
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

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <datalist id="unit-datalist">
        {unitOptions.map((u) => (
          <option key={u.unitId} value={u.unitName} />
        ))}
      </datalist>

      {/* PANEL TOGGLE */}
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Hide left panel" : "Show left panel"}
        className="mb-2 hidden lg:inline-flex p-1 rounded hover:bg-gray-100 text-gray-500 transition"
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[385px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          <PMSection title="Order Details:">
            <PMFormRow label="Sale Order Number" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput
                {...register("ogSaleOrderNo")}
                disabled
                placeholder="[Auto]"
                expandable={false}
                className="max-w-[160px]"
              />
            </PMFormRow>

            <PMFormRow label="Order Date" required={!disabled} labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMDateInput
                {...register("ogSaleOrderDate")}
                disabled={disabled}
                hasError={errors.ogSaleOrderDate}
                className="max-w-[200px]"
              />
            </PMFormRow>

            <PMFormRow label="Basic Amount" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput
                value={fmt(basicAmount)}
                readOnly
                disabled
                expandable={false}
                placeholder="0.00"
                className="max-w-[180px] text-right"
              />
            </PMFormRow>

            <PMFormRow label="GST Amount" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <div className="max-w-[180px]">
                <input
                  type="text"
                  value={fmt(gstAmount)}
                  disabled
                  readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>

            <PMFormRow label="Total Amount" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <div className="max-w-[180px]">
                <input
                  type="text"
                  value={fmt(totalAmount)}
                  disabled
                  readOnly
                  className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                />
              </div>
            </PMFormRow>
          </PMSection>

          <PMSection title="Additional Details:">
            <PMFormRow label="Ref. Order Number" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput
                {...register("orderNo")}
                disabled={disabled}
                expandable={false}
                placeholder="Client PO / Work Order No."
              />
            </PMFormRow>

            <PMFormRow label="Order Validity" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMDateInput
                {...register("orderValidity")}
                disabled={disabled}
                className="max-w-[200px]"
              />
            </PMFormRow>

            <div>
              <span className="text-[13px] text-[#444444]">
                Order Title{!disabled && <span className="text-red-500 ml-0.5">*</span>}
              </span>
              <Controller
                name="orderTitle"
                control={control}
                render={({ field, fieldState }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    hasError={fieldState.error}
                    disabled={disabled}
                    title="Order Title"
                    placeholder="Text"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </div>

            <div className="pt-2 space-y-1.5">
              {[
                { key: "att1", label: "Attachment 1" },
                { key: "att2", label: "Attachment 2" },
                { key: "att3", label: "Attachment 3" },
              ].map(({ key, label }) => (
                <FileUploadInput
                  key={key}
                  label={label}
                  showLabel
                  disabled={disabled}
                  existingFileUrl={existingUrls[key]}
                  onFileChange={(file) => setFiles((prev) => ({ ...prev, [key]: file }))}
                  onClearExisting={() => setExistingUrls((prev) => ({ ...prev, [key]: "" }))}
                  resetKey={fileResetKey}
                />
              ))}
            </div>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL: Unified Items Table ────────────────────────────────── */}
        <div className="w-full lg:flex-1 min-w-0 space-y-4">

          <div className="border border-[#b5b5b5]">
            <div className="bg-[#d6e4f5] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[15px] text-[#1c3a5e]">
              Items
            </div>
            <div ref={scrollRef} className="overflow-x-auto overflow-y-auto lg:max-h-[calc(100vh-300px)]">
              <table className="w-full border-collapse text-sm" style={{ minWidth: 1080 }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#3b6ea5] text-white">
                    <th className="border border-[#2a5080] w-[44px] text-center text-[13px] py-1.5">SL No</th>
                    <th className="border border-[#2a5080] w-[100px] text-center text-[13px] py-1.5">Type</th>
                    <th className="border border-[#2a5080] w-[100px] text-left px-2 text-[13px] py-1.5">Item Code</th>
                    <th className="border border-[#2a5080] text-left px-2 text-[13px] py-1.5">Item Name &amp; Description</th>
                    <th className="border border-[#2a5080] w-[110px] text-center text-[13px] py-1.5">Unit</th>
                    <th className="border border-[#2a5080] w-[110px] text-right px-2 text-[13px] py-1.5">
                      Order Qty{!disabled && <span className="text-red-300 ml-0.5">*</span>}
                    </th>
                    <th className="border border-[#2a5080] w-[110px] text-right px-2 text-[13px] py-1.5">
                      Rate{!disabled && <span className="text-red-300 ml-0.5">*</span>}
                    </th>
                    <th className="border border-[#2a5080] w-[65px] text-right px-2 text-[13px] py-1.5">GST %</th>
                    <th className="border border-[#2a5080] w-[110px] text-right px-2 text-[13px] py-1.5">Amount</th>
                    {!disabled && (
                      <th className="border border-[#2a5080] w-[40px] text-center text-[13px] py-1.5">Del</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    const row    = watchedRows[index] || {};
                    const isBoq  = row.type === "boq";
                    const qty    = Number(row.orderQty || 0);
                    const rate   = Number(row.rate     || 0);
                    const amount = qty * rate;
                    return (
                      <tr key={field.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f8fc]"}>
                        {/* SL */}
                        <td className="border border-[#ccc] text-center bg-[#edf4fb] text-[13px] font-medium align-middle">
                          {index + 1}
                        </td>

                        {/* TYPE */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <select
                            {...register(`rows.${index}.type`)}
                            disabled={disabled}
                            className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[52px] text-[13px] text-center px-1 cursor-pointer`}
                          >
                            <option value="non-boq">Non-BOQ</option>
                            <option value="boq">BOQ</option>
                          </select>
                        </td>

                        {/* ITEM CODE */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            {...register(`rows.${index}.itemCode`)}
                            disabled={disabled}
                            placeholder="Code"
                            className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[52px] text-[13px] px-1.5`}
                          />
                        </td>

                        {/* ITEM NAME + DESCRIPTION */}
                        <td className="border border-[#ccc] p-0">
                          <Controller
                            name={`rows.${index}.itemName`}
                            control={control}
                            render={({ field: f }) => (
                              <ExpandableTextCell
                                value={f.value || ""}
                                onChange={f.onChange}
                                disabled={disabled}
                                label="Item Name"
                                placeholder="Item Name…"
                                textSize="text-[13px]"
                              />
                            )}
                          />
                          <div className="border-t border-[#e0e0e0]" />
                          <Controller
                            name={`rows.${index}.itemDescription`}
                            control={control}
                            render={({ field: f }) => (
                              <ExpandableTextCell
                                value={f.value || ""}
                                onChange={f.onChange}
                                disabled={disabled}
                                label="Item Description"
                                placeholder="Description…"
                              />
                            )}
                          />
                        </td>

                        {/* UNIT */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            {...register(`rows.${index}.unit`)}
                            list="unit-datalist"
                            disabled={disabled}
                            placeholder="Unit"
                            title={row.unit || ""}
                            className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[52px] text-[13px] text-center px-1 truncate`}
                          />
                        </td>

                        {/* ORDER QTY */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            {...register(`rows.${index}.orderQty`, {
                              onChange: (e) => { if (Number(e.target.value) < 0) e.target.value = 0; },
                            })}
                            disabled={disabled}
                            placeholder="0"
                            className={`${getInputClass(errors?.rows?.[index]?.orderQty, disabled)} border-0 rounded-none w-full h-[52px] text-[13px] text-right pr-2`}
                          />
                        </td>

                        {/* RATE */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            {...register(`rows.${index}.rate`, {
                              onChange: (e) => { if (Number(e.target.value) < 0) e.target.value = 0; },
                            })}
                            disabled={disabled}
                            placeholder="0"
                            className={`${getInputClass(errors?.rows?.[index]?.rate, disabled)} border-0 rounded-none w-full h-[52px] text-[13px] text-right pr-2`}
                          />
                        </td>

                        {/* GST % */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="any"
                            {...register(`rows.${index}.gstPercent`, {
                              onChange: (e) => { if (Number(e.target.value) < 0) e.target.value = 0; },
                            })}
                            disabled={disabled}
                            placeholder="0"
                            className={`${getInputClass(false, disabled)} border-0 rounded-none w-full h-[52px] text-[13px] text-right pr-2`}
                          />
                        </td>

                        {/* AMOUNT — blank for Non-BOQ */}
                        <td className="border border-[#ccc] bg-[#edf8ed] px-2 text-[13px] font-medium text-right align-middle">
                          {isBoq ? fmt(amount) : ""}
                        </td>

                        {/* DELETE */}
                        {!disabled && (
                          <td className="border border-[#ccc] text-center align-middle">
                            <button
                              type="button"
                              disabled={fields.length === 1}
                              onClick={() => remove(index)}
                              className="inline-flex items-center justify-center disabled:opacity-30"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </td>
                        )}
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
                    <td className="border border-[#9ec5e0] px-2 text-right text-[13px]">{fmt(boqBasic)}</td>
                    {!disabled && <td className="border border-[#9ec5e0]" />}
                  </tr>
                </tfoot>
              </table>
            </div>
            {!disabled && (
              <div className="mt-2 flex justify-end px-2 pb-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="px-4 py-1 bg-[#9fc5e8] border border-[#6d9dc5] rounded-sm text-sm font-medium hover:brightness-95 cursor-pointer"
                >
                  + Add Row
                </button>
              </div>
            )}
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
                  confirmationTitle="Save Sale Order as Draft?"
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
                confirmationTitle="Submit Sale Order?"
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
