"use client";

import { useEffect, useState }        from "react";
import { Controller }                  from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }                           from "zod";
import { zodResolver }                 from "@hookform/resolvers/zod";
import { toast }                       from "sonner";
import { useRouter }                   from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton       from "@/components/common/SaveButton";
import SaveDraftButton  from "@/components/common/SaveDraftButton";
import EditButton       from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import AmountInput      from "@/components/common/AmountInput";
import PMSection        from "@/components/project-management/common/PMSection";
import PMFormRow        from "@/components/project-management/common/PMFormRow";
import PMTextarea       from "@/components/project-management/common/PMTextarea";
import { ACC }          from "@/components/finance/account/common/accountTheme";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";

// ─── Schema ───────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  type:           z.enum(["CC", "Vendor"]),
  accountId:      z.coerce.number().nullable().optional(),
  openingBalance: z.coerce.number().default(0),
  debitAmount:    z.coerce.number().min(0).default(0),
  creditAmount:   z.coerce.number().min(0).default(0),
});

const schema = z.object({
  remarks: z.string().optional().default(""),
  lines:   z.array(lineSchema).length(2),
});

const BLANK_LINE = { type: "CC", accountId: null, openingBalance: 0, debitAmount: 0, creditAmount: 0 };

const DEFAULT_VALUES = {
  remarks: "",
  lines: [{ ...BLANK_LINE }, { ...BLANK_LINE }],
};

// row 0 = Dr, row 1 = Cr (fixed)
const ROWS = [0, 1];

// ─── Component ────────────────────────────────────────────────────────────────

export default function JournalEntryForm({ mode = "create", journalId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,    setIsEditing]    = useState(mode === "create");
  const [isSubmitted,  setIsSubmitted]  = useState(false);
  const [allowSubmit,  setAllowSubmit]  = useState(mode === "edit");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [erpVoucherNo, setErpVoucherNo] = useState("");
  const [entryDate,    setEntryDate]    = useState("");
  const [ccCodeList,   setCcCodeList]   = useState([]);
  const [vendorList,   setVendorList]   = useState([]);

  const {
    register, control, handleSubmit, reset, watch, setValue,
    formState: { isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const watchedLines = watch("lines") || [];
  const disabled     = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Computed totals ───────────────────────────────────────────────────────
  const line0        = watchedLines[0] || {};
  const line1        = watchedLines[1] || {};
  const totalDebit   = Number(line0.debitAmount  || 0);
  const totalCredit  = Number(line1.creditAmount || 0);
  const isUnbalanced = totalDebit > 0 && totalCredit > 0 && Math.abs(totalDebit - totalCredit) > 0.01;

  // ── Load CC codes + Vendor list once ─────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_CC_CODE}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => {
        setCcCodeList(
          (res.data || []).map((c) => ({ ...c, displayLabel: `${c.ccCode || ""} — ${c.ccName || ""}` })),
        );
      })
      .catch(() => {});
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => {
        setVendorList(
          (res.data || []).map((v) => ({ ...v, displayLabel: `${v.ledgerCode || ""} — ${v.ledgerName || ""}` })),
        );
      })
      .catch(() => {});
  }, [projectCode]);

  // ── Fetch detail (edit / view) ────────────────────────────────────────────
  useEffect(() => {
    if (!journalId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.GET_BY_ID}${journalId}`, method: "GET" })
      .then((res) => {
        const d      = res.data || {};
        const sorted = [...(d.lines || [])].sort((a, b) => a.slNo - b.slNo);
        const dr     = sorted.find((l) => l.drCr === "Dr") || sorted[0] || {};
        const cr     = sorted.find((l) => l.drCr === "Cr") || sorted[1] || {};
        reset({
          remarks: d.remarks || "",
          lines: [
            {
              type:           dr.type           || "CC",
              accountId:      dr.accountId      || null,
              openingBalance: Number(dr.openingBalance || 0),
              debitAmount:    Number(dr.debitAmount    || 0),
              creditAmount:   0,
            },
            {
              type:           cr.type           || "CC",
              accountId:      cr.accountId      || null,
              openingBalance: Number(cr.openingBalance || 0),
              debitAmount:    0,
              creditAmount:   Number(cr.creditAmount   || 0),
            },
          ],
        });
        setErpVoucherNo(d.voucherNo || "");
        setEntryDate(d.entryDate   || "");
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.journalUuid && onUuid) onUuid(d.journalUuid);
      })
      .catch(() => toast.error("Failed to load journal entry"));
  }, [journalId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Draft ────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    for (let i = 0; i < 2; i++) {
      if (!v.lines[i].accountId) {
        toast.error(`Select an account for line ${i + 1}`);
        return;
      }
    }
    const drAmt = Number(v.lines[0].debitAmount  || 0);
    const crAmt = Number(v.lines[1].creditAmount || 0);
    if (drAmt <= 0) { toast.error("Debit amount must be greater than zero"); return; }
    if (crAmt <= 0) { toast.error("Credit amount must be greater than zero"); return; }
    if (Math.abs(drAmt - crAmt) > 0.01) {
      toast.error(`Debit (${formatAmount(drAmt)}) must equal Credit (${formatAmount(crAmt)})`);
      return;
    }

    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.CREATE
      : `${API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.EDIT}${journalId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      remarks: v.remarks || "",
      lines: v.lines.map((l, i) => ({
        slNo:           i + 1,
        type:           l.type,
        drCr:           i === 0 ? "Dr" : "Cr",
        accountId:      Number(l.accountId),
        openingBalance: Number(l.openingBalance || 0),
        debitAmount:    i === 0 ? Number(l.debitAmount  || 0) : 0,
        creditAmount:   i === 1 ? Number(l.creditAmount || 0) : 0,
      })),
    };

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Journal entry saved as draft" : "Journal entry updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.journalUuid && onUuid) onUuid(res.data.journalUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/journal/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.SUBMIT}${journalId}`, method: "POST" });
      toast.success("Journal entry submitted for approval");
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

  // ── Input style helpers ───────────────────────────────────────────────────
  const openingCls = `w-full h-[26px] text-[12px] px-1.5 text-right outline-none rounded-sm border-0 ${
    disabled ? "bg-[#edf8ed] text-gray-500" : "bg-[#fff0f0] focus:bg-white focus:border focus:border-[#e0a0a0]"
  }`;
  const amountCls = `w-full h-[26px] text-[12px] px-1.5 text-right outline-none rounded-sm border-0 ${
    disabled ? "bg-transparent text-gray-600" : "bg-[#fffbe6] focus:bg-white focus:border focus:border-[#93b5cc]"
  }`;

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

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[320px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          <PMSection title="Entry Details:">
            <PMFormRow label="ERP Doc. No" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <input
                value={erpVoucherNo || "[Auto]"}
                disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
              />
            </PMFormRow>
            <PMFormRow label="Entry Date" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <input
                value={entryDate || "[Auto - Today]"}
                disabled readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
              />
            </PMFormRow>
          </PMSection>

          <PMSection title="Remarks:">
            <PMFormRow label="Remarks" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <Controller
                name="remarks"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Journal remarks…"
                    rows={3}
                    maxRows={8}
                  />
                )}
              />
            </PMFormRow>
          </PMSection>

        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <div className={`${ACC.tableHead} px-3 py-[5px] flex items-center justify-between`}>
              <span className={ACC.sectionTitle}>Journal Lines</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className={ACC.tableHead}>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[36px]">Sl.</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[80px]">Type</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[50px]">Dr./Cr.</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">Particulars</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[120px]">Opening</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[120px]">Debit</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[120px]">Credit</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[120px]">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((idx) => {
                    const line      = watchedLines[idx] || {};
                    const isDebit   = idx === 0;
                    const opts      = line.type === "Vendor" ? vendorList : ccCodeList;
                    const vKey      = line.type === "Vendor" ? "ledgerId" : "ccId";
                    const sKeys     = line.type === "Vendor"
                      ? ["displayLabel", "ledgerCode", "ledgerName"]
                      : ["displayLabel", "ccCode", "ccName"];
                    const closing   = Number(line.openingBalance || 0)
                                      - Number(line.debitAmount  || 0)
                                      + Number(line.creditAmount || 0);

                    return (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>

                        {/* Sl. */}
                        <td className="border border-gray-200 px-2 py-[3px] text-center text-gray-500">
                          {idx + 1}
                        </td>

                        {/* Type */}
                        <td className="border border-gray-200 p-0.5">
                          <Controller
                            name={`lines.${idx}.type`}
                            control={control}
                            render={({ field: f }) => (
                              <select
                                value={f.value}
                                onChange={(e) => {
                                  f.onChange(e.target.value);
                                  setValue(`lines.${idx}.accountId`, null);
                                }}
                                disabled={disabled}
                                className={`w-full h-[26px] text-[12px] px-1 rounded-sm border-0 outline-none ${
                                  disabled ? "bg-transparent text-gray-600" : "bg-[#eef4fb] cursor-pointer"
                                }`}
                              >
                                <option value="CC">CC</option>
                                <option value="Vendor">Vendor</option>
                              </select>
                            )}
                          />
                        </td>

                        {/* Dr./Cr. — fixed label */}
                        <td className="border border-gray-200 px-2 py-[3px] text-center">
                          <span className={`font-bold text-[12px] ${isDebit ? "text-[#c0392b]" : "text-[#1a7a3c]"}`}>
                            {isDebit ? "Dr" : "Cr"}
                          </span>
                        </td>

                        {/* Particulars */}
                        <td className="border border-gray-200 p-0.5">
                          <Controller
                            name={`lines.${idx}.accountId`}
                            control={control}
                            render={({ field: f }) => (
                              <SearchableSelect
                                options={opts}
                                value={f.value ? String(f.value) : ""}
                                disabled={disabled}
                                onChange={(v) => f.onChange(v ? Number(v) : null)}
                                placeholder={line.type === "Vendor" ? "Select vendor…" : "Select CC code…"}
                                labelKey="displayLabel"
                                valueKey={vKey}
                                searchKeys={sKeys}
                                compact
                              />
                            )}
                          />
                        </td>

                        {/* Opening balance */}
                        <td className="border border-gray-200 p-0.5">
                          <AmountInput
                            {...register(`lines.${idx}.openingBalance`)}
                            value={line.openingBalance}
                            disabled={disabled}
                            placeholder="0.00"
                            className={openingCls}
                          />
                        </td>

                        {/* Debit — active on row 0 only */}
                        <td className="border border-gray-200 p-0.5">
                          {isDebit ? (
                            <AmountInput
                              {...register(`lines.${idx}.debitAmount`)}
                              value={line.debitAmount}
                              disabled={disabled}
                              placeholder="0.00"
                              className={amountCls}
                            />
                          ) : (
                            <div className="w-full h-[26px] flex items-center justify-center text-gray-300 bg-[#f5f5f5] rounded-sm select-none">
                              —
                            </div>
                          )}
                        </td>

                        {/* Credit — active on row 1 only */}
                        <td className="border border-gray-200 p-0.5">
                          {!isDebit ? (
                            <AmountInput
                              {...register(`lines.${idx}.creditAmount`)}
                              value={line.creditAmount}
                              disabled={disabled}
                              placeholder="0.00"
                              className={amountCls}
                            />
                          ) : (
                            <div className="w-full h-[26px] flex items-center justify-center text-gray-300 bg-[#f5f5f5] rounded-sm select-none">
                              —
                            </div>
                          )}
                        </td>

                        {/* Closing — auto-computed */}
                        <td className="border border-gray-200 p-0.5">
                          <div className="w-full h-[26px] flex items-center justify-end px-2 bg-[#edf8ed] text-gray-600 text-[12px] rounded-sm tabular-nums">
                            {formatAmount(closing)}
                          </div>
                        </td>

                      </tr>
                    );
                  })}

                  {/* Total row */}
                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={5} className="border border-gray-300 px-3 py-1.5 text-right text-[12px]">
                      TOTAL
                    </td>
                    <td className={`border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums ${isUnbalanced ? "text-red-600" : ""}`}>
                      {formatAmount(totalDebit)}
                    </td>
                    <td className={`border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums ${isUnbalanced ? "text-red-600" : ""}`}>
                      {formatAmount(totalCredit)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums text-gray-500">
                      {formatAmount(
                        Number(line0.openingBalance || 0) - Number(line0.debitAmount || 0) +
                        Number(line1.openingBalance || 0) + Number(line1.creditAmount || 0)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {isUnbalanced && (
              <div className="px-3 py-1.5 bg-red-50 border-t border-red-200 text-red-600 text-[12px]">
                Debit and Credit must be equal — difference: {formatAmount(Math.abs(totalDebit - totalCredit))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton
                  onClick={() => handleSubmit(onSave)()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                />
              )}
              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                loadingText="Submitting…"
                confirmationTitle="Submit Journal Entry for Approval?"
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
