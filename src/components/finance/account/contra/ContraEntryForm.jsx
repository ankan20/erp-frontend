"use client";

import { useEffect, useState }          from "react";
import { Controller }                    from "react-hook-form";
import { useFormWithToast as useForm }   from "@/hooks/useFormWithToast";
import { z }                             from "zod";
import { zodResolver }                   from "@hookform/resolvers/zod";
import { toast }                         from "sonner";
import { useRouter }                     from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton       from "@/components/common/SaveButton";
import SaveDraftButton  from "@/components/common/SaveDraftButton";
import EditButton       from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection        from "@/components/project-management/common/PMSection";
import PMFormRow        from "@/components/project-management/common/PMFormRow";
import PMTextarea       from "@/components/project-management/common/PMTextarea";
import { ACC }          from "@/components/finance/account/common/accountTheme";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

// ─── Schema ───────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  drCr:           z.string(),
  accountId:      z.coerce.number().nullable().optional(),
  openingBalance: z.coerce.number().default(0),
  debitAmount:    z.coerce.number().min(0).default(0),
  creditAmount:   z.coerce.number().min(0).default(0),
});

const schema = z.object({
  remarks: z.string().optional().default(""),
  lines:   z.array(lineSchema).length(2),
});

const DEFAULT_VALUES = {
  remarks: "",
  lines: [
    { drCr: "Dr", accountId: null, openingBalance: 0, debitAmount: 0, creditAmount: 0 },
    { drCr: "Cr", accountId: null, openingBalance: 0, debitAmount: 0, creditAmount: 0 },
  ],
};

const fmt = (val) => {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContraEntryForm({ mode = "create", contraId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,    setIsEditing]    = useState(mode === "create");
  const [isSubmitted,  setIsSubmitted]  = useState(false);
  const [allowSubmit,  setAllowSubmit]  = useState(mode === "edit");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [erpVoucherNo, setErpVoucherNo] = useState("");
  const [entryDate,    setEntryDate]    = useState("");
  const [bankCashOpts, setBankCashOpts] = useState([]);

  const {
    register, control, handleSubmit, reset, watch,
    formState: { isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Computed values ───────────────────────────────────────────────────────
  const line0 = watch("lines.0") || {};
  const line1 = watch("lines.1") || {};

  const closing0 = Number(line0.openingBalance || 0) - Number(line0.debitAmount || 0) + Number(line0.creditAmount || 0);
  const closing1 = Number(line1.openingBalance || 0) - Number(line1.debitAmount || 0) + Number(line1.creditAmount || 0);

  const totalDebit  = Number(line0.debitAmount  || 0) + Number(line1.debitAmount  || 0);
  const totalCredit = Number(line0.creditAmount || 0) + Number(line1.creditAmount || 0);
  const isUnbalanced = totalDebit > 0 && totalCredit > 0 && Math.abs(totalDebit - totalCredit) > 0.01;

  // ── Load bank/cash accounts ───────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.MASTER.BANK_CASH.LIST}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => {
        const opts = (res.data || []).map((a) => ({
          ...a,
          displayLabel: a.type === "CASH"
            ? `CASH-${a.bankCode || ""}`
            : `${a.bankName || a.bankHolderName || ""} — ${a.bankCode || ""}`,
        }));
        setBankCashOpts(opts);
      })
      .catch(() => {});
  }, [projectCode]);

  // ── Fetch detail (edit / view) ────────────────────────────────────────────
  useEffect(() => {
    if (!contraId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.CONTRA_ENTRY.GET_BY_ID}${contraId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        const sorted = [...(d.lines || [])].sort((a, b) => a.slNo - b.slNo);
        reset({
          remarks: d.remarks || "",
          lines: sorted.length === 2
            ? sorted.map((l) => ({
                drCr:           l.drCr           || "",
                accountId:      l.accountId      || null,
                openingBalance: Number(l.openingBalance || 0),
                debitAmount:    Number(l.debitAmount    || 0),
                creditAmount:   Number(l.creditAmount   || 0),
              }))
            : DEFAULT_VALUES.lines,
        });
        setErpVoucherNo(d.voucherNo || "");
        setEntryDate(d.entryDate   || "");
        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.contraUuid && onUuid) onUuid(d.contraUuid);
      })
      .catch(() => toast.error("Failed to load contra entry"));
  }, [contraId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Draft ────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    if (!v.lines[0].accountId) { toast.error("Select the Dr. (Debit) account");  return; }
    if (!v.lines[1].accountId) { toast.error("Select the Cr. (Credit) account"); return; }
    if (Number(v.lines[0].accountId) === Number(v.lines[1].accountId)) {
      toast.error("Dr. and Cr. accounts cannot be the same");
      return;
    }

    const drAmt = Number(v.lines[0].debitAmount  || 0);
    const crAmt = Number(v.lines[1].creditAmount || 0);

    if (drAmt <= 0) { toast.error("Enter a debit amount greater than zero");  return; }
    if (crAmt <= 0) { toast.error("Enter a credit amount greater than zero"); return; }
    if (Math.abs(drAmt - crAmt) > 0.01) {
      toast.error(`Debit (${fmt(drAmt)}) must equal Credit (${fmt(crAmt)})`);
      return;
    }

    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.CONTRA_ENTRY.CREATE
      : `${API_ENDPOINTS.FINANCE.CONTRA_ENTRY.EDIT}${contraId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      remarks: v.remarks || "",
      lines: [
        {
          slNo:           1,
          drCr:           "Dr",
          accountId:      Number(v.lines[0].accountId),
          openingBalance: Number(v.lines[0].openingBalance || 0),
          debitAmount:    drAmt,
          creditAmount:   0,
        },
        {
          slNo:           2,
          drCr:           "Cr",
          accountId:      Number(v.lines[1].accountId),
          openingBalance: Number(v.lines[1].openingBalance || 0),
          debitAmount:    0,
          creditAmount:   crAmt,
        },
      ],
    };

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Contra entry saved as draft" : "Contra entry updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.contraUuid && onUuid) onUuid(res.data.contraUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/contra/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.CONTRA_ENTRY.SUBMIT}${contraId}`, method: "POST" });
      toast.success("Contra entry submitted for approval");
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

  // ── Input style helpers ────────────────────────────────────────────────────
  const openingCls = `w-full h-[26px] text-[12px] px-1.5 text-right outline-none rounded-sm border-0 ${
    disabled ? "bg-[#edf8ed] text-gray-500" : "bg-[#fff0f0] focus:bg-white focus:border focus:border-[#e0a0a0]"
  }`;
  const amountCls  = `w-full h-[26px] text-[12px] px-1.5 text-right outline-none rounded-sm border-0 ${
    disabled ? "bg-transparent text-gray-600" : "bg-[#fffbe6] focus:bg-white focus:border focus:border-[#93b5cc]"
  }`;

  const drAccountId = Number(line0.accountId || 0);
  const crAccountId = Number(line1.accountId || 0);

  const ROWS = [
    { idx: 0, drCr: "Dr", isDebitRow: true,  excludeId: crAccountId },
    { idx: 1, drCr: "Cr", isDebitRow: false, excludeId: drAccountId },
  ];

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
                    placeholder="Transfer remarks…"
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
            <div className={`${ACC.tableHead} px-3 py-[5px]`}>
              <span className={ACC.sectionTitle}>Contra Lines</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className={ACC.tableHead}>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[60px]">Dr./Cr.</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">Particulars</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[130px]">Opening</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[130px]">Debit</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[130px]">Credit</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[130px]">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(({ idx, drCr, isDebitRow, excludeId }) => {
                    const closing = idx === 0 ? closing0 : closing1;
                    return (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>

                        {/* Dr./Cr. label */}
                        <td className={`border border-gray-200 px-2 py-[3px] text-center font-bold text-[13px] ${
                          isDebitRow ? "text-[#c0392b]" : "text-[#1a7a3c]"
                        }`}>
                          {drCr}
                        </td>

                        {/* Particulars — bank/cash account select */}
                        <td className="border border-gray-200 p-0.5">
                          <Controller
                            name={`lines.${idx}.accountId`}
                            control={control}
                            render={({ field: f }) => (
                              <SearchableSelect
                                options={excludeId ? bankCashOpts.filter((a) => Number(a.id) !== excludeId) : bankCashOpts}
                                value={f.value ? String(f.value) : ""}
                                disabled={disabled}
                                onChange={(v) => f.onChange(v ? Number(v) : null)}
                                placeholder="Select account…"
                                labelKey="displayLabel"
                                valueKey="id"
                                searchKeys={["displayLabel", "bankName", "bankHolderName", "bankCode", "bankAcNumber"]}
                                compact
                              />
                            )}
                          />
                        </td>

                        {/* Opening balance */}
                        <td className="border border-gray-200 p-0.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            {...register(`lines.${idx}.openingBalance`)}
                            disabled={disabled}
                            placeholder="0.00"
                            className={openingCls}
                          />
                        </td>

                        {/* Debit — only active for Dr row */}
                        <td className="border border-gray-200 p-0.5">
                          {isDebitRow ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              {...register(`lines.${idx}.debitAmount`)}
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

                        {/* Credit — only active for Cr row */}
                        <td className="border border-gray-200 p-0.5">
                          {!isDebitRow ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              {...register(`lines.${idx}.creditAmount`)}
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
                            {fmt(closing)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Total row */}
                  <tr className={`${ACC.tableHead} font-semibold`}>
                    <td colSpan={3} className="border border-gray-300 px-3 py-1.5 text-right text-[12px]">
                      TOTAL
                    </td>
                    <td className={`border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums ${
                      isUnbalanced ? "text-red-600" : ""
                    }`}>
                      {fmt(totalDebit)}
                    </td>
                    <td className={`border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums ${
                      isUnbalanced ? "text-red-600" : ""
                    }`}>
                      {fmt(totalCredit)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums text-gray-500">
                      {fmt(closing0 + closing1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Balance warning strip */}
            {isUnbalanced && (
              <div className="px-3 py-1.5 bg-red-50 border-t border-red-200 text-red-600 text-[12px]">
                Debit and Credit must be equal — difference: {fmt(Math.abs(totalDebit - totalCredit))}
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
                confirmationTitle="Submit Contra Entry for Approval?"
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
