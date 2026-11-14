"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Controller } from "react-hook-form";
import { Loader2 } from "lucide-react";
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
import { zodDate } from "@/lib/dateUtils";

const EP = API_ENDPOINTS.RESOURCE.PAYMENT_REQUEST;
const BASE_PATH = "/resource-management/sub-contractor-billing/payment-request";

const PAYMENT_MODES = ["Bank", "Cash"];

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
    brrId:            z.string().min(1, "BRR No is required"),
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
  });

const defaultValues = {
  prNo:             "",
  prDate:           "",
  vendorId:         "",
  brrId:            "",
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
export default function PaymentRequestForm({ mode = "create", prId, presetBrrId, onDataLoaded, onAfterSubmit }) {
  const router = useRouter();

  const [loading, setLoading]         = useState(false);
  const [isEditing, setIsEditing]     = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [initialData, setInitialData] = useState(null);

  const [ledgerList, setLedgerList]     = useState([]);
  const [eligibleBrrs, setEligibleBrrs] = useState([]);
  const [summary, setSummary]           = useState(null);   // selected BRR: bill / requested / balance
  const [siblings, setSiblings]         = useState([]);     // other requests on same BRR

  const [attachedFile, setAttachedFile]       = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl, setInitialFileUrl]   = useState("");
  const [fileResetKey, setFileResetKey]       = useState(0);

  const projectCode = getLocalStorage("projectInfo")?.projectCode;

  const form = useForm({ resolver: zodResolver(schema), defaultValues, mode: "onChange" });
  const { register, control, setValue, watch, getValues, handleSubmit, reset,
    formState: { errors, isSubmitting } } = form;

  const disabled = mode === "view" || mode === "approver" || !isEditing || isSubmitted || isSubmitting;
  // BRR is fixed once the request is saved
  const brrLocked = disabled || mode !== "create";

  const vendorId        = watch("vendorId");
  const brrId           = watch("brrId");
  const requestedAmount = watch("requestedAmount");
  const deductionAmount = watch("deductionAmount");

  const requested  = Number(requestedAmount) || 0;
  const deduction  = Number(deductionAmount) || 0;
  const netPayable = requested - deduction;
  const balance    = summary ? Number(summary.balanceAmount) || 0 : null;
  const exceedsBalance = balance !== null && requested > balance;

  // Load vendor ledgers
  useEffect(() => {
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_LEDGER}?type=creditor`, method: "GET" })
      .then((res) => setLedgerList(res.data || []))
      .catch(() => toast.error("Failed to load vendor list"));
  }, []);

  // Load eligible BRRs (create mode only) — approved BRRs with balance > 0
  useEffect(() => {
    if (mode !== "create" || !projectCode) return;
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
  }, [mode, projectCode, vendorId]);

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
          brrId:            d.brrId ? String(d.brrId) : "",
          requestedAmount:  Number(d.requestedAmount || 0),
          deductionAmount:  Number(d.deductionAmount || 0),
          deductionRemarks: d.deductionRemarks || "",
          paymentMode:      d.paymentMode || "",
          requiredByDate:   d.requiredByDate || "",
          remarks:          d.remarks || "",
        };
        reset(data);
        setInitialData(data);
        setSummary(d.brrSummary || null);
        setSiblings(d.siblingRequests || []);
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
  }, [prId, mode, reset]);

  const brrOptions = useMemo(
    () => eligibleBrrs.map((b) => ({
      ...b,
      label: `${b.brrNo} — ${b.partyName || "-"} (Bal ₹${formatAmount(b.balanceAmount)})`,
    })),
    [eligibleBrrs],
  );

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
    fd.append("brrId", v.brrId);
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
        `Requested ₹${formatAmount(requested)} exceeds BRR balance ₹${formatAmount(balance)}. Please reduce the amount.`
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
        <Loader2 className="w-6 h-6 animate-spin" />
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

            {/* BRR selection */}
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label="Party Name">
                <Controller control={control} name="vendorId" render={({ field }) => (
                  <SearchableSelect
                    options={ledgerList}
                    value={field.value ? String(field.value) : ""}
                    onChange={(val) => {
                      field.onChange(val ? String(val) : "");
                      // vendor filter changed → clear BRR selection
                      setValue("brrId", "");
                      setSummary(null);
                    }}
                    disabled={brrLocked}
                    placeholder="Filter BRR by Vendor (optional)"
                    labelKey="ledgerName"
                    valueKey="ledgerId"
                    searchKeys={["ledgerName"]}
                  />
                )} />
              </FieldRow>
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
                      searchKeys={["brrNo", "partyName", "partyBillNo"]}
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
              <FieldRow label="Party Bill Date">
                <ReadOnly value={summary?.partyDate || ""} />
              </FieldRow>
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

            {/* BRR balance */}
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label={`Bill Amount${summary?.billSource === "BRB" ? " (BRB)" : ""}`}>
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
              Other Payment Requests on BRR {summary?.brrNo}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#e8f4f7]">
                    {["PR No", "Date", "Requested", "Net Payable", "Status"].map((h) => (
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
