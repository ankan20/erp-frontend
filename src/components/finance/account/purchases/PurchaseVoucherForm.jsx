"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }              from "zod";
import { zodResolver }    from "@hookform/resolvers/zod";
import { toast }          from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import ExpandableTextCell from "@/components/project-management/common/ExpandableTextCell";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";

import AccountGstTable, {
  DEFAULT_GST_LINES,
} from "@/components/finance/account/common/AccountGstTable";
import AccountSummary  from "@/components/finance/account/common/AccountSummary";
import { ACC }         from "@/components/finance/account/common/accountTheme";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  slNo:        z.number(),
  ccCodeId:    z.coerce.number().nullable().optional().default(null),
  ccCode:      z.string().optional().default(""),
  ccName:      z.string().optional().default(""),
  description: z.string().optional().default(""),
  basicAmount: z.coerce.number().min(0).default(0),
});

const gstLineSchema = z.object({
  gstType:    z.string(),
  ccCode:     z.string(),
  ccName:     z.string(),
  description: z.string().optional().default(""),
  percent:    z.number(),
  gstAmount:  z.coerce.number().default(0),
  isSelected: z.boolean().default(false),
});

const schema = z.object({
  vendorId:       z.coerce.number().min(1, "Party is required"),
  processingDate: z.string().min(1, "Processing Date is required"),
  voucherNo:      z.string().optional().default(""),
  voucherDate:    z.string().optional().default(""),
  remarks:        z.string().optional().default(""),
  discount:       z.coerce.number().min(0).default(0),
  roundOff:       z.coerce.number().default(0),
  items:          z.array(itemSchema).min(1, "At least one item required"),
  gstLines:       z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  vendorId:       null,
  processingDate: new Date().toISOString().split("T")[0],
  voucherNo:      "",
  voucherDate:    "",
  remarks:        "",
  discount:       0,
  roundOff:       0,
  items:          [{ slNo: 1, ccCodeId: null, ccCode: "", ccName: "", description: "", basicAmount: 0 }],
  gstLines:       DEFAULT_GST_LINES,
};

const newItem = (idx) => ({ slNo: idx + 1, ccCodeId: null, ccCode: "", ccName: "", description: "", basicAmount: 0 });

const fmt = (val) => {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseVoucherForm({
  mode = "create",
  voucherId,
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
  const [ccCodeList,    setCcCodeList]    = useState([]);
  const [erpVoucherNo,  setErpVoucherNo]  = useState("");

  const {
    register, control, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields, append, remove } = useFieldArray({ control, name: "items" });
  const tableContainerRef = useRef(null);

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Computed totals ──────────────────────────────────────────────────────────
  const items    = watch("items")    || [];
  const gstLines = watch("gstLines") || DEFAULT_GST_LINES;
  const discount = Number(watch("discount") || 0);
  const basicTotal   = items.reduce((s, it) => s + Number(it?.basicAmount || 0), 0);
  const isIGST       = !!gstLines[0]?.isSelected;
  const isCGSTSGST   = !!gstLines[1]?.isSelected;
  const igstAmt      = isIGST     ? basicTotal * (gstLines[0]?.percent || 18) / 100 : 0;
  const cgstAmt      = isCGSTSGST ? basicTotal * (gstLines[1]?.percent || 9)  / 100 : 0;
  const sgstAmt      = isCGSTSGST ? basicTotal * (gstLines[2]?.percent || 9)  / 100 : 0;
  const gstTotal     = igstAmt + cgstAmt + sgstAmt;
  const totalInvoice = basicTotal + gstTotal - discount + Number(watch("roundOff") || 0);

  // ── Load Vendors & CC Codes ──────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => setVendorList((res.data || []).slice().sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || ""))))
      .catch(() => toast.error("Failed to load vendor list"));

    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE, method: "GET" })
      .then((res) => setCcCodeList(res.data || []))
      .catch(() => {});
  }, []);

  // ── Fetch Detail (edit/view) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!voucherId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_VOUCHER.GET_BY_ID}${voucherId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        reset({
          vendorId:       d.vendorId       || null,
          processingDate: d.processingDate || "",
          voucherNo:      d.vendorVoucherNo || "",
          voucherDate:    d.voucherDate    || "",
          remarks:        d.remarks        || "",
          discount:       Number(d.discount || 0),
          roundOff:       Number(d.roundOff || 0),
          items: (d.items || []).map((it, i) => ({
            slNo:        i + 1,
            ccCodeId:    it.ccCodeId    || null,
            ccCode:      it.ccCode      || "",
            ccName:      it.ccName      || "",
            description: it.description || "",
            basicAmount: Number(it.basicAmount || 0),
          })),
          gstLines: d.gstLines?.length === 3 ? d.gstLines.map((l) => ({
            gstType:    l.gstType    || "",
            ccCode:     l.ccCode     || "",
            ccName:     l.ccName     || "",
            description: l.description || "",
            percent:    Number(l.percent   || 0),
            gstAmount:  Number(l.gstAmount || 0),
            isSelected: !!l.isSelected,
          })) : DEFAULT_GST_LINES,
        });
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.voucherNo) setErpVoucherNo(d.voucherNo);
        if (d.voucherUuid && onUuid) onUuid(d.voucherUuid);
      })
      .catch(() => toast.error("Failed to load voucher details"));
  }, [voucherId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Draft ───────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    const validItems = v.items.filter((it) => it.ccCodeId && Number(it.ccCodeId) > 0);
    if (validItems.length === 0) {
      toast.error("At least one item with a CC Code is required");
      return;
    }

    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.PURCHASE_VOUCHER.CREATE
      : `${API_ENDPOINTS.FINANCE.PURCHASE_VOUCHER.EDIT}${voucherId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      vendorId:          v.vendorId,
      processingDate:    v.processingDate,
      vendorVoucherNo:   v.voucherNo      || "",
      voucherDate:       v.voucherDate    || "",
      remarks:           v.remarks        || "",
      items:             validItems.map((it, i) => ({
        slNo:        i + 1,
        ccCodeId:    it.ccCodeId,
        description: it.description || "",
        basicAmount: Number(it.basicAmount || 0),
      })),
      gstLines:    v.gstLines,
      discount:    Number(v.discount || 0),
      roundOff:    Number(v.roundOff || 0),
    };

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Voucher saved as draft" : "Voucher updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.voucherUuid && onUuid) onUuid(res.data.voucherUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId)
          setTimeout(() => router.push(`/finance-management/account/purchases/voucher/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_VOUCHER.SUBMIT}${voucherId}`, method: "POST" });
      toast.success("Voucher submitted for approval");
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

          <PMSection title="Voucher Details:">
            <PMFormRow label="ERP Doc. No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={erpVoucherNo || "[Auto]"} disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none" />
            </PMFormRow>

            <PMFormRow label="Processing Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("processingDate")} disabled={disabled} hasError={errors.processingDate} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          <PMSection title="Party Details:">
            <PMFormRow label="Party Name" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorId" control={control} render={({ field }) => (
                <SearchableSelect
                  options={vendorList}
                  value={field.value ? String(field.value) : ""}
                  disabled={disabled}
                  onChange={(v) => field.onChange(v ? Number(v) : null)}
                  placeholder="Select form Vendor List"
                  labelKey="ledgerName"
                  valueKey="ledgerId"
                  searchKeys={["ledgerName"]}
                />
              )} />
            </PMFormRow>

            <PMFormRow label="Voucher Number" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input {...register("voucherNo")} disabled={disabled} placeholder="Filter List from Vendor Order"
                className={`w-full h-[30px] text-[13px] rounded-sm border px-2 outline-none transition ${
                  disabled ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500" : "border-gray-300 bg-white focus:border-[#3b6ea5]"
                }`} />
            </PMFormRow>

            <PMFormRow label="Voucher Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("voucherDate")} disabled={disabled} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

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

          {/* BASIC Table (manual entry) */}
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <div className={`${ACC.basicHeader} px-3 py-[5px]`}>
              <span className={ACC.sectionTitle}>BASIC</span>
            </div>
            <div ref={tableContainerRef} className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full min-w-[480px] border-collapse text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className={ACC.tableHead}>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[44px]">SL no</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[160px]">CC Code</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">CC Name &amp; Description</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[110px]">Basic Amount</th>
                    {!disabled && <th className="border border-gray-300 px-1 py-1.5 w-[34px]" />}
                  </tr>
                </thead>
                <tbody>
                  {itemFields.map((field, idx) => (
                    <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>
                      <td className="border border-gray-200 px-2 py-[3px] text-center">{idx + 1}</td>

                      <td className="border border-gray-200 p-0.5">
                        <Controller name={`items.${idx}.ccCodeId`} control={control} render={({ field: f }) => (
                          <SearchableSelect
                            options={ccCodeList}
                            value={f.value ? String(f.value) : ""}
                            disabled={disabled}
                            onChange={(v) => {
                              const cc = ccCodeList.find((c) => String(c.ccId) === String(v));
                              f.onChange(v ? Number(v) : null);
                              setValue(`items.${idx}.ccCode`, cc?.ccCode     || "");
                              setValue(`items.${idx}.ccName`, cc?.ccName ||  "");
                            }}
                            placeholder="Select CC"
                            labelKey="ccCode"
                            valueKey="ccId"
                            searchKeys={["ccCode", "ccName", "ccGroupName"]}
                            compact
                          />
                        )} />
                      </td>

                      <td className="border border-gray-200 p-0 min-w-[160px]">
                        <div className="px-2 pt-[5px] pb-[2px] text-[12px] font-medium leading-snug text-gray-800">
                          {watch(`items.${idx}.ccName`) || "-"}
                        </div>
                        <Controller
                          name={`items.${idx}.description`}
                          control={control}
                          render={({ field: f }) => (
                            <ExpandableTextCell
                              value={f.value || ""}
                              onChange={disabled ? undefined : f.onChange}
                              disabled={disabled}
                              placeholder="Enter description"
                              label="Description"
                              textSize="text-[11px]"
                              className="text-gray-500"
                            />
                          )}
                        />
                      </td>

                      <td className="border border-gray-200 p-0.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          {...register(`items.${idx}.basicAmount`)}
                          disabled={disabled}
                          placeholder="0.00"
                          className={`w-full h-[26px] text-[12px] px-1.5 text-right outline-none rounded-sm border-0 ${
                            disabled ? "bg-[#edf8ed] text-gray-500" : "bg-transparent focus:bg-white focus:border focus:border-[#93b5cc]"
                          }`}
                        />
                      </td>

                      {!disabled && (
                        <td className="border border-gray-200 p-0.5 text-center">
                          <button type="button" onClick={() => remove(idx)}
                            className="p-0.5 text-red-400 hover:text-red-600 transition" title="Remove row">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}

                  {/* Total row */}
                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={3} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{fmt(basicTotal)}</td>
                    {!disabled && <td className="border border-gray-300" />}
                  </tr>
                </tbody>
              </table>
            </div>

            {!disabled && (
              <div className="px-3 py-2 border-t border-gray-200">
                <button type="button"
                  onClick={() => {
                    append(newItem(itemFields.length));
                    setTimeout(() => {
                      if (tableContainerRef.current)
                        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
                    }, 0);
                  }}
                  className="flex items-center gap-1 text-[12px] text-[#3b6ea5] hover:underline">
                  <Plus size={13} /> Add Row
                </button>
              </div>
            )}
          </div>

          {/* GST Table */}
          <AccountGstTable
            watch={watch}
            setValue={setValue}
            control={control}
            disabled={disabled}
            basicTotal={basicTotal}
          />

          {/* Summary */}
          <AccountSummary
            basicTotal={basicTotal}
            gstTotal={gstTotal}
            totalInvoice={totalInvoice}
            register={register}
            watch={watch}
            disabled={disabled}
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
                confirmationTitle="Submit Purchase Voucher?"
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
