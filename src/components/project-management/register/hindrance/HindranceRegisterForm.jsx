"use client";

import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMInput         from "@/components/project-management/common/PMInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import FileUploadInput from "@/components/project-management/common/FileUploadInput";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const nonNegativeAmount = z
  .string()
  .optional()
  .refine(
    (v) => v === "" || v == null || Number(v) >= 0,
    { message: "Amount must be 0 or greater" },
  );

const hindranceSchema = z.object({
  hindranceNo:           z.string().optional(),
  hindranceDate:         z.string().optional(),
  titleOfHindrance:      z.string().optional(),
  causeOfHindrance:      z.string().optional(),
  manpowerDetails:       z.string().optional(),
  manpowerAmount:        nonNegativeAmount,
  plantMachineryDetails: z.string().optional(),
  plantMachineryAmount:  nonNegativeAmount,
  materialsDetails:      z.string().optional(),
  materialsAmount:       nonNegativeAmount,
  intimationTo:          z.string().optional(),
  intimationVia:         z.string().optional(),
});

const defaultValues = {
  hindranceNo:           "",
  hindranceDate:         "",
  titleOfHindrance:      "",
  causeOfHindrance:      "",
  manpowerDetails:       "",
  manpowerAmount:        "",
  plantMachineryDetails: "",
  plantMachineryAmount:  "",
  materialsDetails:      "",
  materialsAmount:       "",
  intimationTo:          "",
  intimationVia:         "",
};

// Sub-group header used inside the Effected Resource section
function ResourceGroup({ title }) {
  return (
    <div className="pt-2 pb-0.5">
      <span className="text-[13px] font-semibold text-red-700">{title}</span>
    </div>
  );
}

export default function HindranceRegisterForm({ mode = "create", hindranceId, onAfterSubmit }) {
  const isViewMode = mode === "view" || mode === "approver";

  const [isEditing,       setIsEditing]      = useState(mode === "create");
  const [isSubmitted,     setIsSubmitted]    = useState(false);
  const [allowSubmit,     setAllowSubmit]    = useState(mode === "edit");
  const [isLoading,       setIsLoading]      = useState(false);
  const [initialData,     setInitialData]    = useState(null);

  const [attachedFile,    setAttachedFile]   = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl,  setInitialFileUrl]  = useState("");
  const [fileResetKey,    setFileResetKey]   = useState(0);

  const router      = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(hindranceSchema), defaultValues });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // Reactive total — recalculates on every keystroke in the three amount fields
  const manpowerAmt   = parseFloat(watch("manpowerAmount")        || 0) || 0;
  const plantAmt      = parseFloat(watch("plantMachineryAmount")   || 0) || 0;
  const materialsAmt  = parseFloat(watch("materialsAmount")        || 0) || 0;
  const totalEffected = (manpowerAmt + plantAmt + materialsAmt).toFixed(2);

  // ── Fetch detail ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !hindranceId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.REGISTER.HINDRANCE_REGISTER.GET_BY_ID}/${hindranceId}`,
          method: "GET",
        });
        const d = res.data;
        const formatted = {
          hindranceNo:           d.hindranceNo           || "",
          hindranceDate:         d.hindranceDate         || "",
          titleOfHindrance:      d.titleOfHindrance      || "",
          causeOfHindrance:      d.causeOfHindrance      || "",
          manpowerDetails:       d.manpowerDetails       || "",
          manpowerAmount:        d.manpowerAmount        != null ? String(d.manpowerAmount)       : "",
          plantMachineryDetails: d.plantMachineryDetails || "",
          plantMachineryAmount:  d.plantMachineryAmount  != null ? String(d.plantMachineryAmount) : "",
          materialsDetails:      d.materialsDetails      || "",
          materialsAmount:       d.materialsAmount       != null ? String(d.materialsAmount)      : "",
          intimationTo:          d.intimationTo          || "",
          intimationVia:         d.intimationVia         || "",
        };
        reset(formatted);
        setInitialData(formatted);

        const furl = d.attachment || "";
        setExistingFileUrl(furl);
        setInitialFileUrl(furl);

        const editable = ["draft", "reback"].includes(
          (d.workflowStatus || "").toLowerCase(),
        );
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("Hindrance Register already Approved");
          else if (st === "Rejected") toast.info("Hindrance Register already Rejected");
          else                         toast.info("Hindrance Register already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Hindrance Register");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [hindranceId, mode]);

  // ── Edit / Cancel ──────────────────────────────────────────────────────────
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

  // ── Build payload ──────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();
    if (mode === "create") fd.append("projectCode",           projectCode);
    fd.append("hindranceDate",         v.hindranceDate         ?? "");
    fd.append("titleOfHindrance",      v.titleOfHindrance      ?? "");
    fd.append("causeOfHindrance",      v.causeOfHindrance      ?? "");
    fd.append("manpowerDetails",       v.manpowerDetails       ?? "");
    fd.append("manpowerAmount",        v.manpowerAmount        ?? "");
    fd.append("plantMachineryDetails", v.plantMachineryDetails ?? "");
    fd.append("plantMachineryAmount",  v.plantMachineryAmount  ?? "");
    fd.append("materialsDetails",      v.materialsDetails      ?? "");
    fd.append("materialsAmount",       v.materialsAmount       ?? "");
    fd.append("intimationTo",          v.intimationTo          ?? "");
    fd.append("intimationVia",         v.intimationVia         ?? "");
    if (attachedFile) fd.append("attachment", attachedFile);
    return fd;
  };

  // ── Save as draft ─────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url:    mode === "create"
          ? API_ENDPOINTS.PROJECT.REGISTER.HINDRANCE_REGISTER.CREATE
          : `${API_ENDPOINTS.PROJECT.REGISTER.HINDRANCE_REGISTER.UPDATE}/${hindranceId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });

      if (res?.data?.hindranceNo) setValue("hindranceNo", res.data.hindranceNo);

      if (attachedFile && res?.data?.attachment) {
        const url = res.data.attachment;
        setExistingFileUrl(url);
        setInitialFileUrl(url);
        setAttachedFile(null);
        setFileResetKey((k) => k + 1);
      }

      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success(
        mode === "create" ? "Hindrance Register created successfully" : "Hindrance Register updated successfully",
        { id: tid },
      );

      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/project-management/register/hindrance/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── Submit for approval ───────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!hindranceId) { toast.error("Please save first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.REGISTER.HINDRANCE_REGISTER.SUBMIT}/${hindranceId}`,
        method: "POST",
      });
      toast.success("Hindrance Register submitted for approval", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: tid });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">

      {/* ── SECTION 1: BASIC DETAILS ─────────────────────────────────────── */}
      <PMSection>
        <PMFormRow label="Hindrance No">
          <PMInput
            {...register("hindranceNo")}
            disabled
            expandable={false}
            placeholder="[Auto]"
            className="max-w-[200px]"
          />
        </PMFormRow>

        <PMFormRow label="Hindrance Date">
          <PMDateInput
            {...register("hindranceDate")}
            disabled={disabled}
            hasError={errors.hindranceDate}
            className="max-w-[280px]"
          />
        </PMFormRow>
      </PMSection>

      {/* ── SECTION 2: HINDRANCE DETAILS ─────────────────────────────────── */}
      <PMSection title="Hindrance Details:">

        <PMFormRow label="Title of Hindrance">
          <PMInput
            {...register("titleOfHindrance")}
            disabled={disabled}
            hasError={errors.titleOfHindrance}
            fieldLabel="Title of Hindrance"
            placeholder="Short title"
            className="max-w-[500px]"
          />
        </PMFormRow>

        <PMFormRow label="Cause of Hindrance">
          <Controller
            name="causeOfHindrance"
            control={control}
            render={({ field, fieldState }) => (
              <PMTextarea
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hasError={fieldState.error}
                disabled={disabled}
                title="Cause of Hindrance"
                placeholder="Detailed cause description"
                rows={2}
                maxRows={5}
              />
            )}
          />
        </PMFormRow>

      </PMSection>

      {/* ── SECTION 3: EFFECTED RESOURCE ─────────────────────────────────── */}
      <PMSection title="Effected Resource:">

        {/* Total — auto-calculated, shown prominently */}
        <PMFormRow
          label="Total Effected Amount"
          labelWidth="sm:w-[260px] sm:min-w-[260px]"
        >
          <div className="h-[30px] px-3 flex items-center text-[13px] font-semibold text-gray-800 bg-yellow-50 border border-yellow-300 rounded-sm max-w-[200px]">
            {totalEffected}
          </div>
        </PMFormRow>

        {/* ── Manpower ── */}
        <ResourceGroup title="Manpower" />

        <PMFormRow label="Details">
          <Controller
            name="manpowerDetails"
            control={control}
            render={({ field, fieldState }) => (
              <PMTextarea
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hasError={fieldState.error}
                disabled={disabled}
                title="Manpower Details"
                placeholder="Description of manpower impact"
                rows={1}
                maxRows={3}
                className="max-w-[500px]"
              />
            )}
          />
        </PMFormRow>

        <PMFormRow label="Amount">
          <div className="max-w-[180px]">
            <PMInput
              type="number"
              {...register("manpowerAmount")}
              disabled={disabled}
              hasError={errors.manpowerAmount}
              expandable={false}
              placeholder="0.00"
              min="0"
            />
            {/* {errors.manpowerAmount && (
              <p className="text-[11px] text-red-500 mt-0.5">{errors.manpowerAmount.message}</p>
            )} */}
          </div>
        </PMFormRow>

        {/* ── Plant & Machinery ── */}
        <ResourceGroup title="Plant & Machinery" />

        <PMFormRow label="Details">
          <Controller
            name="plantMachineryDetails"
            control={control}
            render={({ field, fieldState }) => (
              <PMTextarea
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hasError={fieldState.error}
                disabled={disabled}
                title="Plant & Machinery Details"
                placeholder="Description of plant & machinery impact"
                rows={1}
                maxRows={3}
                className="max-w-[500px]"
              />
            )}
          />
        </PMFormRow>

        <PMFormRow label="Amount">
          <div className="max-w-[180px]">
            <PMInput
              type="number"
              {...register("plantMachineryAmount")}
              disabled={disabled}
              hasError={errors.plantMachineryAmount}
              expandable={false}
              placeholder="0.00"
              min="0"
            />
            {/* {errors.plantMachineryAmount && (
              <p className="text-[11px] text-red-500 mt-0.5">{errors.plantMachineryAmount.message}</p>
            )} */}
          </div>
        </PMFormRow>

        {/* ── Materials ── */}
        <ResourceGroup title="Materials" />

        <PMFormRow label="Details">
          <Controller
            name="materialsDetails"
            control={control}
            render={({ field, fieldState }) => (
              <PMTextarea
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hasError={fieldState.error}
                disabled={disabled}
                title="Materials Details"
                placeholder="Description of materials impact"
                rows={1}
                maxRows={3}
                className="max-w-[500px]"
              />
            )}
          />
        </PMFormRow>

        <PMFormRow label="Amount">
          <div className="max-w-[180px]">
            <PMInput
              type="number"
              {...register("materialsAmount")}
              disabled={disabled}
              hasError={errors.materialsAmount}
              expandable={false}
              placeholder="0.00"
              min="0"
            />
            {/* {errors.materialsAmount && (
              <p className="text-[11px] text-red-500 mt-0.5">{errors.materialsAmount.message}</p>
            )} */}
          </div>
        </PMFormRow>

        {/* ── Attachment ── */}
        <div className="pt-1" />
        <PMFormRow label="Attachment">
          <FileUploadInput
            showLabel={false}
            disabled={disabled}
            existingFileUrl={existingFileUrl}
            onFileChange={(file) => setAttachedFile(file)}
            onClearExisting={() => setExistingFileUrl("")}
            resetKey={fileResetKey}
          />
        </PMFormRow>

      </PMSection>

      {/* ── SECTION 4: INTIMATION DETAILS ────────────────────────────────── */}
      <PMSection title="Intimation Details:">

        <PMFormRow label="Intimation To">
          <PMInput
            {...register("intimationTo")}
            disabled={disabled}
            hasError={errors.intimationTo}
            fieldLabel="Intimation To"
            placeholder="Person / authority intimated"
            className="max-w-[400px]"
          />
        </PMFormRow>

        <PMFormRow label="Intimation Via">
          <PMInput
            {...register("intimationVia")}
            disabled={disabled}
            hasError={errors.intimationVia}
            fieldLabel="Intimation Via"
            placeholder="Mode of intimation"
            className="max-w-[300px]"
          />
        </PMFormRow>

      </PMSection>

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-[#d8e6f0]">
          {isEditing && (
            <SaveDraftButton
              onClick={() => handleSubmit(onSave)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
              confirmationTitle="Save Hindrance Register as Draft?"
              confirmationMessage="This entry will be saved as a draft and can be edited or submitted later."
            >
              Save as Draft
            </SaveDraftButton>
          )}

          <SaveButton
            onClick={onSubmitForApproval}
            loading={isSubmitting}
            disabled={
              !allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit Hindrance Register?"
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
  );
}
