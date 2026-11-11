"use client";

import { useEffect, useState } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }              from "zod";
import { zodResolver }    from "@hookform/resolvers/zod";
import { toast }          from "sonner";
import { useRouter }      from "next/navigation";
import { List, Loader2, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";

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
import AmountInput         from "@/components/common/AmountInput";
import GstInput            from "@/components/common/GstInput";
import ExpandableTextCell  from "@/components/project-management/common/ExpandableTextCell";
import AccountGstTable, { DEFAULT_GST_LINES } from "@/components/finance/account/common/AccountGstTable";
import AccountingJournalTable from "@/components/finance/account/common/AccountingJournalTable";
import { ACC }             from "@/components/finance/account/common/accountTheme";
import { amountToWordsIN } from "@/lib/amountToWords";
import { formatAmount }    from "@/helper/numberFormatter";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { CREDIT_NOTE_OPTIONS } from "./creditNoteOptions";
import { useColumnResize } from "@/hooks/useColumnResize";
import { zodDate } from "@/lib/dateUtils";
import { useCopySource, copyLoadedToast } from "@/lib/copyRecord";
import CreditNoteSaleBillPickerModal from "./CreditNoteSaleBillPickerModal";

// CC options formatted for SearchableSelect
// Strip time component from API date strings (e.g. "2025-10-15 00:00" → "2025-10-15")
const toDateOnly = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (s.length > 10 && (s[10] === " " || s[10] === "T")) return s.slice(0, 10);
  return s;
};

const CC_OPTIONS = CREDIT_NOTE_OPTIONS.map((o) => ({
  value: o.ccCode,
  label: o.ccName,
  ccCode: o.ccCode,
  ccName: o.ccName,
}));

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (val) => {
  const n = Number(val);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const cellCls = (disabled) =>
  `w-full h-[26px] text-[12px] px-1.5 outline-none rounded-sm border-0 ${
    disabled
      ? "bg-[#edf8ed] text-gray-500"
      : "bg-transparent focus:bg-white focus:border focus:border-[#93b5cc]"
  }`;

const ROW   = "flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5";
const LABEL = `rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:flex-1 ${ACC.summaryLabelBg}`;
const VALUE = "rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] text-right font-semibold sm:w-[180px] sm:shrink-0";

const EMPTY_ITEM = { slNo: 1, ccCode: "", ccName: "", description: "", basicAmount: 0, gstPercent: 18 };

// ─── Schema ───────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  slNo:        z.number(),
  ccCode:      z.string().min(1, "Required"),
  ccName:      z.string().min(1, "Required"),
  description: z.string().optional().default(""),
  basicAmount: z.coerce.number().min(0).default(0),
  gstPercent:  z.coerce.number().min(0).max(100).default(0),
});

const gstLineSchema = z.object({
  gstType:     z.string().optional().default(""),
  ccCode:      z.string().optional().default(""),
  ccName:      z.string().optional().default(""),
  description: z.string().optional().default(""),
  percent:     z.coerce.number().default(0),
  gstAmount:   z.coerce.number().default(0),
  isSelected:  z.boolean().default(false),
});

const schema = z.object({
  entryDate:     zodDate(z, "entryDate", true),
  vendorId:      z.number().nullable().optional(),
  vendorName:    z.string().optional().default(""),
  vendorGstn:    z.string().optional().default(""),
  saleBillId:    z.number().nullable().optional(),
  saleBillNo:    z.string().optional().default(""),
  orderNumber:   z.string().optional().default(""),
  orderDate:     zodDate(z, "orderDate").default(""),
  debitNoteNo:   z.string().optional().default(""),
  debitNoteDate: zodDate(z, "debitNoteDate").default(""),
  remarks:       z.string().optional().default(""),
  items:         z.array(itemSchema).min(1, "At least one item is required"),
  gstLines:      z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  entryDate:     "",
  vendorId:      null,
  vendorName:    "",
  vendorGstn:    "",
  saleBillId:    null,
  saleBillNo:    "",
  orderNumber:   "",
  orderDate:     "",
  debitNoteNo:   "",
  debitNoteDate: "",
  remarks:       "",
  items:         [{ ...EMPTY_ITEM }],
  gstLines:      DEFAULT_GST_LINES,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreditNoteForm({ mode = "create", noteId, onAfterSubmit, onUuid }) {
  const copyFromId = useCopySource();
  const isCopy     = mode === "create" && !!copyFromId;

  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,       setIsEditing]       = useState(mode === "create");
  const [isSubmitted,     setIsSubmitted]      = useState(false);
  const [allowSubmit,     setAllowSubmit]      = useState(mode === "edit");
  const [sidebarOpen,     setSidebarOpen]      = useState(true);
  const [cnNo,            setCnNo]             = useState("");
  const [isLoading,       setIsLoading]        = useState(mode !== "create");
  const [debtors,         setDebtors]          = useState([]);
  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [debtorGstinOverride, setDebtorGstinOverride] = useState("");

  const {
    register, control, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const { tableRef } = useColumnResize();

  const disabled       = isViewMode || !isEditing || isSubmitting || isSubmitted;
  const watchedItems   = watch("items") || [];
  const gstLines       = watch("gstLines") || DEFAULT_GST_LINES;
  const watchVendorId  = watch("vendorId");
  const watchVendorName = watch("vendorName");

  // Derive GSTIN — vendor list first, fallback to override (from loaded record or invoice)
  const debtorGstin = watchVendorId
    ? (debtors.find((d) => d.id === watchVendorId)?.gstin || debtorGstinOverride || "")
    : "";

  const basicTotal    = watchedItems.reduce((s, it) => s + Number(it?.basicAmount || 0), 0);
  const itemsGstTotal = watchedItems.reduce((s, it) => s + Number(it?.basicAmount || 0) * Number(it?.gstPercent || 0) / 100, 0);
  const isIGST        = !!gstLines[0]?.isSelected;
  const isCGSTSGST    = !!gstLines[1]?.isSelected;
  const gstTotal      = (isIGST || isCGSTSGST) ? itemsGstTotal : 0;
  const totalAmt      = basicTotal + gstTotal;

  // Journal entries: creditorMode = CR first (sundry debtor), DR = CC + GST entries
  const ccJournalEntries = watchedItems
    .filter((it) => it?.ccName && Number(it?.basicAmount || 0) > 0)
    .map((it) => ({ ccCode: it.ccCode || "", ccName: it.ccName || "", amount: Number(it.basicAmount || 0) }));

  const gstJournalEntries = (gstLines || [])
    .filter((gl) => gl?.isSelected && Number(gl?.gstAmount || 0) > 0)
    .map((gl) => ({ ccCode: gl.ccCode || gl.gstType || "", ccName: gl.ccName || gl.gstType || "", amount: Number(gl.gstAmount || 0) }));

  const journalEntries   = [...ccJournalEntries, ...gstJournalEntries];
  const debtorDisplayName = watchVendorName || "— Select Debtor —";

  // ── Load debtor list (sundry debtors) ────────────────────────────────────
  useEffect(() => {
    apiRequest({
      url:    `${API_ENDPOINTS.MASTER.GET_ALL_LEDGER}?type=debtor`,
      method: "GET",
    })
      .then((r) => {
        const normalized = (r.data || []).map((v) => ({
          id:         v.ledgerId || v.id,
          name:       v.ledgerName || v.name || "",
          gstin:      v.gstin || "",
        }));
        setDebtors(normalized);
      })
      .catch(() => {});
  }, []);

  // ── Fetch detail (edit / view / copy) ────────────────────────────────────
  useEffect(() => {
    const loadId = isCopy ? copyFromId : noteId;
    if ((mode === "create" && !isCopy) || !loadId) return;
    setIsLoading(true);
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.CREDIT_NOTE.GET_BY_ID}${loadId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        reset({
          entryDate:     toDateOnly(d.entryDate),
          vendorId:      d.vendorId   || null,
          vendorName:    d.vendorName || "",
          vendorGstn:    d.vendorGstn || "",
          saleBillId:    d.saleBillId || null,
          saleBillNo:    d.saleBillNo || "",
          orderNumber:   d.orderNumber || "",
          orderDate:     toDateOnly(d.orderDate),
          debitNoteNo:   d.debitNoteNo || "",
          debitNoteDate: toDateOnly(d.debitNoteDate),
          remarks:       d.remarks       || "",
          items: (d.items || []).map((it, i) => ({
            slNo:        i + 1,
            ccCode:      it.ccCode      || "",
            ccName:      it.ccName      || "",
            description: it.description || "",
            basicAmount: Number(it.basicAmount || 0),
            gstPercent:  Number(it.gstPercent  || 0),
          })),
          gstLines: d.gstLines?.length === 3
            ? d.gstLines.map((l) => ({
                gstType:     l.gstType     || "",
                ccCode:      l.ccCode      || "",
                ccName:      l.ccName      || "",
                description: l.description || "",
                percent:     Number(l.percent   || 0),
                gstAmount:   Number(l.gstAmount || 0),
                isSelected:  !!l.isSelected,
              }))
            : DEFAULT_GST_LINES,
        });
        if (d.vendorGstn) setDebtorGstinOverride(d.vendorGstn);
        if (isCopy) { copyLoadedToast(d.creditNoteNo); setIsLoading(false); return; }
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.creditNoteNo)   setCnNo(d.creditNoteNo);
        if (d.creditNoteUuid && onUuid) onUuid(d.creditNoteUuid);
        setIsLoading(false);
      })
      .catch(() => { toast.error("Failed to load credit note details"); setIsLoading(false); });
  }, [copyFromId, noteId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Invoice select handler ────────────────────────────────────────────────
  const handleInvoiceSelect = (inv) => {
    setValue("saleBillId",  inv.saleBillId,              { shouldDirty: true });
    setValue("saleBillNo",  inv.saleBillNo || "",        { shouldDirty: true });
    setValue("orderNumber", inv.saleOrderNo || "",       { shouldDirty: true });
    setValue("orderDate",   inv.saleOrderDate || "",     { shouldDirty: true });
    if (inv.debtorId) {
      setValue("vendorId",   inv.debtorId,   { shouldDirty: true });
      setValue("vendorName", inv.debtorName, { shouldDirty: true });
      const d = debtors.find((x) => x.id === inv.debtorId);
      setDebtorGstinOverride(d?.gstin || inv.debtorGstin || "");
    }
  };

  // ── Debtor select handler ─────────────────────────────────────────────────
  const handleDebtorSelect = (debtorId) => {
    const d = debtors.find((x) => x.id === debtorId);
    setValue("vendorId",   debtorId,          { shouldDirty: true });
    setValue("vendorName", d?.name || "",     { shouldDirty: true });
    setDebtorGstinOverride(d?.gstin || "");
    // Clear invoice when debtor changes
    setValue("saleBillId",  null, { shouldDirty: true });
    setValue("saleBillNo",  "",   { shouldDirty: true });
    setValue("orderNumber", "",   { shouldDirty: true });
    setValue("orderDate",   "",   { shouldDirty: true });
  };

  // ── Save Draft ────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.CREDIT_NOTE.CREATE
      : `${API_ENDPOINTS.FINANCE.CREDIT_NOTE.EDIT}${noteId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      entryDate:     v.entryDate,
      saleBillId:    v.saleBillId   || null,
      vendorId:      v.vendorId     || null,
      debitNoteNo:   v.debitNoteNo  || "",
      debitNoteDate: v.debitNoteDate || "",
      remarks:       v.remarks       || "",
      items:         v.items.map((it, i) => ({ ...it, slNo: i + 1 })),
      gstLines:      v.gstLines,
    };

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Credit note saved as draft" : "Credit note updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.creditNoteUuid && onUuid) onUuid(res.data.creditNoteUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId)
          setTimeout(() => router.push(`/finance-management/account/credit-note/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  // ── Submit for Approval ───────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.CREDIT_NOTE.SUBMIT}${noteId}`, method: "POST" });
      toast.success("Credit note submitted for approval");
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

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

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

          {/* Credit Note Details */}
          <PMSection title="Credit Note Details:">
            <PMFormRow label="CN No." labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={cnNo || "[Auto]"} disabled readOnly />
            </PMFormRow>
            <PMFormRow label="Entry Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="entryDate"
                control={control}
                render={({ field }) => (
                  <PMDateInput {...field} disabled={disabled} hasError={errors.entryDate} className="max-w-[200px]" />
                )}
              />
            </PMFormRow>
          </PMSection>

          {/* Debtor (Customer) Details */}
          <PMSection title="Party (Debtor) Details:">
            <PMFormRow label="Party (Debtor)" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              {disabled ? (
                <PMInput value={watch("vendorName") || "—"} disabled readOnly />
              ) : (
                <Controller
                  name="vendorId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      options={debtors}
                      value={field.value}
                      onChange={(v) => handleDebtorSelect(Number(v))}
                      disabled={disabled}
                      placeholder="— Select Debtor —"
                      labelKey="name"
                      valueKey="id"
                      searchKeys={["name"]}
                      className="text-[12px]"
                    />
                  )}
                />
              )}
            </PMFormRow>
            <PMFormRow label="Debtor GSTIN" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={debtorGstin || "—"} disabled readOnly placeholder="Auto from debtor" />
            </PMFormRow>
          </PMSection>

          {/* Invoice (Sale Bill) Details */}
          <PMSection title="Invoice Details:">
            <PMFormRow label="Invoice No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex items-center gap-1 flex-1">
                <PMInput
                  value={watch("saleBillNo") || ""}
                  disabled
                  readOnly
                  placeholder="Select invoice from picker →"
                  className="flex-1"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => setInvoicePickerOpen(true)}
                    title="Pick Sale Invoice"
                    className="shrink-0 p-1.5 rounded border border-[#3b6ea5] text-[#3b6ea5] hover:bg-[#e8f0fa] transition"
                  >
                    <List size={14} />
                  </button>
                )}
              </div>
            </PMFormRow>
            <PMFormRow label="Sale Order No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput
                value={watch("orderNumber") || ""}
                disabled
                readOnly
                placeholder="Auto from invoice"
              />
            </PMFormRow>
            <PMFormRow label="Order Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput value={watch("orderDate") || ""} readOnly disabled className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          {/* Debit Note Reference */}
          <PMSection title="Debit Note Reference:">
            <PMFormRow label="Debit Note No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="debitNoteNo"
                control={control}
                render={({ field }) => (
                  <PMInput {...field} disabled={disabled} placeholder="Debit Note No" fieldLabel="Debit Note No" />
                )}
              />
            </PMFormRow>
            <PMFormRow label="Debit Note Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="debitNoteDate"
                control={control}
                render={({ field }) => (
                  <PMDateInput {...field} disabled={disabled} className="max-w-[200px]" />
                )}
              />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Accounting Journal */}
          <AccountingJournalTable
            debtorName={debtorDisplayName}
            entries={journalEntries}
            totalDr={totalAmt}
            totalCr={totalAmt}
            creditorMode={true}
            emptyText="Add items below to generate accounting entries"
          />

          {/* BASIC table */}
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <div className={`${ACC.basicHeader} px-3 py-[5px]`}>
              <span className={ACC.sectionTitle}>BASIC</span>
            </div>
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full min-w-[640px] border-collapse text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className={ACC.tableHead}>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[46px]">SL</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[82px]">CC Code</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">CC Name &amp; Description</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[100px]">Basic (₹)</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[76px]">GST %</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[100px]">GST Amt (₹)</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[100px]">Total (₹)</th>
                    {!disabled && <th className="border border-gray-300 px-2 py-1.5 w-[36px]" />}
                  </tr>
                </thead>
                <tbody>
                  {fields.length === 0 ? (
                    <tr>
                      <td colSpan={disabled ? 7 : 8} className="border border-gray-200 py-6 text-center text-[#bbb] italic">
                        No items yet — click &ldquo;Add Row&rdquo; to begin
                      </td>
                    </tr>
                  ) : (
                    fields.map((field, idx) => {
                      const basic    = Number(watchedItems[idx]?.basicAmount || 0);
                      const gstPct   = Number(watchedItems[idx]?.gstPercent  || 0);
                      const gstAmt   = basic * gstPct / 100;
                      const rowTotal = basic + gstAmt;
                      return (
                        <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>
                          <td className="border border-gray-200 px-2 py-[3px] text-center align-middle">{idx + 1}</td>

                          <td className="border border-gray-200 p-0.5 align-middle">
                            <input
                              type="text"
                              value={watchedItems[idx]?.ccCode ?? ""}
                              readOnly
                              placeholder="Auto"
                              className="w-full h-[26px] text-[12px] px-1.5 outline-none rounded-sm border-0 bg-[#f3f4f6] text-gray-500 cursor-default"
                            />
                          </td>

                          <td className="border border-gray-200 p-0 min-w-[160px] align-top" style={{ maxWidth: "240px" }}>
                            <Controller
                              name={`items.${idx}.ccCode`}
                              control={control}
                              render={() => (
                                <SearchableSelect
                                  options={CC_OPTIONS}
                                  value={watchedItems[idx]?.ccCode || ""}
                                  onChange={(code) => {
                                    const opt = CC_OPTIONS.find((o) => o.value === code);
                                    setValue(`items.${idx}.ccCode`, code, { shouldDirty: true });
                                    setValue(`items.${idx}.ccName`, opt?.ccName || "", { shouldDirty: true });
                                  }}
                                  disabled={disabled}
                                  placeholder="— Select Type —"
                                  labelKey="label"
                                  valueKey="value"
                                  searchKeys={["label", "value"]}
                                  className="text-[12px] border-0 rounded-none"
                                />
                              )}
                            />
                            <Controller
                              name={`items.${idx}.description`}
                              control={control}
                              render={({ field: f }) => (
                                <ExpandableTextCell
                                  value={f.value || ""}
                                  onChange={disabled ? undefined : f.onChange}
                                  disabled={disabled}
                                  placeholder="Description"
                                  label="Description"
                                  textSize="text-[11px]"
                                  className="text-gray-500"
                                />
                              )}
                            />
                          </td>

                          <td className="border border-gray-200 p-0.5 align-middle">
                            <AmountInput
                              {...register(`items.${idx}.basicAmount`)}
                              value={watchedItems[idx]?.basicAmount ?? ""}
                              disabled={disabled}
                              placeholder="0.00"
                              className={`${cellCls(disabled)} text-right`}
                            />
                          </td>

                          <td className="border border-gray-200 p-0.5 align-middle">
                            <GstInput
                              {...register(`items.${idx}.gstPercent`)}
                              value={watchedItems[idx]?.gstPercent ?? ""}
                              disabled={disabled}
                              placeholder="0"
                              className={`${cellCls(disabled)} text-center`}
                            />
                          </td>

                          <td className="border border-gray-200 px-2 py-[3px] text-right align-middle bg-[#fff8ed] text-gray-700 font-medium">
                            {formatAmount(gstAmt)}
                          </td>

                          <td className="border border-gray-200 px-2 py-[3px] text-right align-middle bg-[#edf8ed] text-gray-700 font-medium whitespace-nowrap">
                            {formatAmount(rowTotal)}
                          </td>

                          {!disabled && (
                            <td className="border border-gray-200 px-1 py-[3px] text-center align-middle">
                              <button
                                type="button"
                                onClick={() => remove(idx)}
                                className="p-0.5 text-red-400 hover:text-red-600 transition rounded"
                                title="Remove row"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}

                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={3} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{fmt(basicTotal)}</td>
                    <td className="border border-gray-300" />
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                      {fmt(watchedItems.reduce((s, it) => s + Number(it?.basicAmount || 0) * Number(it?.gstPercent || 0) / 100, 0))}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                      {fmt(watchedItems.reduce((s, it) => { const b = Number(it?.basicAmount || 0); return s + b + b * Number(it?.gstPercent || 0) / 100; }, 0))}
                    </td>
                    {!disabled && <td className="border border-gray-300" />}
                  </tr>
                </tbody>
              </table>
            </div>

            {!disabled && (
              <div className="flex justify-end px-3 py-2 border-t border-gray-200">
                <button data-shortcut="add-row" title="Shortcut: Alt+I"
                  type="button"
                  onClick={() => append({ slNo: fields.length + 1, ccCode: "", ccName: "", description: "", basicAmount: 0, gstPercent: 18 })}
                  className="inline-flex items-center gap-1 text-[12px] px-3 py-1 rounded-sm bg-[#3b6ea5] text-white hover:bg-[#2e5a8e] transition"
                >
                  <Plus size={13} />
                  Add Row
                </button>
              </div>
            )}
          </div>

          {/* GST table */}
          <AccountGstTable
            watch={watch}
            setValue={setValue}
            control={control}
            disabled={disabled}
            basicTotal={basicTotal}
            actualGstTotal={itemsGstTotal}
            showDescription={false}
            showPercent={false}
          />

          {/* Summary */}
          <div className="space-y-1.5">
            <div className={ROW}>
              <div className={LABEL}>Basic Amount</div>
              <div className={`${VALUE} ${ACC.summaryValueBg}`}>{fmt(basicTotal)}</div>
            </div>
            <div className={ROW}>
              <div className={LABEL}>GST Amount</div>
              <div className={`${VALUE} ${ACC.summaryValueBg}`}>{fmt(gstTotal)}</div>
            </div>
            <div className={ROW}>
              <div className={`${LABEL} font-bold`}>TOTAL (Rs.)</div>
              <div className={`${VALUE} ${ACC.totalValueBg} font-bold`}>{fmt(totalAmt)}</div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-1 sm:gap-1.5">
              <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:w-[180px] sm:shrink-0 ${ACC.wordsLabelBg}`}>
                Amount (In word)
              </div>
              <div className={`flex-1 rounded-sm border border-gray-300 px-3 py-[7px] text-[12px] leading-relaxed italic ${ACC.wordsValueBg}`}>
                {totalAmt > 0
                  ? amountToWordsIN(totalAmt)
                  : <span className="text-gray-400 not-italic">Auto Generated number to word</span>}
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-1.5">
            <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:w-[180px] sm:shrink-0 ${ACC.summaryLabelBg}`}>
              Remarks
            </div>
            <Controller name="remarks" control={control} render={({ field }) => (
              <PMTextarea
                value={field.value || ""}
                onChange={field.onChange}
                disabled={disabled}
                placeholder="Text"
                rows={2}
                maxRows={6}
                className="flex-1 w-full"
              />
            )} />
          </div>

          {/* Action buttons */}
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
                confirmationTitle="Submit Credit Note?"
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
                <DeleteRequestButton
                  moduleCode="CREDIT_NOTE"
                  recordId={Number(noteId)}
                  onDeleted={() => router.back()}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sale Bill Picker Modal */}
      <CreditNoteSaleBillPickerModal
        open={invoicePickerOpen}
        onClose={() => setInvoicePickerOpen(false)}
        onSelect={handleInvoiceSelect}
        projectCode={projectCode}
        debtorId={watchVendorId}
        selectedSaleBillId={watch("saleBillId")}
      />
    </div>
  );
}
