"use client";

import { useEffect, useState, useCallback } from "react";
import { useFieldArray, Controller } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton         from "@/components/common/SaveButton";
import SaveDraftButton    from "@/components/common/SaveDraftButton";
import EditButton         from "@/components/common/EditButton";
import SearchableSelect   from "@/components/common/SearchableSelect";
import FileUploadInput    from "@/components/project-management/common/FileUploadInput";
import PMSection          from "@/components/project-management/common/PMSection";
import PMFormRow          from "@/components/project-management/common/PMFormRow";
import PMInput            from "@/components/project-management/common/PMInput";
import PMDateInput        from "@/components/project-management/common/PMDateInput";
import PMTextarea         from "@/components/project-management/common/PMTextarea";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass }   from "@/lib/formStyles";

// ── SCHEMA ────────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  itemDisplayCode: z.string().optional(),
  itemCode:        z.string().optional(),
  itemName:        z.string().optional(),
  itemDescription: z.string().optional(),
  unit:            z.string().optional(),
  claimQty:        z.coerce.number().min(0).optional(),
  rate:            z.coerce.number().min(0).optional(),
});

const schema = z.object({
  orderNo:              z.string().min(1, "Order No is required"),
  orderDate:            z.string().min(1, "Order Date is required"),
  orderTitle:           z.string().min(1, "Order Title is required"),
  jobLocation:          z.string().min(1, "Job Location is required"),
  preCertifiedAmount:   z.coerce.number().min(0).optional(),
  items:                z.array(itemSchema).min(1),
});

const DEFAULT_ITEM = {
  itemDisplayCode: "",
  itemCode:        "",
  itemName:        "",
  itemDescription: "",
  unit:            "",
  claimQty:        "",
  rate:            "",
};

const defaultValues = {
  orderNo:            "",
  orderDate:          "",
  orderTitle:         "",
  jobLocation:        "",
  preCertifiedAmount: "",
  items:              [{ ...DEFAULT_ITEM }],
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = (val) => {
  const n = Number(val);
  if (!val && val !== 0) return "";
  if (isNaN(n)) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};


// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function SaleClaimBillForm({ mode = "create", billId, onAfterSubmit }) {
  const isViewMode = mode === "view" || mode === "approver";
  const router     = useRouter();

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  // ── STATE
  const [isEditing,     setIsEditing]     = useState(mode === "create");
  const [isSubmitted,   setIsSubmitted]   = useState(false);
  const [allowSubmit,   setAllowSubmit]   = useState(mode === "edit");
  const [isLoading,     setIsLoading]     = useState(false);
  const [initialData,   setInitialData]   = useState(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [itemsOptions,  setItemsOptions]  = useState([]);
  const [useLocations,  setUseLocations]  = useState([]);

  // File state — 1 attachment
  const [file,          setFile]          = useState(null);
  const [existingUrl,   setExistingUrl]   = useState("");
  const [initialUrl,    setInitialUrl]    = useState("");
  const [fileResetKey,  setFileResetKey]  = useState(0);

  const {
    register, control, handleSubmit, reset, getValues, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── COMPUTED TOTALS
  const watchedItems         = watch("items") || [];
  const watchedPreCertified  = watch("preCertifiedAmount") || 0;

  const thisBillClaim = watchedItems.reduce((sum, item) => {
    const qty  = Number(item?.claimQty || 0);
    const rate = Number(item?.rate     || 0);
    return sum + qty * rate;
  }, 0);

  const totalClaim = thisBillClaim + Number(watchedPreCertified || 0);

  // ── FETCH ITEMS & LOCATIONS ───────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.GET_ITEMS_BY_CATEGORY, method: "GET" })
      .then((res) => setItemsOptions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setItemsOptions([]));
  }, []);

  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url:    `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION.LIST}/${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : [];
        setUseLocations(all.filter((l) => l.locationType === "Use"));
      })
      .catch(() => setUseLocations([]));
  }, [projectCode]);

  // ── ITEM SELECTION HANDLER ────────────────────────────────────────────────────
  const handleItemSelect = useCallback(
    (index, _value, item) => {
      setValue(`items.${index}.itemCode`,        item?.itemCode        || "", { shouldDirty: true });
      setValue(`items.${index}.itemDisplayCode`, item?.itemDisplayCode || item?.itemCode || "", { shouldDirty: true });
      setValue(`items.${index}.itemName`,        item?.itemName        || "", { shouldDirty: true });
      setValue(`items.${index}.itemDescription`, item?.itemDescription || "", { shouldDirty: true });
      setValue(`items.${index}.unit`,            item?.unit            || "", { shouldDirty: true });
    },
    [setValue],
  );

  // ── FETCH DETAIL ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !billId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.GET_BY_ID}${billId}`,
          method: "GET",
        });
        const d = res.data;

        const formatted = {
          orderNo:            d.orderNo            || "",
          orderDate:          d.orderDate          || "",
          orderTitle:         d.orderTitle         || "",
          jobLocation:        d.jobLocation        || "",
          preCertifiedAmount: d.preCertifiedAmount || "",
          items: (d.items || []).map((it) => ({
            itemDisplayCode: it.itemDisplayCode || it.itemCode || "",
            itemCode:        it.itemCode        || "",
            itemName:        it.itemName        || "",
            itemDescription: it.itemDescription || "",
            unit:            it.unit            || "",
            claimQty:        it.claimQty        || "",
            rate:            it.rate            || "",
          })),
        };
        if (!formatted.items.length) formatted.items = [{ ...DEFAULT_ITEM }];

        reset(formatted);
        setInitialData(formatted);

        setExistingUrl(d.attachment_1 || "");
        setInitialUrl(d.attachment_1 || "");

        const editable = ["draft", "reback"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("Sale Bill already Approved");
          else if (st === "Rejected") toast.info("Sale Bill already Rejected");
          else                         toast.info("Sale Bill already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Sale Bill");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [billId, mode]);

  // ── EDIT / CANCEL ─────────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setFile(null);
      setExistingUrl(initialUrl);
      setFileResetKey((k) => k + 1);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  // ── BUILD PAYLOAD ─────────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();

    if (mode === "create") fd.append("projectCode", projectCode);
    fd.append("orderNo",            v.orderNo            || "");
    fd.append("orderDate",          v.orderDate          || "");
    fd.append("orderTitle",         v.orderTitle         || "");
    fd.append("jobLocation",        v.jobLocation        || "");
    fd.append("preCertifiedAmount", v.preCertifiedAmount || 0);

    fd.append(
      "items",
      JSON.stringify(
        v.items.map((it, i) => ({
          slNo:            i + 1,
          itemCode:        it.itemCode        || "",
          itemDescription: it.itemDescription || "",
          unit:            it.unit            || "",
          claimQty:        Number(it.claimQty || 0),
          rate:            Number(it.rate     || 0),
        })),
      ),
    );

    if (file) fd.append("attachment_1", file);

    return fd;
  };

  // ── SAVE DRAFT / UPDATE ───────────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url:    mode === "create"
          ? API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.CREATE
          : `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.UPDATE}${billId}/edit`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });

      setExistingUrl(res.data?.attachment_1 || existingUrl);
      setInitialUrl(res.data?.attachment_1 || existingUrl);
      setFile(null);
      setFileResetKey((k) => k + 1);
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);

      toast.success(
        mode === "create" ? "Sale Bill created successfully" : "Sale Bill updated successfully",
        { id: tid },
      );

      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/project-management/customer-billing/sale-bill-claim/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── SUBMIT FOR APPROVAL ───────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!billId) { toast.error("Please save first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.SUBMIT}${billId}/submit`,
        method: "POST",
      });
      toast.success("Sale Bill submitted for approval", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: tid });
    }
  };

  // ── LOADING ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      {/* PANEL TOGGLE */}
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Hide left panel" : "Show left panel"}
        className="mb-2 p-1 rounded hover:bg-gray-100 text-gray-500 transition"
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex gap-3 items-start">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="w-full md:w-[385px] shrink-0 space-y-2">
            <PMSection title="Sale Bill Details:">

              <PMFormRow label="Order No" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
                <PMInput
                  {...register("orderNo")}
                  disabled={disabled}
                  hasError={errors.orderNo}
                  placeholder="Text"
                />
              </PMFormRow>

              <PMFormRow label="Order Date" labelWidth="sm:w-[140px] sm:min-w-[140px]">
                <PMDateInput
                  {...register("orderDate")}
                  disabled={disabled}
                  hasError={errors.orderDate}
                  className="max-w-[200px]"
                />
              </PMFormRow>

              {/* Order Title — label line + full-width textarea */}
              <div>
                <span className="text-[13px] text-[#444444]">
                  Order Title{!disabled && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                <Controller
                  name="orderTitle"
                  control={control}
                  render={({ field, fieldState }) => (
                    <PMTextarea
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      hasError={fieldState.error}
                      disabled={disabled}
                      title="Order Title"
                      placeholder="Text"
                      rows={2}
                      maxRows={5}
                    />
                  )}
                />
              </div>

              {/* Job Location — searchable select, use locations */}
              <PMFormRow label="Job Location" required={!disabled} labelWidth="sm:w-[140px] sm:min-w-[140px]">
                <div className="flex-1">
                  <SearchableSelect
                    options={useLocations}
                    value={watch("jobLocation") || ""}
                    disabled={disabled}
                    onChange={(value) => setValue("jobLocation", value, { shouldDirty: true })}
                    placeholder="Select"
                    labelKey="locationName"
                    valueKey="locationName"
                    searchKeys={["locationName"]}
                  />
                  {errors.jobLocation && (
                    <p className="text-[11px] text-red-500 mt-0.5">{errors.jobLocation.message}</p>
                  )}
                </div>
              </PMFormRow>

              <PMFormRow label="Pre Certified Amount" labelWidth="sm:w-[140px] sm:min-w-[140px]">
                <PMInput
                  type="number"
                  min={0}
                  step="any"
                  {...register("preCertifiedAmount")}
                  disabled={disabled}
                  expandable={false}
                  placeholder="Number"
                  className="max-w-[180px] text-right"
                />
              </PMFormRow>

              <PMFormRow label="This Bill Claim" labelWidth="sm:w-[140px] sm:min-w-[140px]">
                <div className="max-w-[180px]">
                  <input
                    type="text"
                    value={fmt(thisBillClaim)}
                    disabled
                    readOnly
                    className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                  />
                </div>
              </PMFormRow>

              <PMFormRow label="Total Claim" labelWidth="sm:w-[140px] sm:min-w-[140px]">
                <div className="max-w-[180px]">
                  <input
                    type="text"
                    value={fmt(totalClaim)}
                    disabled
                    readOnly
                    className="w-full h-[30px] text-[13px] rounded-sm border border-[#5f8fbe] bg-[#d6e8f9] text-right px-2 font-semibold text-[#1c3a5e] outline-none"
                  />
                </div>
              </PMFormRow>

              {/* ATTACHMENT — 1 file */}
              <div className="pt-2">
                <FileUploadInput
                  label="Attachment"
                  showLabel
                  disabled={disabled}
                  existingFileUrl={existingUrl}
                  onFileChange={(f) => setFile(f)}
                  onClearExisting={() => setExistingUrl("")}
                  resetKey={fileResetKey}
                />
              </div>

            </PMSection>
          </div>
        )}

        {/* ── RIGHT PANEL: BOQ TABLE ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="border border-[#b5b5b5]">

            {/* TABLE TITLE */}
            <div className="bg-[#d6e4f5] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[15px] text-[#1c3a5e]">
              Bill of Quantity [BOQ]
            </div>

            {/* TABLE */}
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
              <table className="w-full border-collapse text-sm" style={{ minWidth: 860 }}>

                {/* HEADER */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#3b6ea5] text-white">
                    <th className="border border-[#2a5080] w-[44px] text-center text-[12px] py-1.5">SL no</th>
                    <th className="border border-[#2a5080] w-[110px] text-left px-2 text-[12px] py-1.5">Item Code</th>
                    <th className="border border-[#2a5080] text-left px-2 text-[12px] py-1.5">Item Name &amp; Description</th>
                    <th className="border border-[#2a5080] w-[70px] text-center text-[12px] py-1.5">Unit</th>
                    <th className="border border-[#2a5080] w-[90px] text-right px-2 text-[12px] py-1.5">Claim Qty</th>
                    <th className="border border-[#2a5080] w-[100px] text-right px-2 text-[12px] py-1.5">Rate</th>
                    <th className="border border-[#2a5080] w-[110px] text-right px-2 text-[12px] py-1.5">Amount</th>
                    {!disabled && (
                      <th className="border border-[#2a5080] w-[40px] text-center text-[12px] py-1.5">Del</th>
                    )}
                  </tr>
                </thead>

                {/* BODY */}
                <tbody>
                  {fields.map((field, index) => {
                    const qty    = Number(watch(`items.${index}.claimQty`) || 0);
                    const rate   = Number(watch(`items.${index}.rate`)     || 0);
                    const amount = qty * rate;

                    return (
                      <tr key={field.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f8fc]"}>

                        {/* SL */}
                        <td className="border border-[#ccc] text-center bg-[#edf4fb] text-[13px] font-medium align-middle">
                          {index + 1}
                        </td>

                        {/* ITEM CODE — auto, disabled */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            {...register(`items.${index}.itemDisplayCode`)}
                            disabled
                            placeholder="Code"
                            className={`
                              ${getInputClass(false, true)}
                              border-0 rounded-none w-full h-[30px] text-[12px] px-1
                            `}
                          />
                          <input {...register(`items.${index}.itemCode`)} type="hidden" />
                          <input {...register(`items.${index}.itemName`)} type="hidden" />
                        </td>

                        {/* ITEM NAME & DESCRIPTION */}
                        <td className="border border-[#ccc] p-0">
                          <SearchableSelect
                            options={itemsOptions}
                            value={watch(`items.${index}.itemCode`) || ""}
                            disabled={disabled}
                            onChange={(value, item) => handleItemSelect(index, value, item)}
                            placeholder="Select Item"
                            labelKey="itemName"
                            valueKey="itemCode"
                            searchKeys={["itemName", "itemCode"]}
                            className="rounded-none"
                          />
                          <input
                            {...register(`items.${index}.itemDescription`)}
                            disabled={disabled}
                            placeholder="Description…"
                            className={`
                              ${getInputClass(false, disabled)}
                              border-0 border-t border-[#ddd] rounded-none w-full
                              h-5.5 text-[11px] px-1.5
                            `}
                          />
                        </td>

                        {/* UNIT — auto, disabled */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            {...register(`items.${index}.unit`)}
                            disabled
                            placeholder="Unit"
                            className={`
                              ${getInputClass(false, true)}
                              border-0 rounded-none w-full h-7.5 text-[12px] text-center
                            `}
                          />
                        </td>

                        {/* CLAIM QTY */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            {...register(`items.${index}.claimQty`, {
                              onChange: (e) => { if (Number(e.target.value) < 0) e.target.value = 0; },
                            })}
                            disabled={disabled}
                            placeholder="0"
                            className={`
                              ${getInputClass(errors?.items?.[index]?.claimQty, disabled)}
                              border-0 rounded-none w-full h-13text-[13px] text-right pr-2
                            `}
                          />
                        </td>

                        {/* RATE */}
                        <td className="border border-[#ccc] p-0 align-middle">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            {...register(`items.${index}.rate`, {
                              onChange: (e) => { if (Number(e.target.value) < 0) e.target.value = 0; },
                            })}
                            disabled={disabled}
                            placeholder="0"
                            className={`
                              ${getInputClass(errors?.items?.[index]?.rate, disabled)}
                              border-0 rounded-none w-full h-13 text-[13px] text-right pr-2
                            `}
                          />
                        </td>

                        {/* AMOUNT (computed) */}
                        <td className="border border-[#ccc] bg-[#edf8ed] px-2 text-[13px] font-medium text-right align-middle">
                          {fmt(amount)}
                        </td>

                        {/* DELETE */}
                        {!disabled && (
                          <td className="border border-[#ccc] text-center align-middle">
                            <button
                              type="button"
                              disabled={fields.length === 1}
                              onClick={() => remove(index)}
                              className="inline-flex items-center justify-center disabled:opacity-30"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </td>
                        )}

                      </tr>
                    );
                  })}
                </tbody>

                {/* FOOTER */}
                <tfoot className="sticky bottom-0 z-10 bg-[#b7d5f0]">
                  <tr className="font-bold">
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0]" />
                    <td className="border border-[#9ec5e0] px-2 text-right text-[13px]">TOTAL=</td>
                    <td className="border border-[#9ec5e0] px-2 text-right text-[13px]">
                      {fmt(thisBillClaim)}
                    </td>
                    {!disabled && <td className="border border-[#9ec5e0]" />}
                  </tr>
                </tfoot>

              </table>
            </div>
          </div>

          {/* ADD ROW */}
          {!disabled && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => append({ ...DEFAULT_ITEM })}
                className="px-4 py-1 bg-[#9fc5e8] border border-[#6d9dc5] rounded-sm text-sm font-medium hover:brightness-95 cursor-pointer"
              >
                + Add Row
              </button>
            </div>
          )}

          {/* ACTION BUTTONS */}
          {!isViewMode && (
            <div className="flex flex-wrap justify-end gap-3 pt-4 mt-4 border-t border-[#d8e6f0]">
              {isEditing && (
                <SaveDraftButton
                  onClick={() => handleSubmit(onSave)()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  requireConfirmation
                  confirmationTitle="Save Sale Bill as Draft?"
                  confirmationMessage="This entry will be saved as a draft and can be edited or submitted later."
                >
                  Save as Draft
                </SaveDraftButton>
              )}

              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                requireConfirmation
                confirmationTitle="Submit Sale Bill?"
                confirmationMessage="Once submitted, this entry will be sent for approval."
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

      </div>
    </div>
  );
}
