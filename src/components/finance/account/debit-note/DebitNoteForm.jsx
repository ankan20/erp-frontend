"use client";

import { useEffect, useState } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }             from "zod";
import { zodResolver }   from "@hookform/resolvers/zod";
import { toast }         from "sonner";
import { useRouter }     from "next/navigation";
import { Loader2, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";

import SaveButton        from "@/components/common/SaveButton";
import SaveDraftButton   from "@/components/common/SaveDraftButton";
import EditButton        from "@/components/common/EditButton";
import PMSection         from "@/components/project-management/common/PMSection";
import PMFormRow         from "@/components/project-management/common/PMFormRow";
import PMDateInput       from "@/components/project-management/common/PMDateInput";
import PMTextarea        from "@/components/project-management/common/PMTextarea";
import PMInput           from "@/components/project-management/common/PMInput";
import AmountInput       from "@/components/common/AmountInput";
import GstInput          from "@/components/common/GstInput";
import ExpandableTextCell from "@/components/project-management/common/ExpandableTextCell";
import AccountGstTable, { DEFAULT_GST_LINES } from "@/components/finance/account/common/AccountGstTable";
import { ACC }           from "@/components/finance/account/common/accountTheme";
import { amountToWordsIN } from "@/lib/amountToWords";
import { formatAmount }  from "@/helper/numberFormatter";
import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

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
  gstType:     z.string(),
  ccCode:      z.string(),
  ccName:      z.string(),
  description: z.string().optional().default(""),
  percent:     z.number(),
  gstAmount:   z.coerce.number().default(0),
  isSelected:  z.boolean().default(false),
});

const schema = z.object({
  entryDate:      z.string().min(1, "Entry Date required"),
  billNumber:     z.string().min(1, "Bill Number required"),
  billDate:       z.string().optional().default(""),
  orderNumber:    z.string().optional().default(""),
  orderDate:      z.string().optional().default(""),
  vendorName:     z.string().optional().default(""),
  vendorGstn:     z.string().optional().default(""),
  creditNoteNo:   z.string().optional().default(""),
  creditNoteDate: z.string().optional().default(""),
  remarks:        z.string().optional().default(""),
  items:          z.array(itemSchema).min(1, "At least one item is required"),
  gstLines:       z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  entryDate:      new Date().toISOString().split("T")[0],
  billNumber:     "",
  billDate:       "",
  orderNumber:    "",
  orderDate:      "",
  vendorName:     "",
  vendorGstn:     "",
  creditNoteNo:   "",
  creditNoteDate: "",
  remarks:        "",
  items:          [{ ...EMPTY_ITEM }],
  gstLines:       DEFAULT_GST_LINES,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function DebitNoteForm({ mode = "create", noteId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dnNo,        setDnNo]        = useState("");

  const {
    register, control, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const disabled     = isViewMode || !isEditing || isSubmitting || isSubmitted;
  const watchedItems = watch("items") || [];
  const gstLines     = watch("gstLines") || DEFAULT_GST_LINES;

  const basicTotal = watchedItems.reduce((s, it) => s + Number(it?.basicAmount || 0), 0);
  const isIGST     = !!gstLines[0]?.isSelected;
  const isCGSTSGST = !!gstLines[1]?.isSelected;
  const igstAmt    = isIGST     ? basicTotal * (gstLines[0]?.percent || 18) / 100 : 0;
  const cgstAmt    = isCGSTSGST ? basicTotal * (gstLines[1]?.percent || 9)  / 100 : 0;
  const sgstAmt    = isCGSTSGST ? basicTotal * (gstLines[2]?.percent || 9)  / 100 : 0;
  const gstTotal   = igstAmt + cgstAmt + sgstAmt;
  const totalAmt   = basicTotal + gstTotal;

  // ── Fetch detail (edit / view) ────────────────────────────────────────────
  useEffect(() => {
    if (!noteId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.DEBIT_NOTE.GET_BY_ID}${noteId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        reset({
          entryDate:      d.entryDate      || "",
          billNumber:     d.billNumber     || "",
          billDate:       d.billDate       || "",
          orderNumber:    d.orderNumber    || "",
          orderDate:      d.orderDate      || "",
          vendorName:     d.vendorName     || "",
          vendorGstn:     d.vendorGstn     || "",
          creditNoteNo:   d.creditNoteNo   || "",
          creditNoteDate: d.creditNoteDate || "",
          remarks:        d.remarks        || "",
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
                gstType:     l.gstType    || "",
                ccCode:      l.ccCode     || "",
                ccName:      l.ccName     || "",
                description: l.description || "",
                percent:     Number(l.percent   || 0),
                gstAmount:   Number(l.gstAmount || 0),
                isSelected:  !!l.isSelected,
              }))
            : DEFAULT_GST_LINES,
        });
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.debitNoteNo)   setDnNo(d.debitNoteNo);
        if (d.debitNoteUuid && onUuid) onUuid(d.debitNoteUuid);
      })
      .catch(() => toast.error("Failed to load debit note details"));
  }, [noteId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Draft ────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.DEBIT_NOTE.CREATE
      : `${API_ENDPOINTS.FINANCE.DEBIT_NOTE.EDIT}${noteId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      entryDate:      v.entryDate,
      billNumber:     v.billNumber,
      billDate:       v.billDate       || "",
      orderNumber:    v.orderNumber    || "",
      orderDate:      v.orderDate      || "",
      vendorName:     v.vendorName     || "",
      vendorGstn:     v.vendorGstn     || "",
      creditNoteNo:   v.creditNoteNo   || "",
      creditNoteDate: v.creditNoteDate || "",
      remarks:        v.remarks        || "",
      items:          v.items.map((it, i) => ({ ...it, slNo: i + 1 })),
      gstLines:       v.gstLines,
    };

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Debit note saved as draft" : "Debit note updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.debitNoteUuid && onUuid) onUuid(res.data.debitNoteUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId)
          setTimeout(() => router.push(`/finance-management/account/debit-note/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  // ── Submit for Approval ───────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.DEBIT_NOTE.SUBMIT}${noteId}`, method: "POST" });
      toast.success("Debit note submitted for approval");
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

          {/* Debit Note Details */}
          <PMSection title="Debit Note Details:">
            <PMFormRow label="DN No." labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={dnNo || "[Auto]"} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>
            <PMFormRow label="Entry Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("entryDate")} disabled={disabled} hasError={errors.entryDate} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          {/* Bill Details */}
          <PMSection title="Bill Details:">
            <PMFormRow label="Bill Number" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput {...register("billNumber")} disabled={disabled} hasError={errors.billNumber} placeholder="Bill Number" fieldLabel="Bill Number" />
            </PMFormRow>
            <PMFormRow label="Bill Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("billDate")} disabled={disabled} className="max-w-[200px]" />
            </PMFormRow>
            <PMFormRow label="Order Number" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput {...register("orderNumber")} disabled={disabled} placeholder="Order Number" fieldLabel="Order Number" />
            </PMFormRow>
            <PMFormRow label="Order Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("orderDate")} disabled={disabled} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          {/* Vendor Details */}
          <PMSection title="Vendor Details:">
            <PMFormRow label="Vendor Name" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput {...register("vendorName")} disabled={disabled} placeholder="Vendor Name" fieldLabel="Vendor Name" />
            </PMFormRow>
            <PMFormRow label="Vendor GSTN" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput {...register("vendorGstn")} disabled={disabled} placeholder="GSTIN" fieldLabel="Vendor GSTN" />
            </PMFormRow>
          </PMSection>

          {/* Credit Note */}
          <PMSection title="Credit Note Details:">
            <PMFormRow label="Credit Note No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput {...register("creditNoteNo")} disabled={disabled} placeholder="Credit Note No" fieldLabel="Credit Note No" />
            </PMFormRow>
            <PMFormRow label="Credit Note Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("creditNoteDate")} disabled={disabled} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* BASIC table */}
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <div className={`${ACC.basicHeader} px-3 py-[5px]`}>
              <span className={ACC.sectionTitle}>BASIC</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className={ACC.tableHead}>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[46px]">SL</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[82px]">CC Code</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">CC Name &amp; Description</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[110px]">Basic (₹)</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[88px]">GST %</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[110px]">Total Amt (₹)</th>
                    {!disabled && <th className="border border-gray-300 px-2 py-1.5 w-[36px]" />}
                  </tr>
                </thead>
                <tbody>
                  {fields.length === 0 ? (
                    <tr>
                      <td colSpan={disabled ? 6 : 7} className="border border-gray-200 py-6 text-center text-[#bbb] italic">
                        No items yet — click &ldquo;Add Row&rdquo; to begin
                      </td>
                    </tr>
                  ) : (
                    fields.map((field, idx) => {
                      const basic = Number(watchedItems[idx]?.basicAmount || 0);
                      const gstPct = Number(watchedItems[idx]?.gstPercent || 0);
                      const rowTotal = basic + (basic * gstPct / 100);
                      return (
                        <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>
                          <td className="border border-gray-200 px-2 py-[3px] text-center align-middle">{idx + 1}</td>

                          {/* CC Code */}
                          <td className="border border-gray-200 p-0.5 align-middle">
                            <input
                              type="text"
                              {...register(`items.${idx}.ccCode`)}
                              disabled={disabled}
                              placeholder="CC Code"
                              className={cellCls(disabled)}
                            />
                          </td>

                          {/* CC Name + Description */}
                          <td className="border border-gray-200 p-0 min-w-[160px]">
                            <Controller
                              name={`items.${idx}.ccName`}
                              control={control}
                              render={({ field: f }) => (
                                <ExpandableTextCell
                                  value={f.value || ""}
                                  onChange={disabled ? undefined : f.onChange}
                                  disabled={disabled}
                                  placeholder="CC Name"
                                  label="CC Name"
                                  textSize="text-[12px]"
                                  className="font-medium"
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

                          {/* Basic Amount */}
                          <td className="border border-gray-200 p-0.5 align-middle">
                            <AmountInput
                              {...register(`items.${idx}.basicAmount`)}
                              value={watchedItems[idx]?.basicAmount ?? ""}
                              disabled={disabled}
                              placeholder="0.00"
                              className={`${cellCls(disabled)} text-right`}
                            />
                          </td>

                          {/* GST % */}
                          <td className="border border-gray-200 p-0.5 align-middle">
                            <GstInput
                              {...register(`items.${idx}.gstPercent`)}
                              value={watchedItems[idx]?.gstPercent ?? ""}
                              disabled={disabled}
                              placeholder="0"
                              className={`${cellCls(disabled)} text-center`}
                            />
                          </td>

                          {/* Total Amount — computed display only */}
                          <td className="border border-gray-200 px-2 py-[3px] text-right align-middle bg-[#edf8ed] text-gray-700 font-medium">
                            {formatAmount(rowTotal)}
                          </td>

                          {/* Delete */}
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

                  {/* Total row */}
                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={disabled ? 3 : 4} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{fmt(basicTotal)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{fmt(watchedItems.reduce((s, it) => s + Number(it?.basicAmount || 0) + Number(it?.basicAmount || 0) * Number(it?.gstPercent || 0) / 100, 0))}</td>
                    {!disabled && <td className="border border-gray-300" />}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Add Row */}
            {!disabled && (
              <div className="flex justify-end px-3 py-2 border-t border-gray-200">
                <button
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
                confirmationTitle="Submit Debit Note?"
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
