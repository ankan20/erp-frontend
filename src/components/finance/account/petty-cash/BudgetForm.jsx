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
import ApprovalActionModal  from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import SearchableSelect     from "@/components/common/SearchableSelect";
import AmountInput          from "@/components/common/AmountInput";
import PMSection            from "@/components/project-management/common/PMSection";
import PMFormRow            from "@/components/project-management/common/PMFormRow";
import PMInput              from "@/components/project-management/common/PMInput";
import PMSelect             from "@/components/project-management/common/PMSelect";
import PMTextarea           from "@/components/project-management/common/PMTextarea";
import { usePageActions }   from "@/components/common/PageActionButtons";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getInputClass }   from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";

const FREQUENCY_OPTIONS = [
  { value: "Weekly",    label: "Weekly"    },
  { value: "Monthly",   label: "Monthly"   },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Yearly",    label: "Yearly"    },
];

const WEEK_OPTIONS = ["W1", "W2", "W3", "W4", "W5"].map((w) => ({ value: w, label: w }));

const MONTH_OPTIONS = (() => {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const opts = [];
  for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
    months.forEach((m) => opts.push({ value: `${m}${String(y).slice(2)}`, label: `${m}${String(y).slice(2)}` }));
  }
  return opts;
})();

const LABEL_W = "sm:w-[160px] sm:min-w-[160px]";

const budgetSchema = z.object({
  budgetDate:      z.string().min(1, "Budget date required"),
  budgetFrequency: z.string().min(1, "Frequency required"),
  month:           z.string().optional(),
  weekMark:        z.string().optional(),
  fromDate:        z.string().min(1, "From date required"),
  toDate:          z.string().min(1, "To date required"),
  items: z.array(
    z.object({
      ccCode:       z.string().min(1, "CC Code required"),
      ccName:       z.string().optional(),
      description:  z.string().optional(),
      budgetAmount: z.coerce.number().gt(0, "Amount must be > 0"),
    }),
  ).min(1),
});

const defaultItem = { ccCode: "", ccName: "", description: "", budgetAmount: "" };

const defaultValues = {
  budgetDate:      "",
  budgetFrequency: "",
  month:           "",
  weekMark:        "",
  fromDate:        "",
  toDate:          "",
  items: [defaultItem],
};

export default function BudgetForm({ mode = "create", budgetId, canApprove = false }) {
  const isViewMode = mode === "view" || mode === "approver";
  const [isEditing,         setIsEditing]         = useState(mode === "create");
  const [initialData,       setInitialData]        = useState(null);
  const [ccOptions,         setCcOptions]          = useState([]);
  const [attachedFile,      setAttachedFile]       = useState(null);
  const [existingFileUrl,   setExistingFileUrl]    = useState("");
  const [initialFileUrl,    setInitialFileUrl]     = useState("");
  const [fileResetKey,      setFileResetKey]       = useState(0);
  const [isLoading,         setIsLoading]          = useState(mode !== "create");
  const [isSubmitted,       setIsSubmitted]        = useState(false);
  const [allowSubmit,       setAllowSubmit]        = useState(false);
  const [approvalOpen,      setApprovalOpen]       = useState(false);
  const [historyOpen,       setHistoryOpen]        = useState(false);
  const [isPendingApproval, setIsPendingApproval]  = useState(false);
  const [budgetNo,          setBudgetNo]           = useState("");
  const [sidebarOpen,       setSidebarOpen]        = useState(true);

  const router      = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const {
    register,
    control,
    reset,
    setValue,
    getValues,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(budgetSchema), defaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const disabled     = isViewMode || !isEditing || isSubmitting || isSubmitted;
  const frequency    = watch("budgetFrequency");
  const showMonth    = frequency === "Weekly" || frequency === "Monthly";
  const showWeekMark = frequency === "Weekly";

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE, method: "GET" })
      .then((res) => {
        setCcOptions(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === "create" || !budgetId) return;

    const load = async () => {
      try {
        setIsLoading(true);
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.GET_BY_ID}${budgetId}`,
          method: "GET",
        });
        const d = res.data;
        setBudgetNo(d.budgetNo || "");
        const formData = {
          budgetDate:      d.budgetDate      || "",
          budgetFrequency: d.budgetFrequency || "",
          month:           d.month           || "",
          weekMark:        d.weekMark        || "",
          fromDate:        d.fromDate        || "",
          toDate:          d.toDate          || "",
          items: (d.details || []).map((it) => ({
            ccCode:       it.ccCode            || "",
            ccName:       it.ccName            || "",
            description:  it.shortDescription  || "",
            budgetAmount: it.budgetAmount       || "",
          })),
        };
        reset(formData);
        setInitialData(formData);
        setExistingFileUrl(d.attachmentUrl || "");
        setInitialFileUrl(d.attachmentUrl  || "");

        const notEditable = ["Submitted", "Approved", "Rejected"].includes(d.workflowStatus)
          && d.workflowStatus !== "Reback";
        if (notEditable && mode === "edit") {
          setIsSubmitted(true);
          setIsEditing(false);
        } else {
          setIsEditing(false);
          setAllowSubmit(d.workflowStatus === "Draft" || d.workflowStatus === "Reback");
        }
      } catch (err) {
        toast.error(err.message || "Failed to load budget");
        setIsSubmitted(true);
      } finally {
        setIsLoading(false);
      }
    };

    load();

    if (canApprove) {
      apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.MY_APPROVAL_STATUS}${budgetId}`,
        method: "GET",
      })
        .then((res) => setIsPendingApproval(!!res.data?.isPending))
        .catch(() => {});
    }
  }, [budgetId, mode]);

  const buildPayload = () => {
    const v = getValues();
    const formData = new FormData();
    formData.append("projectCode",     projectCode);
    formData.append("budgetDate",      v.budgetDate);
    formData.append("budgetFrequency", v.budgetFrequency);
    formData.append("fromDate",        v.fromDate);
    formData.append("toDate",          v.toDate);
    formData.append("details", JSON.stringify(
      v.items.map((it, i) => ({
        slNo:             i + 1,
        ccCode:           it.ccCode,
        ccName:           it.ccName      || "",
        shortDescription: it.description || "",
        budgetAmount:     Number(it.budgetAmount),
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
          ? API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.CREATE
          : `${API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.UPDATE}${budgetId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });
      if (res?.data?.budgetNo) setBudgetNo(res.data.budgetNo);
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
        setTimeout(() => router.push(`/finance-management/account/petty-cash/budget/${res.data.id}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed", { id: tid });
    }
  };

  const handleSubmitBudget = async () => {
    let tid;
    try {
      tid = toast.loading("Submitting…");
      await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.SUBMIT}${budgetId}`,
        method: "POST",
      });
      toast.success("Budget submitted", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
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

  const handleApprovalAction = async ({ action, comments }) => {
    const ep = {
      approve: API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.APPROVE,
      reback:  API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.REBACK,
      reject:  API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.REJECT,
    }[action];
    if (!ep) return;
    let tid;
    try {
      tid = toast.loading("Processing…");
      await apiRequest({ url: `${ep}${budgetId}`, method: "POST", data: { comments } });
      toast.success("Action completed", { id: tid });
      setApprovalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Failed", { id: tid });
    }
  };

  const watchedItems  = watch("items") || [];
  const totalBudget   = watchedItems.reduce((s, it) => s + Number(it.budgetAmount || 0), 0);

  usePageActions({
    router,
    onTimeLine: budgetId ? () => setHistoryOpen(true) : undefined,
    onApprove:  canApprove && budgetId ? () => setApprovalOpen(true) : undefined,
    isPendingApproval,
  });

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
            <PMSection title="Budget Info">
              <PMFormRow label="Budget No" labelWidth={LABEL_W}>
                <PMInput value={budgetNo || "Auto"} disabled />
              </PMFormRow>

              <PMFormRow label="Budget Date" required labelWidth={LABEL_W}>
                <PMInput
                  type="date"
                  {...register("budgetDate")}
                  hasError={errors.budgetDate}
                  disabled={disabled}
                />
              </PMFormRow>

              <PMFormRow label="Budget Frequency" required labelWidth={LABEL_W}>
                <PMSelect
                  {...register("budgetFrequency")}
                  hasError={errors.budgetFrequency}
                  disabled={disabled}
                  placeholder="Select…"
                  options={FREQUENCY_OPTIONS}
                  onChange={(e) => {
                    setValue("budgetFrequency", e.target.value);
                    setValue("month",    "");
                    setValue("weekMark", "");
                  }}
                />
              </PMFormRow>

              {showMonth && (
                <PMFormRow label="Month" labelWidth={LABEL_W}>
                  <PMSelect
                    {...register("month")}
                    disabled={disabled}
                    placeholder="Select month…"
                    options={MONTH_OPTIONS}
                  />
                </PMFormRow>
              )}

              {showWeekMark && (
                <PMFormRow label="Week Mark" labelWidth={LABEL_W}>
                  <PMSelect
                    {...register("weekMark")}
                    disabled={disabled}
                    placeholder="Select week…"
                    options={WEEK_OPTIONS}
                  />
                </PMFormRow>
              )}

              <PMFormRow label="From Date" required labelWidth={LABEL_W}>
                <PMInput
                  type="date"
                  {...register("fromDate")}
                  hasError={errors.fromDate}
                  disabled={disabled}
                />
              </PMFormRow>

              <PMFormRow label="To Date" required labelWidth={LABEL_W}>
                <PMInput
                  type="date"
                  {...register("toDate")}
                  hasError={errors.toDate}
                  disabled={disabled}
                />
              </PMFormRow>
            </PMSection>

            <FileUpload
              label="Attachment"
              onChange={(file) => setAttachedFile(file)}
              existingUrl={existingFileUrl}
              onClearExisting={() => setExistingFileUrl("")}
              disabled={disabled}
              resetKey={fileResetKey}
              accept={ACCEPT_ALL}
              allowedTypes={TYPES_ALL}
            />
          </div>

          {/* ── RIGHT PANEL — Budget Details ─────────────── */}
          <div className="flex-1 min-w-0 mt-4 lg:mt-0">
            <div className="border border-[#b5b5b5]">
              <div className="bg-[#d6e6f2] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[16px]">
                Budget Details
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm min-w-[560px]">
                  <thead className="bg-[#144664]">
                    <tr>
                      <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[44px]">SL no</th>
                      <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[80px]">CC Code</th>
                      <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-left">CC Name &amp; Short Description for Expenses</th>
                      <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-right w-[130px]">Budget Amount</th>
                      {isEditing && <th className="border border-[#2e5a72] px-2 py-1 w-[40px]" />}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => (
                      <tr key={field.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f7f7f7]"}>
                        {/* SL */}
                        <td className="border border-[#d0d0d0] px-2 py-1 text-center text-gray-500">{index + 1}</td>

                        {/* CC Code — read-only, auto-fills when CC Name is selected */}
                        <td className="border border-[#d0d0d0] px-2 py-1 text-[12px] font-medium text-gray-700 bg-[#f0f6fb] align-middle text-center">
                          {watch(`items.${index}.ccCode`) || (
                            <span className="text-gray-300 italic text-[11px]">auto</span>
                          )}
                        </td>

                        {/* CC Name (SearchableSelect) + Description combined */}
                        <td className="border border-[#d0d0d0] p-0 align-top">
                          <div className="flex flex-col">
                            {/* CC Name — user selects here; CC Code auto-fills */}
                            <SearchableSelect
                              options={ccOptions}
                              value={watch(`items.${index}.ccCode`)}
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
                                  placeholder="Short description for expenses…"
                                  title="Description"
                                  rows={2}
                                />
                              )}
                            />
                          </div>
                        </td>

                        {/* Budget Amount — AmountInput */}
                        <td className="border border-[#d0d0d0] p-0">
                          <Controller
                            control={control}
                            name={`items.${index}.budgetAmount`}
                            render={({ field: f }) => (
                              <AmountInput
                                {...f}
                                disabled={disabled}
                                className={getInputClass(errors?.items?.[index]?.budgetAmount, disabled)}
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
                    ))}

                    {/* Total row */}
                    <tr className="bg-[#d6e6f2] font-semibold">
                      <td colSpan={3} className="border border-[#b5b5b5] px-2 py-1 text-right text-sm">TOTAL=</td>
                      <td className="border border-[#b5b5b5] px-2 py-1 text-right text-sm font-bold">
                        {totalBudget > 0 ? formatAmount(totalBudget) : "—"}
                      </td>
                      {isEditing && <td className="border border-[#b5b5b5]" />}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {isEditing && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => append({ ...defaultItem })}
                  className="px-4 py-1 bg-[#9fc5e8] border border-[#6d9dc5] rounded-sm text-sm font-medium hover:brightness-95 cursor-pointer"
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
              onClick={() => handleSubmit(handleSubmitBudget)()}
              loading={isSubmitting}
              disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
              requireConfirmation
              confirmationTitle="Submit Budget?"
              confirmationMessage="Once submitted, this budget will be sent for approval."
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

      {approvalOpen && (
        <ApprovalActionModal
          open={approvalOpen}
          onClose={() => setApprovalOpen(false)}
          onAction={handleApprovalAction}
        />
      )}

      {historyOpen && (
        <HistoryTimelineSheet
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          fetchUrl={`${API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.HISTORY}${budgetId}`}
        />
      )}
    </>
  );
}
