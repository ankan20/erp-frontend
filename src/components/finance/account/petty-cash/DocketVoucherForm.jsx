"use client";

import { useEffect, useState }        from "react";
import { Controller }                  from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { useFieldArray }               from "react-hook-form";
import { z }                           from "zod";
import { zodResolver }                 from "@hookform/resolvers/zod";
import { toast }                       from "sonner";
import { Loader2, Trash2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter }                   from "next/navigation";

import SaveButton           from "@/components/common/SaveButton";
import EditButton           from "@/components/common/EditButton";
import SaveDraftButton      from "@/components/common/SaveDraftButton";
import FileUpload, { ACCEPT_ALL, TYPES_ALL } from "@/components/common/FileUpload";
import SearchableSelect     from "@/components/common/SearchableSelect";
import AmountInput          from "@/components/common/AmountInput";
import PMSection            from "@/components/project-management/common/PMSection";
import PMFormRow            from "@/components/project-management/common/PMFormRow";
import PMInput              from "@/components/project-management/common/PMInput";
import PMSelect             from "@/components/project-management/common/PMSelect";
import PMTextarea           from "@/components/project-management/common/PMTextarea";
import PMDateInput          from "@/components/project-management/common/PMDateInput";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getInputClass }   from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";

const PAYMENT_MODE_OPTIONS = [
  { value: "Cash",     label: "Cash"     },
  { value: "Bank/UPI", label: "Bank/UPI" },
];

const FUND_SOURCE_OPTIONS = [
  { value: "Cash",     label: "Cash"     },
  { value: "Bank/UPI", label: "Bank/UPI" },
];

const LABEL_W = "sm:w-[160px] sm:min-w-[160px]";

const docketSchema = z.object({
  voucherDate:   z.string().min(1, "Voucher date required"),
  budgetId:      z.coerce.number().nullable().optional(),
  expensesBy:    z.string().min(1, "Expenses by required"),
  modeOfPayment: z.string().min(1, "Payment mode required"),
  fundSource:    z.string().min(1, "Fund source required"),
  paymentRefId:  z.string().optional(),
  items: z.array(
    z.object({
      ccCode:      z.string().min(1, "CC Code required"),
      ccName:      z.string().optional(),
      description: z.string().optional(),
      amount:      z.coerce.number().gt(0, "Amount must be > 0"),
    }),
  ).min(1),
});

const defaultItem    = { ccCode: "", ccName: "", description: "", amount: "" };
const defaultValues  = {
  voucherDate:   "",
  budgetId:      null,
  expensesBy:    "",
  modeOfPayment: "",
  fundSource:    "",
  paymentRefId:  "",
  items: [defaultItem],
};

export default function DocketVoucherForm({ mode = "create", voucherId, canApprove = false, onUuid, onAfterSubmit }) {
  const isViewMode = mode === "view" || mode === "approver";

  const [isEditing,         setIsEditing]         = useState(mode === "create");
  const [initialData,       setInitialData]        = useState(null);
  const [ccOptions,         setCcOptions]          = useState([]);
  const [budgetOptions,     setBudgetOptions]      = useState([]);
  const [attachedFile,      setAttachedFile]       = useState(null);
  const [existingFileUrl,   setExistingFileUrl]    = useState("");
  const [initialFileUrl,    setInitialFileUrl]     = useState("");
  const [fileResetKey,      setFileResetKey]       = useState(0);
  const [isLoading,         setIsLoading]          = useState(mode !== "create");
  const [isSubmitted,       setIsSubmitted]        = useState(false);
  const [allowSubmit,       setAllowSubmit]        = useState(false);
  const [voucherNo,         setVoucherNo]          = useState("");
  const [sidebarOpen,       setSidebarOpen]        = useState(true);
  const [budgetRows,        setBudgetRows]         = useState([]);  // fetched rows with budgetAmount / remaining
  const [budgetMeta,        setBudgetMeta]         = useState(null); // { budgetNo, fromDate, toDate }

  const router      = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const {
    register, control, reset, setValue, getValues, watch, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(docketSchema), defaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const disabled      = isViewMode || !isEditing || isSubmitting || isSubmitted;
  const modeOfPayment = watch("modeOfPayment");
  const isCash        = modeOfPayment === "Cash";

  // Cash → only 1 row
  useEffect(() => {
    if (!isEditing || !isCash) return;
    if (fields.length > 1) {
      for (let i = fields.length - 1; i > 0; i--) remove(i);
      toast.info("Cash allows only 1 entry. Extra rows removed.");
    }
  }, [isCash]);

  // Load CC codes
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE, method: "GET" })
      .then((res) => setCcOptions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Load approved budgets for the Budget Ref select
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.LIST}?projectCode=${projectCode}&workflowStatus=Approved`,
      method: "GET",
    })
      .then((res) => setBudgetOptions(res.data?.list || res.data || []))
      .catch(() => {});
  }, [projectCode]);

  // Pre-fill items from a selected budget
  const handleBudgetSelect = async (budgetId) => {
    if (!budgetId) {
      setValue("budgetId", null);
      setBudgetRows([]);
      setBudgetMeta(null);
      return;
    }
    setValue("budgetId", Number(budgetId));
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.BUDGET_ROWS}${budgetId}`,
        method: "GET",
      });
      const data = res.data || {};
      const rows = data.rows || [];
      setBudgetRows(rows);
      setBudgetMeta({ budgetNo: data.budgetNo, fromDate: data.fromDate, toDate: data.toDate });
      if (rows.length === 0) return;
      const mapped = rows.map((r) => ({
        ccCode:      r.ccCode            || "",
        ccName:      r.ccName            || "",
        description: r.shortDescription  || "",
        amount:      "",
      }));
      setValue("items", mapped);
      toast.success("Budget rows pre-filled. Enter the actual amounts.");
    } catch (err) {
      toast.error(err.message || "Failed to fetch budget rows");
    }
  };

  // Load existing voucher
  useEffect(() => {
    if (mode === "create" || !voucherId) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.GET_BY_ID}${voucherId}`,
          method: "GET",
        });
        const d = res.data;
        setVoucherNo(d.voucherNo || "");
        if (d.voucherUuid) onUuid?.(d.voucherUuid);
        if (d.budgetId) {
          apiRequest({ url: `${API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.BUDGET_ROWS}${d.budgetId}`, method: "GET" })
            .then((br) => {
              setBudgetRows(br.data?.rows || []);
              setBudgetMeta({ budgetNo: br.data?.budgetNo, fromDate: br.data?.fromDate, toDate: br.data?.toDate });
            })
            .catch(() => {});
        }
        const formData = {
          voucherDate:   d.voucherDate   || "",
          budgetId:      d.budgetId      || null,
          expensesBy:    d.expensesBy    || "",
          modeOfPayment: d.modeOfPayment || "",
          fundSource:    d.fundSource    || "",
          paymentRefId:  d.paymentRefId  || "",
          items: (d.details || []).map((it) => ({
            ccCode:      it.ccCode           || "",
            ccName:      it.ccName           || "",
            description: it.shortDescription || "",
            amount:      it.amount           || "",
          })),
        };
        reset(formData);
        setInitialData(formData);
        setExistingFileUrl(d.attachmentUrl || d.attachment || "");
        setInitialFileUrl(d.attachmentUrl  || d.attachment || "");

        const notEditable = !["Draft", "Reback"].includes(d.workflowStatus);
        if (notEditable && mode === "edit") {
          setIsSubmitted(true);
          setIsEditing(false);
        } else {
          setIsEditing(false);
          setAllowSubmit(d.workflowStatus === "Draft" || d.workflowStatus === "Reback");
        }
      } catch (err) {
        toast.error(err.message || "Failed to load voucher");
        setIsSubmitted(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();

  }, [voucherId, mode]);

  const buildPayload = () => {
    const v = getValues();
    const formData = new FormData();
    formData.append("projectCode",   projectCode);
    formData.append("voucherDate",   v.voucherDate);
    if (v.budgetId) formData.append("budgetId", String(v.budgetId));
    formData.append("expensesBy",    v.expensesBy);
    formData.append("modeOfPayment", v.modeOfPayment);
    formData.append("fundSource",    v.fundSource);
    formData.append("paymentRefId",  v.paymentRefId || "");
    formData.append("details", JSON.stringify(
      v.items.map((it, i) => ({
        slNo:             i + 1,
        ccCode:           it.ccCode,
        ccName:           it.ccName      || "",
        shortDescription: it.description || "",
        amount:           Number(it.amount),
      }))
    ));
    if (attachedFile) formData.append("attachment", attachedFile);
    return formData;
  };

  const handleSaveDraft = async () => {
    if (!projectCode) { toast.error("No project selected"); return; }
    let tid;
    try {
      tid = toast.loading("Saving draft…");
      const res = await apiRequest({
        url: mode === "create"
          ? API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.CREATE
          : `${API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.UPDATE}${voucherId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });
      if (res?.data?.voucherNo) setVoucherNo(res.data.voucherNo);
      if (res?.data?.attachmentUrl) {
        setExistingFileUrl(res.data.attachmentUrl);
        setInitialFileUrl(res.data.attachmentUrl);
        setAttachedFile(null);
        setFileResetKey((k) => k + 1);
      }
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved", { id: tid });
      if (mode === "create" && res.data?.id) {
        setTimeout(() => router.push(`/finance-management/account/petty-cash/docket-voucher/${res.data.id}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed", { id: tid });
    }
  };

  const handleSubmitVoucher = async () => {
    let tid;
    try {
      tid = toast.loading("Submitting…");
      await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.SUBMIT}${voucherId}`,
        method: "POST",
      });
      toast.success("Voucher submitted", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed", { id: tid });
    }
  };

  const handleEdit = () => {
    if (isSubmitting || isViewMode) return;
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


  const watchedItems   = watch("items") || [];
  const totalAmount    = watchedItems.reduce((s, it) => s + Number(it.amount || 0), 0);

  // Per-CC budget helpers
  const budgetCcCodes = new Set(budgetRows.map((r) => r.ccCode));
  const getBudgetRow  = (ccCode) => budgetRows.find((r) => r.ccCode === ccCode) || null;
  const getCcUsed     = (ccCode) => watchedItems.reduce((s, it) => it.ccCode === ccCode ? s + Number(it.amount || 0) : s, 0);


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <>
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

          {/* ── LEFT PANEL ─────────────────────────────────── */}
          <div className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>
            <PMSection title="Voucher Docket Info">
              <PMFormRow label="Voucher No" labelWidth={LABEL_W}>
                <PMInput value={voucherNo || "Auto"} disabled />
              </PMFormRow>

              <PMFormRow label="Voucher Date" required labelWidth={LABEL_W}>
                <PMDateInput
                  {...register("voucherDate")}
                  hasError={errors.voucherDate}
                  disabled={disabled}
                />
              </PMFormRow>

              {/* Budget Ref — SearchableSelect from approved budget list */}
              <PMFormRow label="Budget Ref." labelWidth={LABEL_W}>
                <SearchableSelect
                  options={budgetOptions}
                  value={watch("budgetId") ? String(watch("budgetId")) : ""}
                  disabled={disabled}
                  onChange={(val) => handleBudgetSelect(val)}
                  placeholder="Select approved budget…"
                  labelKey="budgetNo"
                  valueKey="id"
                  searchKeys={["budgetNo"]}
                />
              </PMFormRow>

              <PMFormRow label="Expenses By" required labelWidth={LABEL_W}>
                <PMInput
                  {...register("expensesBy")}
                  placeholder="Name"
                  hasError={errors.expensesBy}
                  disabled={disabled}
                />
              </PMFormRow>

              <PMFormRow label="Mode of Payment" required labelWidth={LABEL_W}>
                <PMSelect
                  {...register("modeOfPayment")}
                  hasError={errors.modeOfPayment}
                  disabled={disabled}
                  placeholder="Select…"
                  options={PAYMENT_MODE_OPTIONS}
                />
              </PMFormRow>

              <PMFormRow label="Fund Source" required labelWidth={LABEL_W}>
                <PMSelect
                  {...register("fundSource")}
                  hasError={errors.fundSource}
                  disabled={disabled}
                  placeholder="Select…"
                  options={FUND_SOURCE_OPTIONS}
                />
              </PMFormRow>

              <PMFormRow label="Transaction Ref. ID" labelWidth={LABEL_W}>
                <PMInput
                  {...register("paymentRefId")}
                  placeholder="Transaction ID"
                  disabled={disabled}
                />
              </PMFormRow>
            </PMSection>

            <div className="pt-1">
              <FileUpload
                label="Attachment"
                onChange={(file) => setAttachedFile(file)}
                existingUrl={existingFileUrl}
                onClearExisting={() => setExistingFileUrl("")}
                disabled={disabled}
                resetKey={fileResetKey}
                accept={ACCEPT_ALL}
                allowedTypes={TYPES_ALL}
                showImagePreview
              />
            </div>
          </div>

          {/* ── RIGHT PANEL — Detail Table ───────────────── */}
          <div className="flex-1 min-w-0 mt-4 lg:mt-0">
            <div className="border border-[#b5b5b5]">
              <div className="bg-[#d6e6f2] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[16px]">
                Voucher Docket Details
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm min-w-[560px]">
                  <thead className="bg-[#144664]">
                    <tr>
                      <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[44px]">SL no</th>
                      <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[80px]">CC Code</th>
                      <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-left">CC Name &amp; Short Description for Expenses</th>
                      <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-right w-[120px]">Amount</th>
                      {isEditing && <th className="border border-[#2e5a72] px-2 py-1 w-[40px]" />}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const rowCcCode   = watch(`items.${index}.ccCode`);
                      const budgetRow   = budgetRows.length > 0 ? getBudgetRow(rowCcCode) : null;
                      const inBudget    = !!budgetRow;
                      const notInBudget = budgetRows.length > 0 && rowCcCode && !inBudget;
                      // rowAlloc = total allocated for this CC (budgetAmount, not remaining)
                      // rowUsed  = already committed in other vouchers + what user enters here
                      const rowAlloc    = budgetRow ? Number(budgetRow.budgetAmount ?? 0) : 0;
                      const rowUsed     = inBudget ? Number(budgetRow.usedAmount ?? 0) + getCcUsed(rowCcCode) : 0;
                      const rowRem      = rowAlloc - rowUsed;
                      return (
                      <tr key={field.id} className={`${index % 2 === 0 ? "bg-white" : "bg-[#f7f7f7]"} ${notInBudget ? "bg-orange-50" : ""}`}>
                        {/* SL */}
                        <td className="border border-[#d0d0d0] px-2 py-1 text-center text-gray-500">{index + 1}</td>

                        {/* CC Code — read-only, auto-fills when CC Name is selected */}
                        <td className="border border-[#d0d0d0] px-2 py-1 text-[12px] font-medium text-gray-700 bg-[#f0f6fb] align-middle text-center">
                          {rowCcCode || (
                            <span className="text-gray-300 italic text-[11px]">auto</span>
                          )}
                        </td>

                        {/* CC Name (SearchableSelect) + Description combined */}
                        <td className="border border-[#d0d0d0] p-0 align-top">
                          <div className="flex flex-col">
                            {/* CC Name — user selects here; CC Code auto-fills */}
                            <div className="relative">
                              <SearchableSelect
                                options={ccOptions}
                                value={rowCcCode}
                                disabled={disabled}
                                onChange={(val, item) => {
                                  setValue(`items.${index}.ccCode`, val || "");
                                  setValue(`items.${index}.ccName`, item?.ccName || "");
                                }}
                                placeholder="Select CC Name…"
                                labelKey="ccName"
                                valueKey="ccCode"
                                searchKeys={["ccName", "ccCode"]}
                              />
                              {notInBudget && (
                                <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-orange-600 bg-orange-100 border border-orange-300 rounded px-1.5 py-0.5 whitespace-nowrap pointer-events-none">
                                  Not in budget
                                </span>
                              )}
                            </div>
                            {/* Description — PMTextarea */}
                            <Controller
                              control={control}
                              name={`items.${index}.description`}
                              render={({ field: f }) => (
                                <PMTextarea
                                  value={f.value || ""}
                                  onChange={f.onChange}
                                  onBlur={f.onBlur}
                                  disabled={disabled}
                                  placeholder="Short description…"
                                  title="Description"
                                  rows={2}
                                />
                              )}
                            />
                            {inBudget && rowAlloc > 0 && (
                              <div className="px-2 py-0.5 border-t border-[#c8dff0] bg-[#f0f7fd] flex items-center gap-2 text-[10px]">
                                <span className="text-gray-500">Budget: <span className="font-semibold text-gray-700">{formatAmount(rowAlloc)}</span></span>
                                <span className="text-gray-300">|</span>
                                <span className="text-amber-500">Used: <span className="font-semibold text-amber-700">{formatAmount(rowUsed)}</span></span>
                                <span className="text-gray-300">|</span>
                                <span className={rowRem < 0 ? "text-red-500" : "text-green-600"}>Balance: <span className={`font-semibold ${rowRem < 0 ? "text-red-600" : "text-green-700"}`}>{formatAmount(rowRem)}</span></span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Amount — AmountInput */}
                        <td className="border border-[#d0d0d0] p-0">
                          <Controller
                            control={control}
                            name={`items.${index}.amount`}
                            render={({ field: f }) => (
                              <AmountInput
                                {...f}
                                disabled={disabled}
                                className={getInputClass(errors?.items?.[index]?.amount, disabled)}
                                placeholder="0.00"
                              />
                            )}
                          />
                        </td>

                        {/* Delete */}
                        {isEditing && (
                          <td className="border border-[#d0d0d0] px-2 py-1 text-center">
                            <button
                              type="button"
                              disabled={fields.length === 1}
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );})}

                    {/* Total row */}
                    <tr className="bg-[#d6e6f2] font-semibold">
                      <td colSpan={3} className="border border-[#b5b5b5] px-2 py-1 text-right text-sm">TOTAL=</td>
                      <td className="border border-[#b5b5b5] px-2 py-1 text-right text-sm font-bold">
                        {totalAmount > 0 ? formatAmount(totalAmount) : "—"}
                      </td>
                      {isEditing && <td className="border border-[#b5b5b5]" />}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {isEditing && (
              <div className="mt-3 flex justify-end items-center gap-2">
                {isCash && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    Cash: only 1 entry allowed
                  </span>
                )}
                <button
                  type="button"
                  disabled={isCash}
                  onClick={() => append({ ...defaultItem })}
                  className="px-4 py-1 bg-[#9fc5e8] border border-[#6d9dc5] rounded-sm text-sm font-medium hover:brightness-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add Row
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!isViewMode && (
          <div className="flex justify-end gap-3 mt-6">
            {isEditing && (
              <SaveDraftButton
                onClick={() => handleSubmit(handleSaveDraft)()}
                loading={isSubmitting}
                disabled={isSubmitting}
                requireConfirmation
              />
            )}

            <SaveButton
              onClick={() => handleSubmit(handleSubmitVoucher)()}
              loading={isSubmitting}
              disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
              requireConfirmation
              confirmationTitle="Submit Voucher?"
              confirmationMessage="Once submitted, this voucher docket will be sent for approval."
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

    </>
  );
}
