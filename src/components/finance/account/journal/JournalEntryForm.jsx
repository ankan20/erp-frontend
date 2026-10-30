"use client";

import { useEffect, useState }         from "react";
import { Controller, useFieldArray }   from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }                            from "zod";
import { zodResolver }                  from "@hookform/resolvers/zod";
import { toast }                        from "sonner";
import { useRouter }                    from "next/navigation";
import { Plus, Trash2 }                 from "lucide-react";

import SaveButton       from "@/components/common/SaveButton";
import SaveDraftButton  from "@/components/common/SaveDraftButton";
import EditButton       from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import AmountInput      from "@/components/common/AmountInput";
import PMSection        from "@/components/project-management/common/PMSection";
import PMFormRow        from "@/components/project-management/common/PMFormRow";
import PMTextarea       from "@/components/project-management/common/PMTextarea";
import PMDateInput      from "@/components/project-management/common/PMDateInput";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";
import { useColumnResize } from "@/hooks/useColumnResize";
import { zodDate }         from "@/lib/dateUtils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const drLineSchema = z.object({
  type:           z.enum(["CC", "Vendor"]),
  accountId:      z.coerce.number().nullable().optional(),
  openingBalance: z.coerce.number().default(0),
  debitAmount:    z.coerce.number().min(0).default(0),
});

const crLineSchema = z.object({
  type:           z.enum(["CC", "Vendor"]),
  accountId:      z.coerce.number().nullable().optional(),
  openingBalance: z.coerce.number().default(0),
});

const schema = z.object({
  entryDate: zodDate(z, "entryDate"),
  remarks:   z.string().optional().default(""),
  drLines:   z.array(drLineSchema).min(1),
  crLine:    crLineSchema,
});

const BLANK_DR = { type: "CC", accountId: null, openingBalance: 0, debitAmount: 0 };
const BLANK_CR = { type: "CC", accountId: null, openingBalance: 0 };
const DEFAULT_VALUES = { entryDate: "", remarks: "", drLines: [{ ...BLANK_DR }], crLine: { ...BLANK_CR } };

// ─── Component ────────────────────────────────────────────────────────────────

export default function JournalEntryForm({ mode = "create", journalId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,    setIsEditing]    = useState(mode === "create");
  const [isSubmitted,  setIsSubmitted]  = useState(false);
  const [allowSubmit,  setAllowSubmit]  = useState(mode === "edit");
  const [erpVoucherNo, setErpVoucherNo] = useState("");
  const [ccCodeList,   setCcCodeList]   = useState([]);
  const [vendorList,   setVendorList]   = useState([]);

  const {
    register, control, handleSubmit, reset, watch, setValue,
    formState: { isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });
const { fields: drFields, append: appendDr, remove: removeDr } = useFieldArray({ control, name: "drLines" });
  const { tableRef } = useColumnResize();

  const watchedDrLines = watch("drLines") || [];
  const watchedCrLine  = watch("crLine")  || {};
  const disabled       = isViewMode || !isEditing || isSubmitting || isSubmitted;

  const totalDebit  = watchedDrLines.reduce((s, l) => s + Number(l.debitAmount || 0), 0);
  const totalCredit = totalDebit;

  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_CC_CODE}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => setCcCodeList((res.data || []).map((c) => ({ ...c, displayLabel: `${c.ccCode} — ${c.ccName}` }))))
      .catch(() => {});
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => setVendorList((res.data || []).map((v) => ({ ...v, displayLabel: `${v.ledgerCode} — ${v.ledgerName}` }))))
      .catch(() => {});
  }, [projectCode]);

  useEffect(() => {
    if (!journalId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.GET_BY_ID}${journalId}`, method: "GET" })
      .then((res) => {
        const d       = res.data || {};
        const sorted  = [...(d.lines || [])].sort((a, b) => a.slNo - b.slNo);
        const drLines = sorted.filter((l) => l.drCr === "Dr");
        const crLine  = sorted.find((l) => l.drCr === "Cr") || {};
        const mapDr   = (l) => ({ type: l.ccId ? "CC" : "Vendor", accountId: l.ccId || l.vendorId || null, openingBalance: Number(l.openingBalance || 0), debitAmount: Number(l.debitAmount || 0) });
        const mapCr   = (l) => ({ type: l.ccId ? "CC" : "Vendor", accountId: l.ccId || l.vendorId || null, openingBalance: Number(l.openingBalance || 0) });
        reset({ entryDate: d.entryDate || "", remarks: d.remarks || "", drLines: drLines.length ? drLines.map(mapDr) : [{ ...BLANK_DR }], crLine: mapCr(crLine) });
        setErpVoucherNo(d.voucherNo || "");
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.journalUuid && onUuid) onUuid(d.journalUuid);
      })
      .catch(() => toast.error("Failed to load journal entry"));
  }, [journalId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = async (v) => {
    for (let i = 0; i < v.drLines.length; i++) {
      if (!v.drLines[i].accountId) { toast.error(`Select account for Dr line ${i + 1}`); return; }
      if (Number(v.drLines[i].debitAmount || 0) <= 0) { toast.error(`Dr line ${i + 1}: amount must be > 0`); return; }
    }
    if (!v.crLine.accountId) { toast.error("Select account for Cr line"); return; }
    const drTotal = v.drLines.reduce((s, l) => s + Number(l.debitAmount || 0), 0);
    const url    = mode === "create" ? API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.CREATE : `${API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.EDIT}${journalId}`;
    const method = mode === "create" ? "POST" : "PUT";
    const payload = {
      projectCode, entryDate: v.entryDate || "", remarks: v.remarks || "",
      lines: [
        ...v.drLines.map((l, i) => ({ slNo: i + 1, drCr: "Dr", ccId: l.type === "CC" ? Number(l.accountId) : null, vendorId: l.type === "Vendor" ? Number(l.accountId) : null, openingBalance: Number(l.openingBalance || 0), debitAmount: Number(l.debitAmount || 0), creditAmount: 0 })),
        { slNo: v.drLines.length + 1, drCr: "Cr", ccId: v.crLine.type === "CC" ? Number(v.crLine.accountId) : null, vendorId: v.crLine.type === "Vendor" ? Number(v.crLine.accountId) : null, openingBalance: Number(v.crLine.openingBalance || 0), debitAmount: 0, creditAmount: drTotal },
      ],
    };
    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Saved as draft" : "Updated");
      setAllowSubmit(true); setIsEditing(false); onAfterSubmit?.();
      if (res?.data?.journalUuid && onUuid) onUuid(res.data.journalUuid);
      if (mode === "create" && res.data?.id) setTimeout(() => router.push(`/finance-management/account/journal/${res.data.id}`), 400);
    } catch (err) { toast.error(err?.message || "Failed to save"); }
  };

  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.SUBMIT}${journalId}`, method: "POST" });
      toast.success("Submitted for approval");
      setIsSubmitted(true); setAllowSubmit(false); onAfterSubmit?.();
    } catch (err) { toast.error(err?.message || "Failed to submit"); }
  };

  const handleEdit = () => { if (isEditing) { reset(); setIsEditing(false); } else setIsEditing(true); };

  // ── Cell base styles ──────────────────────────────────────────────────────
  const inputBase   = "w-full h-[30px] text-[12.5px] px-2 border-0 outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-300 rounded transition";
  const amountBase  = `${inputBase} text-right tabular-nums`;
  const readonlyAmt = "h-[30px] flex items-center justify-end px-2 text-[12.5px] tabular-nums text-gray-600";
  const typeSel     = `h-[30px] w-full text-[12px] px-1.5 border-0 outline-none bg-transparent ${!disabled ? "focus:bg-white focus:ring-1 focus:ring-blue-300 rounded cursor-pointer" : "text-gray-600"}`;

  const AccountSelect = ({ name, lineType }) => {
    const opts  = lineType === "Vendor" ? vendorList  : ccCodeList;
    const vKey  = lineType === "Vendor" ? "ledgerId"  : "ccId";
    const sKeys = lineType === "Vendor" ? ["displayLabel","ledgerCode","ledgerName"] : ["displayLabel","ccCode","ccName"];
    return (
      <Controller name={name} control={control} render={({ field: f }) => (
        <SearchableSelect
          options={opts} value={f.value ? String(f.value) : ""} disabled={disabled}
          onChange={(v) => f.onChange(v ? Number(v) : null)}
          placeholder={lineType === "Vendor" ? "Select vendor…" : "Select CC code…"}
          labelKey="displayLabel" valueKey={vKey} searchKeys={sKeys} compact
        />
      )} />
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto p-4 space-y-3">

      {/* ── 1. ENTRY DETAILS ─────────────────────────────────────────────── */}
      <PMSection title="Entry Details:">
        <div className="flex flex-wrap gap-x-8 gap-y-1 pb-1">
          <PMFormRow label="ERP Doc. No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
            <input
              value={erpVoucherNo || "[Auto]"} disabled readOnly
              className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none max-w-[200px]"
            />
          </PMFormRow>
          <PMFormRow label="Entry Date" labelWidth="sm:w-[130px] sm:min-w-[130px]">
            <Controller name="entryDate" control={control} render={({ field }) => (
              <PMDateInput {...field} disabled={disabled} className="max-w-[200px]" />
            )} />
          </PMFormRow>
          {mode !== "create" && (
            <PMFormRow label="Status" labelWidth="sm:w-[100px] sm:min-w-[100px]">
              {isSubmitted
                ? <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">Submitted</span>
                : <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Draft</span>
              }
            </PMFormRow>
          )}
        </div>
      </PMSection>

      {/* ── 2. JOURNAL LINES ─────────────────────────────────────────────── */}
      <PMSection title="Journal Lines:">
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full min-w-[600px] border-collapse text-[12.5px]">

            {/* Column headers */}
            <thead>
              <tr className="bg-[#dce8f5] border-b-2 border-[#b8d0e8]">
                <th className="w-[42px] px-3 py-2 text-center text-[10px] font-semibold text-[#2d5a8a] uppercase tracking-wider border-r border-[#b8d0e8]">#</th>
                <th className="w-[44px] px-2 py-2 text-center text-[10px] font-semibold text-[#2d5a8a] uppercase tracking-wider border-r border-[#b8d0e8]">Dr/Cr</th>
                <th className="w-[110px] px-2 py-2 text-left text-[10px] font-semibold text-[#2d5a8a] uppercase tracking-wider border-r border-[#b8d0e8]">Type</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#2d5a8a] uppercase tracking-wider border-r border-[#b8d0e8]">Particulars</th>
                <th className="w-[140px] px-3 py-2 text-right text-[10px] font-semibold text-[#2d5a8a] uppercase tracking-wider border-r border-[#b8d0e8]">Debit</th>
                <th className="w-[140px] px-3 py-2 text-right text-[10px] font-semibold text-[#2d5a8a] uppercase tracking-wider border-r border-[#b8d0e8]">Credit</th>
                {!disabled && (
                  <th className="w-[80px] px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => appendDr({ ...BLANK_DR })}
                      className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-[#25507a] text-white rounded hover:bg-[#1c3a5e] transition ml-auto"
                    >
                      <Plus size={12} /> Add Dr
                    </button>
                  </th>
                )}
                {disabled && <th className="w-[36px]" />}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">

              {/* ── DR ROWS ───────────────────────────────────────────── */}
              {drFields.map((field, idx) => {
                const line = watchedDrLines[idx] || {};
                return (
                  <tr key={field.id} className="group bg-white hover:bg-blue-50/30 transition-colors border-b border-gray-100">
                    <td className="px-3 py-1 text-center text-[11px] text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-500 border border-red-100">Dr</span>
                    </td>
                    <td className="py-1 pr-1">
                      <Controller name={`drLines.${idx}.type`} control={control} render={({ field: f }) => (
                        <select value={f.value} disabled={disabled}
                          onChange={(e) => { f.onChange(e.target.value); setValue(`drLines.${idx}.accountId`, null); }}
                          className={typeSel}
                        >
                          <option value="CC">CC Code</option>
                          <option value="Vendor">Vendor</option>
                        </select>
                      )} />
                    </td>
                    <td className="py-1 pr-1">
                      <AccountSelect name={`drLines.${idx}.accountId`} lineType={line.type} />
                    </td>
                    <td className="py-1 pr-1">
                      <AmountInput {...register(`drLines.${idx}.debitAmount`)} value={line.debitAmount}
                        disabled={disabled} placeholder="0.00"
                        className={`${amountBase} font-semibold text-red-600 ${!disabled ? "hover:bg-red-50/60" : ""}`}
                      />
                    </td>
                    <td className="py-1 pr-1">
                      <div className={`${readonlyAmt} text-gray-300`}>—</div>
                    </td>
                    <td className="px-1 text-center">
                      {!disabled && drFields.length > 1 && (
                        <button type="button" onClick={() => removeDr(idx)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* ── CR ROW ────────────────────────────────────────────── */}
              <tr className="bg-green-50/40 hover:bg-green-50/70 transition-colors border-b border-gray-100">
                <td className="px-3 py-1 text-center text-[11px] text-gray-400">{drFields.length + 1}</td>
                <td className="px-2 py-1 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-100">Cr</span>
                </td>
                <td className="py-1 pr-1">
                  <Controller name="crLine.type" control={control} render={({ field: f }) => (
                    <select value={f.value} disabled={disabled}
                      onChange={(e) => { f.onChange(e.target.value); setValue("crLine.accountId", null); }}
                      className={typeSel}
                    >
                      <option value="CC">CC Code</option>
                      <option value="Vendor">Vendor</option>
                    </select>
                  )} />
                </td>
                <td className="py-1 pr-1">
                  <AccountSelect name="crLine.accountId" lineType={watchedCrLine.type} />
                </td>
                <td className="py-1 pr-1">
                  <div className={`${readonlyAmt} text-gray-300`}>—</div>
                </td>
                <td className="py-1 pr-1">
                  <div className={`${readonlyAmt} font-semibold text-green-700`} title="Auto — equals total debit">
                    {formatAmount(totalCredit)}
                  </div>
                </td>
                <td />
              </tr>

              {/* ── GRAND TOTAL ───────────────────────────────────────── */}
              <tr className="bg-[#dce8f5] border-t-2 border-[#b8d0e8]">
                <td colSpan={4} className="px-3 py-2 text-right text-[11px] font-bold text-[#2d5a8a] uppercase tracking-wider">
                  Grand Total
                </td>
                <td className="px-3 py-2 text-right text-[13px] font-bold text-gray-800 tabular-nums">
                  {formatAmount(totalDebit)}
                </td>
                <td className="px-3 py-2 text-right text-[13px] font-bold text-gray-800 tabular-nums">
                  {formatAmount(totalCredit)}
                </td>
                <td />
              </tr>

            </tbody>
          </table>
        </div>
      </div>
      </PMSection>

      {/* ── 3. NARRATION ─────────────────────────────────────────────────── */}
      <PMSection title="Narration:">
        <Controller name="remarks" control={control} render={({ field }) => (
          <PMTextarea
            value={field.value || ""} onChange={field.onChange}
            disabled={disabled}
            placeholder="Enter narration or remarks…"
            rows={2} maxRows={6}
          />
        )} />
      </PMSection>

      {/* ── 4. ACTIONS ────────────────────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
          {mode !== "create" && !isSubmitted && (
            <EditButton onClick={handleEdit} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
          {isEditing && (
            <SaveDraftButton onClick={() => handleSubmit(onSave)()} loading={isSubmitting} disabled={isSubmitting} />
          )}
          <SaveButton
            onClick={onSubmitForApproval} loading={isSubmitting}
            disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
            loadingText="Submitting…" confirmationTitle="Submit Journal Entry for Approval?" requireConfirmation
          >
            Submit
          </SaveButton>
        </div>
      )}

    </div>
  );
}
