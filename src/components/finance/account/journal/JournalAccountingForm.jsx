"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter }   from "next/navigation";
import { Loader2 }     from "lucide-react";
import { toast }       from "sonner";

import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMInput         from "@/components/project-management/common/PMInput";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMSelect           from "@/components/project-management/common/PMSelect";
import SearchableSelect   from "@/components/common/SearchableSelect";
import AmountInput     from "@/components/common/AmountInput";
import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import { apiRequest }  from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const BASE = API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.BASE;
const LABEL_W = "sm:w-[160px] sm:min-w-[160px]";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function JournalAccountingForm({ mode = "create", accountingId, onUuid, onAfterSubmit }) {
  const router     = useRouter();
  const isViewMode = mode === "view" || mode === "approver";

  const [isEditing,    setIsEditing]    = useState(mode === "create");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted,  setIsSubmitted]  = useState(false);
  const [allowSubmit,  setAllowSubmit]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(mode !== "create");

  const [voucherNo,   setVoucherNo]   = useState("");
  const [voucherDate, setVoucherDate] = useState(today());
  const [accountingData, setAccountingData] = useState(null);

  // Create-mode: approved journal voucher selection
  const [approvedVouchers,   setApprovedVouchers]   = useState([]);
  const [selectedVoucherId,  setSelectedVoucherId]   = useState("");
  const [selectedVoucherInfo, setSelectedVoucherInfo] = useState(null);

  // Lines (editable amounts)
  const [lines, setLines] = useState([]);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";
  const disabled    = isViewMode || !isEditing;

  // ── Fetch approved vouchers (create mode) ────────────────────────────────
  useEffect(() => {
    if (mode !== "create" || !projectCode) return;
    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.APPROVED_VOUCHERS}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => setApprovedVouchers(res.data?.vouchers || []))
      .catch(() => toast.error("Failed to fetch approved vouchers"));
  }, [mode, projectCode]);

  // ── Load existing accounting record ─────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !accountingId) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.GET_BY_ID}${accountingId}`,
          method: "GET",
        });
        const d = res.data;
        setAccountingData(d);
        setVoucherNo(d.voucherNo || "");
        setVoucherDate(d.voucherDate || today());
        onUuid?.(d.voucherUuid);
        setLines((d.lines || []).map((l) => ({ ...l, amount: l.amount ?? l.originalAmount })));

        const locked = !["Draft", "Reback"].includes(d.workflowStatus);
        setAllowSubmit(!locked);
        if (locked) {
          setIsSubmitted(true);
        }
        setIsEditing(false);
      } catch (err) {
        toast.error(err.message || "Failed to load");
        setIsSubmitted(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [accountingId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── When a voucher is selected (create mode) ─────────────────────────────
  const handleVoucherSelect = useCallback((voucherId) => {
    setSelectedVoucherId(voucherId);
    const v = approvedVouchers.find((v) => String(v.journalVoucherId) === String(voucherId));
    setSelectedVoucherInfo(v || null);
    setLines((v?.lines || []).map((l) => ({
      journalLineId:   l.journalLineId,
      slNo:            l.slNo,
      ccCode:          l.ccCode,
      ccName:          l.ccName,
      shortDescription: l.shortDescription || "",
      originalAmount:  l.amount,
      amount:          l.amount,
    })));
  }, [approvedVouchers]);

  const setLineAmount = (idx, val) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, amount: val } : l));
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("projectCode",      projectCode);
    fd.append("voucherDate",      voucherDate);
    if (mode === "create") fd.append("journalVoucherId", selectedVoucherId);
    fd.append("lines", JSON.stringify(lines.map((l) => ({
      journalLineId:   l.journalLineId,
      slNo:            l.slNo,
      ccCode:          l.ccCode,
      ccName:          l.ccName,
      shortDescription: l.shortDescription,
      originalAmount:  Number(l.originalAmount || 0),
      amount:          Number(l.amount || 0),
    }))));
    return fd;
  };

  const validate = (forDraft = false) => {
    if (!voucherDate) { toast.error("Please select a date"); return false; }
    if (mode === "create" && !selectedVoucherId) { toast.error("Please select a Journal Voucher"); return false; }
    if (lines.length === 0) { toast.error("No lines to save"); return false; }
    if (!forDraft) {
      const invalid = lines.some((l) => !l.amount || Number(l.amount) <= 0);
      if (invalid) { toast.error("All line amounts must be greater than 0"); return false; }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate(true)) return;
    const tid = toast.loading("Saving draft…");
    setIsSubmitting(true);
    try {
      if (mode === "create") {
        const res = await apiRequest({ url: API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.CREATE, method: "POST", data: buildFormData() });
        toast.success("Draft saved", { id: tid });
        router.replace(`/finance-management/account/journal/accounting/${res.data.id}`);
      } else {
        await apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.EDIT}${accountingId}`, method: "PUT", data: buildFormData() });
        toast.success("Draft saved", { id: tid });
        const res = await apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.GET_BY_ID}${accountingId}`, method: "GET" });
        setAccountingData(res.data);
        setAllowSubmit(true);
        setIsEditing(false);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAccounting = async () => {
    if (!validate(false)) return;
    const tid = toast.loading("Submitting…");
    setIsSubmitting(true);
    try {
      if (mode === "create") {
        const res = await apiRequest({ url: API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.CREATE, method: "POST", data: buildFormData() });
        const newId = res.data.id;
        await apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.SUBMIT}${newId}`, method: "POST" });
        toast.success("Submitted for approval", { id: tid });
        router.replace(`/finance-management/account/journal/accounting/${newId}`);
      } else {
        await apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.EDIT}${accountingId}`, method: "PUT", data: buildFormData() });
        await apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.SUBMIT}${accountingId}`, method: "POST" });
        toast.success("Submitted for approval", { id: tid });
        setIsSubmitted(true);
        setAllowSubmit(false);
        setIsEditing(false);
        onAfterSubmit?.();
      }
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = () => {
    if (isEditing) { setIsEditing(false); }
    else           { setIsEditing(true);  }
  };

  const totalAmount = lines.reduce((s, l) => s + Number(l.amount || 0), 0);

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
      </div>
    );
  }

  // ─── Voucher select options ─────────────────────────────────────────────
  const voucherOptions = approvedVouchers.map((v) => ({
    label: `${v.voucherNo} — ${v.fundSource} — ${formatAmount(v.totalAmount || 0)}`,
    value: String(v.journalVoucherId),
  }));

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex gap-4 items-start">

        {/* ── Left panel ─────────────────────────────────────────── */}
        <div className="w-[400px] shrink-0">
          <PMSection title="Voucher Info">
            <PMFormRow label="Voucher No" labelWidth={LABEL_W}>
              <PMInput value={voucherNo || "Auto"} disabled />
            </PMFormRow>

            <PMFormRow label="Date" labelWidth={LABEL_W} required>
              <PMDateInput
                value={voucherDate}
                onChange={(val) => setVoucherDate(val)}
                disabled={disabled}
              />
            </PMFormRow>

            {/* Journal Voucher select — create mode only */}
            {mode === "create" && (
              <PMFormRow label="Journal Voucher" labelWidth={LABEL_W} required>
                {approvedVouchers.length === 0 ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-orange-200 bg-orange-50 text-[12px] text-orange-600">
                    <span>⚠</span>
                    <span>No approved Journal Vouchers available</span>
                  </div>
                ) : (
                  <SearchableSelect
                    options={voucherOptions}
                    value={selectedVoucherId}
                    onChange={(v) => handleVoucherSelect(v)}
                    placeholder="Search approved voucher…"
                    labelKey="label"
                    valueKey="value"
                    searchKeys={["label"]}
                    disabled={disabled}
                  />
                )}
              </PMFormRow>
            )}

            {/* Auto-populated from selected / loaded voucher — always visible */}
            {(() => {
              const info = selectedVoucherInfo
                ? { no: selectedVoucherInfo.voucherNo, date: selectedVoucherInfo.voucherDate, src: selectedVoucherInfo.fundSource }
                : accountingData
                ? { no: accountingData.journalVoucherNo, date: accountingData.journalVoucherDate || null, src: accountingData.fundSource }
                : { no: "", date: null, src: "" };
              return (
                <>
                  <PMFormRow label="JV No" labelWidth={LABEL_W}>
                    <PMInput value={info.no || ""} disabled placeholder="—" />
                  </PMFormRow>
                  <PMFormRow label="JV Date" labelWidth={LABEL_W}>
                    <PMInput value={info.date ? (getfmtDisplaydate(info.date) || info.date) : ""} disabled placeholder="—" />
                  </PMFormRow>
                  <PMFormRow label="Fund Source" labelWidth={LABEL_W}>
                    <PMInput value={info.src || ""} disabled placeholder="—" />
                  </PMFormRow>
                </>
              );
            })()}

          </PMSection>
        </div>

        {/* ── Right panel ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="border border-[#b5b5b5] rounded-sm overflow-hidden">
            <div className="bg-[#d6e6f2] px-3 py-2 border-b border-[#b5b5b5]">
              <span className="text-[13px] font-semibold text-[#144664]">Journal Accounting Lines</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[520px]">
                <thead className="bg-[#144664]">
                  <tr>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-center w-[44px]">SL no</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-center w-[80px]">CC Code</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left">CC Name &amp; Short Description</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-right w-[120px]">Orig. Amount</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-right w-[130px]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-400 text-[13px]">
                        {mode === "create" ? "Select a Journal Voucher to load lines" : "No lines found"}
                      </td>
                    </tr>
                  ) : lines.map((l, i) => (
                    <tr key={l.journalLineId || i} className={i % 2 === 0 ? "bg-white" : "bg-[#f7f7f7]"}>
                      <td className="border border-[#d0d0d0] px-2 py-1.5 text-center text-gray-500">{l.slNo || i + 1}</td>
                      <td className="border border-[#d0d0d0] px-2 py-1 text-center text-[12px] font-semibold text-[#144664] bg-[#f0f6fb]">
                        {l.ccCode}
                      </td>
                      <td className="border border-[#d0d0d0] p-0 align-top">
                        <div className="flex flex-col">
                          <span className="px-2 py-1 text-[12px] font-medium text-gray-800">{l.ccName || "—"}</span>
                          {l.shortDescription && (
                            <span className="px-2 pb-1 text-[11px] text-gray-500 border-t border-[#e8e8e8]">{l.shortDescription}</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-[#d0d0d0] px-2 py-1.5 text-right font-mono text-[12px] text-gray-500">
                        {formatAmount(l.originalAmount)}
                      </td>
                      <td className="border border-[#d0d0d0] p-0">
                        <AmountInput
                          value={l.amount}
                          onChange={(e) => setLineAmount(i, e.target.value)}
                          disabled={disabled}
                          placeholder="0.00"
                          className="w-full text-right font-mono text-[12px] px-2 py-1.5 border-0 focus:outline-none bg-transparent disabled:bg-transparent"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {lines.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#d6e6f2] font-semibold">
                      <td colSpan={4} className="border border-[#b5b5b5] px-2 py-1 text-right text-sm">TOTAL =</td>
                      <td className="border border-[#b5b5b5] px-2 py-1 text-right text-sm font-bold">
                        {formatAmount(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action buttons ───────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex justify-end gap-2 pt-1">
          {isEditing && (
            <SaveDraftButton onClick={handleSaveDraft} disabled={isSubmitting}>
              Save as Draft
            </SaveDraftButton>
          )}
          <SaveButton
            onClick={handleSubmitAccounting}
            disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
            confirmationTitle="Submit for Approval?"
            confirmationMessage="Once submitted, this journal accounting record will be sent for approval."
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
  );
}
