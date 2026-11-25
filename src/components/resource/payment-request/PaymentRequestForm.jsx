"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Controller } from "react-hook-form";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import FileUpload, { ACCEPT_DOC, TYPES_DOC } from "@/components/common/FileUpload";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchableSelect from "@/components/common/SearchableSelect";
import AmountInput from "@/components/common/AmountInput";
import { formatAmount } from "@/helper/numberFormatter";
import { getFormatCategoryName } from "@/helper/getFormatCategoryName";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass, labelClass } from "@/lib/formStyles";
import { getPageAccess } from "@/helper/getPageAccess";
import { zodDate } from "@/lib/dateUtils";
import AdvanceAdjustModal from "@/components/finance/account/payment/AdvanceAdjustModal";
import AdvanceAdjustmentsTable from "@/components/finance/account/payment/AdvanceAdjustmentsTable";

const EP = API_ENDPOINTS.RESOURCE.PAYMENT_REQUEST;
const BASE_PATH = "/resource-management/sub-contractor-billing/payment-request";

const PAYMENT_MODES = ["Bank", "Cash"];
const ADVANCE_PAYMENT_PATH = "/finance-management/account/payment/new";

// AmountInput keeps the raw string in form state — coerce, but reject blanks
const amount = (required) =>
  z
    .any()
    .refine(
      (v) => (!required && (v === "" || v === null || v === undefined)) || (v !== "" && v !== null && v !== undefined && !isNaN(Number(v))),
      "Required",
    )
    .transform((v) => Number(v) || 0)
    .refine((n) => n >= 0, "Cannot be negative");

const schema = z
  .object({
    prNo:             z.string().optional(),
    prDate:           z.string().optional(),
    vendorId:         z.string().optional(),
    sourceType:       z.enum(["BRR", "JOURNAL", "ADVANCE"]),
    brrId:            z.string().optional(),
    journalKey:       z.string().optional(),   // "<journalId>:<vendorId>"
    requestedAmount:  amount(true).refine((n) => n > 0, "Requested amount must be greater than 0"),
    deductionAmount:  amount(false),
    deductionRemarks: z.string().optional(),
    paymentMode:      z.string().optional(),
    requiredByDate:   zodDate(z, "Required By Date"),
    remarks:          z.string().optional(),
  })
  .refine((v) => v.deductionAmount <= v.requestedAmount, {
    message: "Deduction cannot exceed requested amount",
    path: ["deductionAmount"],
  })
  .refine((v) => v.sourceType !== "BRR" || !!v.brrId, { message: "BRR No is required", path: ["brrId"] })
  .refine((v) => v.sourceType !== "JOURNAL" || !!v.journalKey, { message: "Journal is required", path: ["journalKey"] })
  .refine((v) => v.sourceType !== "ADVANCE" || !!v.vendorId, { message: "Vendor is required for an advance", path: ["vendorId"] });

const defaultValues = {
  prNo:             "",
  prDate:           "",
  vendorId:         "",
  sourceType:       "BRR",
  brrId:            "",
  journalKey:       "",
  requestedAmount:  "",
  deductionAmount:  0,
  deductionRemarks: "",
  paymentMode:      "",
  requiredByDate:   "",
  remarks:          "",
};

/* ─── Field row helper (same layout as BRR) ─────────────────── */
function FieldRow({ label, children, required }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-h-[34px]">
      <div className={`${labelClass} w-full sm:w-[200px] sm:min-w-[200px] sm:max-w-[200px]`}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ReadOnly({ value, className = "" }) {
  return (
    <Input value={value ?? ""} disabled placeholder="[Auto]"
      className={`${getInputClass(false, true)} w-full h-[34px] ${className}`} />
  );
}


/* ─── PaymentRequestForm ────────────────────────────────────── */
export default function PaymentRequestForm({
  mode = "create", prId, presetBrrId, presetJournalId, presetVendorId, onDataLoaded, onAfterSubmit,
}) {
  const router = useRouter();

  // Restricted: only payment_request_journal holders see / raise journal requests
  const journalAccess = getPageAccess({ pageCode: "payment_request_journal", pageType: "LIST" });
  const canRaiseJournal = !!(journalAccess.allowed && journalAccess.canAdd);
  const brrAccess = getPageAccess({ pageCode: "payment_request", pageType: "LIST" });
  const canRaiseBrr = !!(brrAccess.allowed && brrAccess.canAdd);

  const [loading, setLoading]         = useState(false);
  const [isEditing, setIsEditing]     = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [initialData, setInitialData] = useState(null);

  const [ledgerList, setLedgerList]     = useState([]);
  const [eligibleBrrs, setEligibleBrrs]         = useState([]);
  const [eligibleJournals, setEligibleJournals] = useState([]);
  const [summary, setSummary]   = useState(null);   // selected source: bill / requested / balance
  const [siblings, setSiblings] = useState([]);     // other requests on same source
  const [advanceVendors, setAdvanceVendors] = useState([]);
  const [advance, setAdvance]   = useState(null);   // saved ADVANCE request: payments + adjustments
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const paymentAccess = getPageAccess({ pageCode: "payment", pageType: "ADD" });

  const [attachedFile, setAttachedFile]       = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl, setInitialFileUrl]   = useState("");
  const [fileResetKey, setFileResetKey]       = useState(0);

  const projectCode = getLocalStorage("projectInfo")?.projectCode;

  const form = useForm({ resolver: zodResolver(schema), defaultValues, mode: "onChange" });
  const { register, control, setValue, watch, getValues, handleSubmit, reset,
    formState: { errors, isSubmitting } } = form;

  const disabled = mode === "view" || mode === "approver" || !isEditing || isSubmitted || isSubmitting;
  // Source (BRR / Journal + vendor) is fixed once the request is saved
  const brrLocked = disabled || mode !== "create";

  const sourceType      = watch("sourceType");
  const isJournal       = sourceType === "JOURNAL";
  const isAdvance       = sourceType === "ADVANCE";
  const vendorId        = watch("vendorId");
  const brrId           = watch("brrId");
  const requestedAmount = watch("requestedAmount");
  const deductionAmount = watch("deductionAmount");

  const requested  = Number(requestedAmount) || 0;
  const deduction  = Number(deductionAmount) || 0;
  const netPayable = requested - deduction;
  // an unlinked advance has no bill → no ceiling here
  const balance    = summary && !isAdvance ? Number(summary.balanceAmount) || 0 : null;
  const exceedsBalance = balance !== null && requested > balance;

  // Load vendor ledgers
  useEffect(() => {
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_LEDGER}?type=creditor`, method: "GET" })
      .then((res) => setLedgerList(res.data || []))
      .catch(() => toast.error("Failed to load vendor list"));
  }, []);

  // Advance: only sundry creditors connected with this project
  useEffect(() => {
    if (!isAdvance || !projectCode || mode !== "create") return;
    apiRequest({ url: `${EP.ADVANCE_VENDORS}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => setAdvanceVendors((res.data || []).map((v) => ({ ...v, ledgerId: v.vendorId }))))
      .catch(() => toast.error("Failed to load project vendors"));
  }, [isAdvance, projectCode, mode]);

  // Opened from a journal (?journalId=), or user may only raise journal requests → Journal mode
  useEffect(() => {
    if (mode === "create" && canRaiseJournal && (presetJournalId || !canRaiseBrr)) setValue("sourceType", "JOURNAL");
  }, [mode, presetJournalId, canRaiseJournal, canRaiseBrr, setValue]);

  // Load eligible journals (create mode, journal source) — approved, one row per journal + vendor
  useEffect(() => {
    if (mode !== "create" || !projectCode || !isJournal || !canRaiseJournal) return;
    const params = new URLSearchParams({ projectCode });
    if (vendorId) params.set("vendorId", vendorId);
    apiRequest({ url: `${EP.ELIGIBLE_JOURNALS}?${params}`, method: "GET" })
      .then((res) => {
        const list = res.data || [];
        setEligibleJournals(list);
        if (presetJournalId && !getValues("journalKey")) {
          const hits = list.filter((j) => String(j.journalId) === String(presetJournalId));
          const hit = presetVendorId
            ? hits.find((j) => String(j.vendorId) === String(presetVendorId))
            : hits.length === 1 ? hits[0] : null;
          if (hit) {
            setValue("journalKey", `${hit.journalId}:${hit.vendorId}`, { shouldValidate: true });
            setValue("vendorId", String(hit.vendorId));
            setSummary(hit);
          } else if (!hits.length) {
            toast.error("This journal is not approved or has no vendor balance left for payment request");
          } else {
            toast.info("This journal has more than one vendor — select the vendor's line");
          }
        }
      })
      .catch((err) => toast.error(err.message || "Failed to load journal list"));
  }, [mode, projectCode, isJournal, canRaiseJournal, vendorId]);

  // Load eligible BRRs (create mode only) — approved BRRs with balance > 0
  useEffect(() => {
    if (mode !== "create" || !projectCode || isJournal || isAdvance) return;
    const params = new URLSearchParams({ projectCode });
    if (vendorId) params.set("vendorId", vendorId);
    apiRequest({ url: `${EP.ELIGIBLE_BRRS}?${params}`, method: "GET" })
      .then((res) => {
        const list = res.data || [];
        setEligibleBrrs(list);
        // Pre-select from ?brrId= (e.g. opened from BRR detail page)
        if (presetBrrId && !getValues("brrId")) {
          const hit = list.find((b) => String(b.brrId) === String(presetBrrId));
          if (hit) {
            setValue("brrId", String(hit.brrId), { shouldValidate: true });
            setValue("vendorId", hit.vendorId ? String(hit.vendorId) : "");
            setSummary(hit);
          } else {
            toast.error("This BRR is not approved or has no balance left for payment request");
          }
        }
      })
      .catch(() => toast.error("Failed to load BRR list"));
  }, [mode, projectCode, vendorId, isJournal, isAdvance]);

  // Load existing request in edit / view / approver mode
  useEffect(() => {
    if (mode === "create" || !prId) return;
    const fetchPR = async () => {
      setLoading(true);
      try {
        const res = await apiRequest({ url: `${EP.DETAILS}/${prId}`, method: "GET" });
        const d = res.data;
        const data = {
          prNo:             d.prNo || "",
          prDate:           d.prDate || "",
          vendorId:         d.vendorId ? String(d.vendorId) : "",
          sourceType:       d.sourceType || "BRR",
          brrId:            d.brrId ? String(d.brrId) : "",
          journalKey:       d.journalId ? `${d.journalId}:${d.vendorId}` : "",
          requestedAmount:  Number(d.requestedAmount || 0),
          deductionAmount:  Number(d.deductionAmount || 0),
          deductionRemarks: d.deductionRemarks || "",
          paymentMode:      d.paymentMode || "",
          requiredByDate:   d.requiredByDate || "",
          remarks:          d.remarks || "",
        };
        reset(data);
        setInitialData(data);
        setSummary(d.sourceSummary || d.brrSummary || null);
        setSiblings(d.siblingRequests || []);
        setAdvance(d.sourceType === "ADVANCE" ? {
          workflowStatus: d.workflowStatus,
          vendorId:       d.vendorId,
          partyName:      d.partyName,
          requested:      Number(d.requestedAmount || 0),
          netPayable:     Number(d.netPayable || 0),
          paid:           Number(d.advancePaid || 0),
          inProgress:     Number(d.advanceInProgress || 0),
          balance:        Number(d.advanceBalance || 0),
          payments:       d.advancePayments || [],
          adjusted:       Number(d.advanceAdjusted || 0),
          outstanding:    Number(d.advanceOutstanding || 0),
          adjustType:     d.adjustType || null,
          adjustedBills:  d.adjustedBills || [],
          adjustments:    d.adjustments || [],
        } : null);
        if (d.attachedDoc) {
          setExistingFileUrl(d.attachedDoc);
          setInitialFileUrl(d.attachedDoc);
        }
        onDataLoaded?.({ workflowStatus: d.workflowStatus || "", uuid: d.uuid || "", brrId: d.brrId });

        const st = (d.workflowStatus || "").toLowerCase();
        if (["draft", "reback"].includes(st)) {
          setIsEditing(false);
          setAllowSubmit(true);
        } else {
          setIsSubmitted(true);
          setIsEditing(false);
          setAllowSubmit(false);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Payment Request");
      } finally {
        setLoading(false);
      }
    };
    fetchPR();
  }, [prId, mode, reset, reloadKey]);

  const brrOptions = useMemo(
    () => eligibleBrrs.map((b) => ({
      ...b,
      // BRR No · Party Bill No · BRB No · Party · Balance
      label: [
        b.brrNo,
        `Bill: ${b.partyBillNo || "-"}`,
        `BRB: ${b.brbNo || "-"}`,
        b.partyName || "-",
        `Bal ₹${formatAmount(b.balanceAmount)}`,
      ].join(" · "),
    })),
    [eligibleBrrs],
  );

  const journalOptions = useMemo(
    () => eligibleJournals.map((j) => ({
      ...j,
      key: `${j.journalId}:${j.vendorId}`,
      // Voucher No · Date · Vendor · Remarks · Balance
      label: [
        j.voucherNo,
        j.entryDate || "-",
        j.partyName || "-",
        j.journalRemarks ? j.journalRemarks.slice(0, 40) : null,
        `Bal ₹${formatAmount(j.balanceAmount)}`,
      ].filter(Boolean).join(" · "),
    })),
    [eligibleJournals],
  );

  const handleJournalChange = (key) => {
    const hit = journalOptions.find((j) => j.key === key);
    setSummary(hit || null);
    if (hit?.vendorId) setValue("vendorId", String(hit.vendorId));
  };

  const handleSourceChange = (val) => {
    setValue("sourceType", val, { shouldValidate: true });
    setValue("brrId", "");
    setValue("journalKey", "");
    setValue("vendorId", "");
    setSummary(null);
  };

  const handleBrrChange = (val) => {
    const hit = eligibleBrrs.find((b) => String(b.brrId) === String(val));
    setSummary(hit || null);
    if (hit?.vendorId && !getValues("vendorId")) setValue("vendorId", String(hit.vendorId));
  };

  // Build FormData payload
  const buildFormData = () => {
    const v = getValues();
    const fd = new FormData();
    fd.append("projectCode", projectCode);
    fd.append("sourceType", v.sourceType);
    if (v.sourceType === "JOURNAL") {
      const [journalId, jVendorId] = (v.journalKey || "").split(":");
      fd.append("journalId", journalId);
      fd.append("vendorId", jVendorId);
    } else if (v.sourceType === "ADVANCE") {
      fd.append("vendorId", v.vendorId);
    } else {
      fd.append("brrId", v.brrId);
    }
    // getValues() is raw form state (AmountInput keeps the typed string) — coerce here
    fd.append("requestedAmount", String(Number(v.requestedAmount) || 0));
    fd.append("deductionAmount", String(Number(v.deductionAmount) || 0));
    fd.append("deductionRemarks", v.deductionRemarks || "");
    fd.append("paymentMode", v.paymentMode || "");
    fd.append("requiredByDate", v.requiredByDate || "");
    fd.append("remarks", v.remarks || "");
    if (attachedFile) fd.append("attachedDoc", attachedFile);
    else if (mode === "edit" && !existingFileUrl) fd.append("clearAttachedDoc", "true");
    return fd;
  };

  // Save draft (create / edit)
  const handleSaveDraft = async () => {
    if (exceedsBalance) {
      toast.error(
        `Requested ₹${formatAmount(requested)} exceeds ${isJournal ? "journal" : "BRR"} balance ₹${formatAmount(balance)}. Please reduce the amount.`
      );
      return;
    }
    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating Payment Request…" : "Updating Payment Request…");
      const res = await apiRequest({
        url: mode === "create" ? EP.CREATE : `${EP.EDIT}/${prId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildFormData(),
      });
      if (res?.data?.prNo) setValue("prNo", res.data.prNo);
      setInitialData(getValues());
      {
        const url = res?.data?.attachedDoc ?? existingFileUrl;
        setExistingFileUrl(url);
        setInitialFileUrl(url);
      }
      setAttachedFile(null);
      setFileResetKey((k) => k + 1);
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved", { id: toastId });
      if (mode === "create" && res.data?.id) {
        setTimeout(() => router.push(`${BASE_PATH}/${res.data.id}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    }
  };

  // Submit for approval
  const onSubmit = async () => {
    let toastId;
    try {
      toastId = toast.loading("Submitting Payment Request…");
      await apiRequest({ url: `${EP.SUBMIT}/${prId}`, method: "POST" });
      toast.success("Payment Request submitted", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    }
  };

  // Edit / cancel
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setAttachedFile(null);
      setExistingFileUrl(initialFileUrl);
      setFileResetKey((k) => k + 1);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <EdoxMark size={32} />
      </div>
    );
  }

  return (
    <>
      <div className="p-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-[3px]">

            {/* Request info */}
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label="Payment Request No">
                <Input {...register("prNo")} disabled placeholder="[Auto]"
                  className={`${getInputClass(false, true)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="Request Date">
                <Input {...register("prDate")} disabled placeholder="[Auto]"
                  className={`${getInputClass(false, true)} w-full h-[34px]`} />
              </FieldRow>
            </div>

            {/* Source selection */}
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label="Request Against" required>
                <Select value={sourceType} onValueChange={handleSourceChange} disabled={brrLocked}>
                  <SelectTrigger className={`${getInputClass(false, brrLocked)} w-full h-[36px]`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(canRaiseBrr || !isJournal || mode !== "create") && (
                      <SelectItem value="BRR">BRR (Bill Receive Register)</SelectItem>
                    )}
                    {(canRaiseJournal || isJournal) && <SelectItem value="JOURNAL">Journal Entry</SelectItem>}
                    {(canRaiseBrr || isAdvance) && <SelectItem value="ADVANCE">Advance (no bill yet)</SelectItem>}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Party Name" required={isAdvance}>
                <Controller control={control} name="vendorId" render={({ field }) => (
                  <SearchableSelect
                    options={isAdvance && mode === "create" ? advanceVendors : ledgerList}
                    value={field.value ? String(field.value) : ""}
                    onChange={(val) => {
                      field.onChange(val ? String(val) : "");
                      // vendor filter changed → clear source selection
                      setValue("brrId", "");
                      setValue("journalKey", "");
                      setSummary(null);
                    }}
                    disabled={brrLocked}
                    placeholder={isAdvance
                      ? (advanceVendors.length ? "Select Vendor (sundry creditor of this project)" : "No creditor connected with this project")
                      : `Filter ${isJournal ? "Journal" : "BRR"} by Vendor (optional)`}
                    labelKey="ledgerName"
                    valueKey="ledgerId"
                    searchKeys={["ledgerName", "ledgerCode"]}
                    className={errors.vendorId ? "border-red-500" : ""}
                  />
                )} />
              </FieldRow>
              {isAdvance ? (
                <>
                  <FieldRow label="Adjusted Against">
                    <ReadOnly value={
                      mode === "create" ? "Adjust against bills once paid"
                        : advance?.adjustedBills?.length
                          ? `${advance.adjustType === "JOURNAL" ? "Journal" : "Bill"} ${advance.adjustedBills.join(", ")}`
                          : "Not adjusted yet"
                    } className={advance?.adjustedBills?.length ? "bg-green-50" : ""} />
                  </FieldRow>
                </>
              ) : isJournal ? (
                <>
                  <FieldRow label="Journal Voucher No" required>
                    {mode === "create" ? (
                      <Controller control={control} name="journalKey" render={({ field }) => (
                        <SearchableSelect
                          options={journalOptions}
                          value={field.value || ""}
                          onChange={(val) => {
                            field.onChange(val || "");
                            handleJournalChange(val);
                          }}
                          disabled={brrLocked}
                          placeholder={journalOptions.length ? "Select Approved Journal (vendor line)" : "No approved journal with balance"}
                          labelKey="label"
                          valueKey="key"
                          searchKeys={["voucherNo", "partyName", "journalRemarks"]}
                          className={errors.journalKey ? "border-red-500" : ""}
                        />
                      )} />
                    ) : (
                      <ReadOnly value={summary?.voucherNo || ""} />
                    )}
                  </FieldRow>
                  <FieldRow label="Journal Date">
                    <ReadOnly value={summary?.entryDate || ""} />
                  </FieldRow>
                  <FieldRow label="Vendor (Cr line)">
                    <ReadOnly value={summary?.partyName || ""} />
                  </FieldRow>
                  <FieldRow label="Entry Mode">
                    <ReadOnly value={summary?.entryMode ? summary.entryMode.replace(/_/g, " ") : ""} />
                  </FieldRow>
                  <FieldRow label="Journal Remarks">
                    <ReadOnly value={summary?.journalRemarks || ""} />
                  </FieldRow>
                </>
              ) : (
              <>
              <FieldRow label="BRR No" required>
                {mode === "create" ? (
                  <Controller control={control} name="brrId" render={({ field }) => (
                    <SearchableSelect
                      options={brrOptions}
                      value={field.value ? String(field.value) : ""}
                      onChange={(val) => {
                        field.onChange(val ? String(val) : "");
                        handleBrrChange(val);
                      }}
                      disabled={brrLocked}
                      placeholder={brrOptions.length ? "Select Approved BRR" : "No approved BRR with balance"}
                      labelKey="label"
                      valueKey="brrId"
                      searchKeys={["brrNo", "partyBillNo", "brbNo", "partyName"]}
                      className={errors.brrId ? "border-red-500" : ""}
                    />
                  )} />
                ) : (
                  <ReadOnly value={summary?.brrNo || ""} />
                )}
              </FieldRow>
              <FieldRow label="BRR Date">
                <ReadOnly value={summary?.brrDate || ""} />
              </FieldRow>
              <FieldRow label="Party (BRR)">
                <ReadOnly value={summary?.partyName || ""} />
              </FieldRow>
              <FieldRow label="Order Category">
                <ReadOnly value={summary?.orderCategory ? getFormatCategoryName(summary.orderCategory) : ""} />
              </FieldRow>
              <FieldRow label="Order No">
                <ReadOnly value={summary?.orderNo || ""} />
              </FieldRow>
              <FieldRow label="Party Bill No">
                <ReadOnly value={summary?.partyBillNo || ""} />
              </FieldRow>
              <FieldRow label="BRB No">
                <ReadOnly
                  value={summary ? (summary.brbNo ? `${summary.brbNo} (${(summary.brbStatus || "").replace(/_/g, " ")})` : "Not created") : ""}
                />
              </FieldRow>
              <FieldRow label="Party Bill Date">
                <ReadOnly value={summary?.partyDate || ""} />
              </FieldRow>
              </>
              )}
            </div>

            {/* Payment info */}
            <div className="flex flex-col gap-[2px]">
              <FieldRow label="Payment Mode">
                <Controller control={control} name="paymentMode" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger className={`${getInputClass(false, disabled)} w-full h-[36px]`}>
                      <SelectValue placeholder="Select Payment Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </FieldRow>
              <FieldRow label="Required By Date">
                <Input type="date" {...register("requiredByDate")} disabled={disabled}
                  className={`${getInputClass(errors.requiredByDate, disabled)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="Remarks">
                <Controller control={control} name="remarks" render={({ field }) => (
                  <ExpandableTextField
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                    title="Remarks"
                    placeholder="Remarks"
                    minHeight="min-h-[34px]"
                    modalHeight="min-h-[180px]"
                  />
                )} />
              </FieldRow>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-[3px]">

            {/* Advance: what has been paid from Account › Payment */}
            {isAdvance && mode !== "create" && advance && (
              <div className="flex flex-col gap-[2px] mb-3">
                <FieldRow label="Advance Paid">
                  <ReadOnly value={formatAmount(advance.paid)} />
                </FieldRow>
                <FieldRow label="Payment In Progress">
                  <ReadOnly value={formatAmount(advance.inProgress)} />
                </FieldRow>
                <FieldRow label="Balance To Pay">
                  <ReadOnly value={formatAmount(advance.balance)} className="bg-orange-50 font-semibold" />
                </FieldRow>
                <FieldRow label="Adjusted To Bills">
                  <ReadOnly value={formatAmount(advance.adjusted)} />
                </FieldRow>
                <FieldRow label="Outstanding Advance">
                  <ReadOnly value={formatAmount(advance.outstanding)} className="bg-purple-50 font-semibold" />
                </FieldRow>
              </div>
            )}

            {/* BRR / journal balance (not for an advance — it has no bill) */}
            {!isAdvance && (
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label={`Bill Amount${summary?.billSource === "BRB" ? " (BRB)" : summary?.billSource === "JOURNAL" ? " (Journal Cr)" : ""}`}>
                <ReadOnly value={summary ? formatAmount(summary.billAmount) : ""} />
              </FieldRow>
              <FieldRow label="Already Requested">
                <ReadOnly value={summary ? formatAmount(summary.requestedAmount) : ""} />
              </FieldRow>
              <FieldRow label="Balance Available">
                <ReadOnly
                  value={summary ? formatAmount(summary.balanceAmount) : ""}
                  className="bg-orange-50 font-semibold"
                />
              </FieldRow>
            </div>
            )}

            {/* Amounts */}
            <div className="flex flex-col gap-[2px] mb-4">
              <FieldRow label="Requested Amount" required>
                <div className="flex flex-col w-full gap-0.5">
                  <AmountInput
                    {...register("requestedAmount")}
                    value={requestedAmount}
                    disabled={disabled}
                    placeholder="0.00"
                    className={`${getInputClass(errors.requestedAmount || exceedsBalance, disabled)} w-full h-[34px]`}
                  />
                  {exceedsBalance && !disabled && (
                    <span className="text-[10px] text-red-600 px-1">
                      Exceeds balance ₹{formatAmount(balance)}
                    </span>
                  )}
                </div>
              </FieldRow>
              <FieldRow label="Deduction Amount">
                <AmountInput
                  {...register("deductionAmount")}
                  value={deductionAmount}
                  disabled={disabled}
                  placeholder="0.00"
                  className={`${getInputClass(errors.deductionAmount, disabled)} w-full h-[34px]`}
                />
              </FieldRow>
              <FieldRow label="Deduction Remarks">
                <Input {...register("deductionRemarks")} disabled={disabled}
                  placeholder="TDS / Retention / Advance adjustment"
                  className={`${getInputClass(false, disabled)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="Net Payable">
                <Input
                  value={formatAmount(netPayable)}
                  disabled
                  className={`${getInputClass(false, true)} w-full h-[34px] ${netPayable < 0 ? "bg-red-50 border-red-400" : "bg-orange-50"} font-semibold`}
                />
              </FieldRow>
            </div>

            {/* Attachment */}
            <FileUpload
              label="Attached Doc"
              onChange={(file) => setAttachedFile(file)}
              existingUrl={existingFileUrl}
              onClearExisting={() => setExistingFileUrl("")}
              disabled={disabled}
              resetKey={fileResetKey}
              accept={ACCEPT_DOC}
              allowedTypes={TYPES_DOC}
              showImagePreview
            />
          </div>
        </div>

        {/* Other requests raised on the same BRR (partial payments) */}
        {mode !== "create" && siblings.length > 0 && (
          <div className="mt-4">
            <div className="text-[12px] font-semibold text-gray-700 mb-1">
              Other Payment Requests on {isJournal ? `Journal ${summary?.voucherNo || ""} (${summary?.partyName || "-"})` : `BRR ${summary?.brrNo || ""}`}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#e8f4f7]">
                    {["PR No", "Date", "Type", "Requested", "Net Payable", "Status"].map((h) => (
                      <th key={h} className="border border-[#e6e4e4] px-2 py-1 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {siblings.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`${BASE_PATH}/${s.id}`)}>
                      <td className="border border-[#e6e4e4] px-2 py-1 text-blue-600">{s.prNo}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1">{s.prDate}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1">{s.sourceType === "ADVANCE" ? "Advance" : s.sourceType === "JOURNAL" ? "Journal" : "BRR"}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1 text-right">{formatAmount(s.requestedAmount)}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1 text-right">{formatAmount(s.netPayable)}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1">{(s.workflowStatus || "").replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Advance: payments made + link / pay actions (any mode, once Approved) */}
      {isAdvance && advance && advance.workflowStatus === "Approved" && (
        <div className="px-3">
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-[12px] font-semibold text-gray-700 mr-auto">Advance Payments</span>
            {advance.outstanding > 0 && (
              <button type="button" onClick={() => setAdjustOpen(true)}
                className="px-3 py-1.5 text-[12px] border border-purple-600 text-purple-700 rounded-sm hover:bg-purple-50">
                Adjust Against Bill
              </button>
            )}
            {advance.balance > 0 && paymentAccess.allowed && (
              <button type="button"
                onClick={() => router.push(`${ADVANCE_PAYMENT_PATH}?type=advance&prId=${prId}`)}
                className="px-3 py-1.5 text-[12px] bg-[#3b6ea5] text-white rounded-sm hover:bg-[#2f5a8e]">
                Make Advance Payment
              </button>
            )}
          </div>
          {advance.payments.length > 0 ? (
            <div className="overflow-x-auto mt-2">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#e8f4f7]">
                    {["Payment No", "Date", "Mode", "UTR / Voc. No", "Amount", "Status"].map((h) => (
                      <th key={h} className={`border border-[#e6e4e4] px-2 py-1 font-semibold ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advance.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/finance-management/account/payment/${p.id}`)}>
                      <td className="border border-[#e6e4e4] px-2 py-1 text-blue-600">{p.receiptNo}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1">{p.paymentDate}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1">{p.paymentMode || "—"}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1">{p.utrVoucherNo || "—"}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1 text-right">{formatAmount(p.amount)}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1">{(p.workflowStatus || "").replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-[11px] text-gray-400 italic mt-2">No payment made yet. Use “Make Advance Payment”.</div>
          )}

          <div className="flex items-center gap-2 mt-4 mb-1">
            <span className="text-[12px] font-semibold text-gray-700">Adjusted Against Bills</span>
            <span className="text-[11px] text-gray-500">
              Paid advance waits in the Vendor Advance Register until adjusted. One advance can go to many bills, in parts
              {advance.adjustType ? ` — this one goes to ${advance.adjustType === "JOURNAL" ? "journals" : "purchase bills"} only` : ""}.
            </span>
          </div>
          <AdvanceAdjustmentsTable adjustments={advance.adjustments} onChanged={() => setReloadKey((k) => k + 1)} />
        </div>
      )}

      <AdvanceAdjustModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onDone={() => { setAdjustOpen(false); setReloadKey((k) => k + 1); }}
        paymentRequestId={prId}
      />

      {/* Actions */}
      {mode !== "view" && mode !== "approver" && (
        <div className="flex justify-end gap-3 mt-4 px-3 pb-3">
          {((mode === "create" && isEditing) ||
            (mode === "edit" && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
            />
          )}
          <SaveButton
            onClick={() => handleSubmit(onSubmit)()}
            loading={isSubmitting}
            disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting}
            requireConfirmation
            confirmationTitle="Submit Payment Request?"
            confirmationMessage="Once submitted, this Payment Request will go for approval."
          >
            Submit
          </SaveButton>
          {mode === "edit" && !isSubmitted && (
            <EditButton onClick={handleEdit} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
          {mode === "edit" && !isEditing && (
            <DeleteRequestButton
              moduleCode="PAYMENT_REQUEST"
              recordId={Number(prId)}
              onDeleted={() => router.back()}
            />
          )}
        </div>
      )}
    </>
  );
}
