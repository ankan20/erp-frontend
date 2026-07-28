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
import PMTimeInput     from "@/components/project-management/common/PMTimeInput";
import FileUploadInput from "@/components/project-management/common/FileUploadInput";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const concreteSchema = z.object({
  referenceOrderNo:   z.string().optional(),
  projectSubLocation: z.string().min(1, "Project Sub Location is required"),
  segment:            z.string().min(1, "Segment is required"),
  pouringDate:        z.string().min(1, "Pouring Date is required"),
  pouringStartDate:   z.string().min(1, "Pouring Start Time is required"),
  pouringEndDate:     z.string().min(1, "Pouring Finish Time is required"),
  gradeConcrete:      z.string().min(1, "Grade of Concrete is required"),
  concreteVolume:     z.string().min(1, "Concrete Volume is required"),
  requisitionNo:      z.string().min(1, "Requisition Slip No is required"),
  requisitionBy:      z.string().min(1, "Requisition By is required"),
  vehicleNumber:      z.string().min(1, "Vehicle Number is required"),
  batchNo:            z.string().min(1, "Batch No is required"),
});

const defaultValues = {
  referenceOrderNo:   "",
  projectSubLocation: "",
  segment:            "",
  pouringDate:        "",
  pouringStartDate:   "",
  pouringEndDate:     "",
  gradeConcrete:      "",
  concreteVolume:     "",
  requisitionNo:      "",
  requisitionBy:      "",
  vehicleNumber:      "",
  batchNo:            "",
};

export default function ConcreteForm({ mode = "create", registryId, onAfterSubmit }) {
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
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(concreteSchema), defaultValues });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Fetch detail ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !registryId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.GET_DETAILS_BY_ID}/${registryId}`,
          method: "GET",
        });
        // API returns an array; take first element
        const d = res.data[0];
        const formatted = {
          referenceOrderNo:   d.referenceOrderNo   || "",
          projectSubLocation: d.projectSubLocation || "",
          segment:            d.segment            || "",
          pouringDate:        d.pouringDate        || "",
          pouringStartDate:   d.pouringStartDate   || "",
          pouringEndDate:     d.pouringEndDate     || "",
          gradeConcrete:      d.gradeConcrete      || "",
          concreteVolume:     d.concreteVolume != null ? String(d.concreteVolume) : "",
          requisitionNo:      d.requisitionNo      || "",
          requisitionBy:      d.requisitionBy      || "",
          vehicleNumber:      d.vehicleNumber      || "",
          batchNo:            d.batchNo            || "",
        };
        reset(formatted);
        setInitialData(formatted);

        const furl = d.attachBatchFile || "";
        setExistingFileUrl(furl);
        setInitialFileUrl(furl);

        const editable = ["draft", "reback"].includes(
          (d.workflowStatus || "").toLowerCase(),
        );
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("Concrete Register already Approved");
          else if (st === "Rejected") toast.info("Concrete Register already Rejected");
          else                         toast.info("Concrete Register already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load record");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [registryId, mode]);

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
    fd.append("projectCode",        projectCode);
    fd.append("projectSubLocation", v.projectSubLocation ?? "");
    fd.append("segment",            v.segment            ?? "");
    fd.append("pouringDate",        v.pouringDate        ?? "");
    fd.append("pouringStartDate",   v.pouringStartDate   ?? "");
    fd.append("pouringEndDate",     v.pouringEndDate     ?? "");
    fd.append("gradeConcrete",      v.gradeConcrete      ?? "");
    fd.append("concreteVolume",     v.concreteVolume     ?? "");
    fd.append("requisitionNo",      v.requisitionNo      ?? "");
    fd.append("requisitionBy",      v.requisitionBy      ?? "");
    fd.append("vehicleNumber",      v.vehicleNumber      ?? "");
    fd.append("batchNo",            v.batchNo            ?? "");
    if (attachedFile) fd.append("attachBatchFile", attachedFile);
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
          ? API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.CREATE
          : `${API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.UPDATE}/${registryId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });

      // API may return array or object; handle both
      const record = Array.isArray(res.data) ? res.data[0] : res.data;
      const refNo  = record?.referenceOrderNo;
      if (refNo) setValue("referenceOrderNo", refNo);

      if (attachedFile) {
        const updatedUrl = record?.attachBatchFile || existingFileUrl;
        setExistingFileUrl(updatedUrl);
        setInitialFileUrl(updatedUrl);
        setAttachedFile(null);
        setFileResetKey((k) => k + 1);
      }

      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success(mode === "create" ? "Draft saved" : "Draft updated", { id: tid });

      if (mode === "create") {
        const newId = record?.id;
        if (newId) setTimeout(() => router.push(`/project-management/register/concrete/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── Submit for approval ───────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!registryId) { toast.error("Please save draft first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting…");
      await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.SUBMIT}/${registryId}`,
        method: "POST",
      });
      toast.success("Submitted successfully", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Submit failed", { id: tid });
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

      {/* ── SECTION 1: CONCRETE POURING LOCATION ────────────────────────── */}
      <PMSection title="Concrete Pouring Location:">

        <PMFormRow label="Reference Order No">
          <PMInput
            {...register("referenceOrderNo")}
            disabled
            expandable={false}
            placeholder="[Auto Generated]"
            className="max-w-[300px]"
          />
        </PMFormRow>

        <PMFormRow label="Project Sub-Location" required>
          <Controller
            name="projectSubLocation"
            control={control}
            render={({ field, fieldState }) => (
              <PMTextarea
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hasError={fieldState.error}
                disabled={disabled}
                title="Project Sub-Location"
                placeholder="Enter sub location"
                rows={1}
                maxRows={2}
                className="max-w-[500px]"
              />
            )}
          />
        </PMFormRow>

        <PMFormRow label="Segment / Layer" required>
          <PMInput
            {...register("segment")}
            disabled={disabled}
            hasError={errors.segment}
            fieldLabel="Segment / Layer"
            placeholder="Enter segment"
            className="max-w-[500px]"
          />
        </PMFormRow>

      </PMSection>

      {/* ── SECTION 2: POURING DETAILS ──────────────────────────────────── */}
      <PMSection title="Pouring Details:">

        <PMFormRow label="Pouring Date" required>
          <PMDateInput
            {...register("pouringDate")}
            disabled={disabled}
            hasError={errors.pouringDate}
            className="max-w-[280px]"
          />
        </PMFormRow>

        <PMFormRow label="Pouring Start Time" required>
          <PMTimeInput
            {...register("pouringStartDate")}
            disabled={disabled}
            hasError={errors.pouringStartDate}
            className="max-w-[220px]"
          />
        </PMFormRow>

        <PMFormRow label="Pouring Finish Time" required>
          <PMTimeInput
            {...register("pouringEndDate")}
            disabled={disabled}
            hasError={errors.pouringEndDate}
            className="max-w-[220px]"
          />
        </PMFormRow>

      </PMSection>

      {/* ── SECTION 3: GRADE & VOLUME DETAILS ───────────────────────────── */}
      <PMSection title="Grade & Volume Details:">

        <PMFormRow label="Grade of Concrete" required>
          <PMInput
            {...register("gradeConcrete")}
            disabled={disabled}
            hasError={errors.gradeConcrete}
            fieldLabel="Grade of Concrete"
            placeholder="e.g. M25"
            className="max-w-[300px]"
          />
        </PMFormRow>

        <PMFormRow label="Concrete Volume (CuM)" required>
          <PMInput
            type="number"
            {...register("concreteVolume")}
            disabled={disabled}
            hasError={errors.concreteVolume}
            expandable={false}
            placeholder="Enter volume"
            className="max-w-[200px]"
          />
        </PMFormRow>

      </PMSection>

      {/* ── SECTION 4: REQUISITION DETAILS ──────────────────────────────── */}
      <PMSection title="Requisition Details:">

        <PMFormRow label="Requisition Slip No" required>
          <PMInput
            {...register("requisitionNo")}
            disabled={disabled}
            hasError={errors.requisitionNo}
            fieldLabel="Requisition Slip No"
            placeholder="Enter requisition no"
            className="max-w-[400px]"
          />
        </PMFormRow>

        <PMFormRow label="Requisition By" required>
          <PMInput
            {...register("requisitionBy")}
            disabled={disabled}
            hasError={errors.requisitionBy}
            fieldLabel="Requisition By"
            placeholder="Enter name"
            className="max-w-[400px]"
          />
        </PMFormRow>

        <PMFormRow label="TM Vehicle Number" required>
          <PMInput
            {...register("vehicleNumber")}
            disabled={disabled}
            hasError={errors.vehicleNumber}
            fieldLabel="TM Vehicle Number"
            placeholder="Enter vehicle number"
            className="max-w-[400px]"
          />
        </PMFormRow>

        <PMFormRow label="Batch Slip No / Challan" required>
          <PMInput
            {...register("batchNo")}
            disabled={disabled}
            hasError={errors.batchNo}
            fieldLabel="Batch Slip No / Challan"
            placeholder="Enter batch no"
            className="max-w-[400px]"
          />
        </PMFormRow>

      </PMSection>

      {/* ── SECTION 5: BATCH DOCUMENT ───────────────────────────────────── */}
      <PMSection title="Batch Document:">

        <PMFormRow label="Attach Batch Slip / Challan" required={mode === "create"}>
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

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-[#d8e6f0]">
          {isEditing && (
            <SaveDraftButton
              onClick={() => handleSubmit(onSave)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
              confirmationTitle="Save Concrete Register as Draft?"
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
            confirmationTitle="Submit Concrete Register?"
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
