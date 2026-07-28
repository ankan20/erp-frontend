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
import PMSelect        from "@/components/project-management/common/PMSelect";
import PMTextarea      from "@/components/project-management/common/PMTextarea";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMTimeInput     from "@/components/project-management/common/PMTimeInput";
import FileUploadInput from "@/components/project-management/common/FileUploadInput";

import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const DELIVERY_MODE_OPTIONS = [
  "By Hand",
  "By Letter",
  "By Mail",
  "WhatsApp",
  "By Data Card",
];

const bbsSchema = z.object({
  bbsNo:              z.string().optional(),
  revision:           z.string().optional(),
  bbsTitle:           z.string().min(1),
  referenceOrderNo:   z.string().optional(),
  projectSubLocation: z.string().optional(),
  segmentLayer:       z.string().optional(),
  receivedDate:       z.string().optional(),
  receivedTime:       z.string().optional(),
  receivedBy:         z.string().optional(),
  deliveredBy:        z.string().optional(),
  deliveryMode:       z.string().optional(),
  deliveryReference:  z.string().optional(),
});

const defaultValues = {
  bbsNo:              "",
  revision:           "",
  bbsTitle:           "",
  referenceOrderNo:   "",
  projectSubLocation: "",
  segmentLayer:       "",
  receivedDate:       "",
  receivedTime:       "",
  receivedBy:         "",
  deliveredBy:        "",
  deliveryMode:       "",
  deliveryReference:  "",
};

export default function BBSRegisterForm({ mode = "create", bbsId, onAfterSubmit }) {
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
  } = useForm({ resolver: zodResolver(bbsSchema), defaultValues });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Fetch detail ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !bbsId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.REGISTER.BBS_REGISTER.GET_BY_ID}/${bbsId}`,
          method: "GET",
        });
        const d = res.data;
        const formatted = {
          bbsNo:              d.bbsNo              || "",
          revision:           d.revision           || "",
          bbsTitle:           d.bbsTitle           || "",
          referenceOrderNo:   d.referenceOrderNo   || "",
          projectSubLocation: d.projectSubLocation || "",
          segmentLayer:       d.segmentLayer       || "",
          receivedDate:       d.receivedDate       || "",
          receivedTime:       d.receivedTime       || "",
          receivedBy:         d.receivedBy         || "",
          deliveredBy:        d.deliveredBy        || "",
          deliveryMode:       d.deliveryMode       || "",
          deliveryReference:  d.deliveryReference  || "",
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
          if      (st === "Approved") toast.info("BBS Register already Approved");
          else if (st === "Rejected") toast.info("BBS Register already Rejected");
          else                         toast.info("BBS Register already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load BBS Register");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [bbsId, mode]);

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
    if (mode === "create") fd.append("projectCode",        projectCode);
    fd.append("revision",           v.revision           ?? "");
    fd.append("bbsTitle",           v.bbsTitle           ?? "");
    fd.append("referenceOrderNo",   v.referenceOrderNo   ?? "");
    fd.append("projectSubLocation", v.projectSubLocation ?? "");
    fd.append("segmentLayer",       v.segmentLayer       ?? "");
    fd.append("receivedDate",       v.receivedDate       ?? "");
    fd.append("receivedTime",       v.receivedTime       ?? "");
    fd.append("receivedBy",         v.receivedBy         ?? "");
    fd.append("deliveredBy",        v.deliveredBy        ?? "");
    fd.append("deliveryMode",       v.deliveryMode       ?? "");
    fd.append("deliveryReference",  v.deliveryReference  ?? "");
    if (attachedFile) fd.append("attachment", attachedFile);
    return fd;
  };

  // ── Save (draft / update) ─────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url:    mode === "create"
          ? API_ENDPOINTS.PROJECT.REGISTER.BBS_REGISTER.CREATE
          : `${API_ENDPOINTS.PROJECT.REGISTER.BBS_REGISTER.UPDATE}/${bbsId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });
      if (res?.data?.bbsNo) setValue("bbsNo", res.data.bbsNo);
      if (res?.data?.attachment) {
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
        mode === "create" ? "BBS Register created successfully" : "BBS Register updated successfully",
        { id: tid },
      );
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/project-management/register/bbs/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── Submit for approval ───────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!bbsId) { toast.error("Please save first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.REGISTER.BBS_REGISTER.SUBMIT}/${bbsId}`,
        method: "POST",
      });
      toast.success("BBS Register submitted for approval", { id: tid });
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

      {/* ── SECTION 1: BBS DETAILS ──────────────────────────────────────── */}
      <PMSection title="BBS Details:">

        {/* BBS No — auto-generated, always read-only */}
        <PMFormRow label="BBS No">
          <PMInput
            {...register("bbsNo")}
            disabled
            expandable={false}
            placeholder="[Auto]"
            className="max-w-[200px]"
          />
        </PMFormRow>

        {/* Revision */}
        <PMFormRow label="Revision">
          <PMInput
            {...register("revision")}
            disabled={disabled}
            hasError={errors.revision}
            fieldLabel="Revision"
            placeholder="Text"
            className="max-w-[180px]"
          />
        </PMFormRow>

        {/* BBS Title — long text expected (varchar 500), use expandable textarea */}
        <PMFormRow label="BBS Title">
          <Controller
            name="bbsTitle"
            control={control}
            render={({ field, fieldState }) => (
              <PMTextarea
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hasError={fieldState.error}
                disabled={disabled}
                title="BBS Title"
                placeholder="Text"
                rows={1}
                maxRows={3}
              />
            )}
          />
        </PMFormRow>

      </PMSection>

      {/* ── SECTION 2: LOCATION DETAILS ─────────────────────────────────── */}
      <PMSection title="Location Details:">

        {/* Reference Order No */}
        <PMFormRow label="Reference Order No">
          <PMInput
            {...register("referenceOrderNo")}
            disabled={disabled}
            hasError={errors.referenceOrderNo}
            fieldLabel="Reference Order No"
            placeholder="Select from Sale Order List"
            className="max-w-[500px]"
          />
        </PMFormRow>

        {/* Project Sub-Location / Unit — long text possible (varchar 200) */}
        <PMFormRow label="Project Sub-Location /Unit">
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
                title="Project Sub-Location / Unit"
                placeholder="Text"
                rows={1}
                maxRows={2}
                className="max-w-[500px]"
              />
            )}
          />
        </PMFormRow>

        {/* Segment / Layer */}
        <PMFormRow label="Segment/Layer">
          <PMInput
            {...register("segmentLayer")}
            disabled={disabled}
            hasError={errors.segmentLayer}
            fieldLabel="Segment/Layer"
            placeholder="Text"
            className="max-w-[500px]"
          />
        </PMFormRow>

      </PMSection>

      {/* ── SECTION 3: RECEIVED DETAILS ─────────────────────────────────── */}
      <PMSection title="Received Details:">

        {/* Received Date */}
        <PMFormRow label="Received Date">
          <PMDateInput
            {...register("receivedDate")}
            disabled={disabled}
            hasError={errors.receivedDate}
            className="max-w-[280px]"
          />
        </PMFormRow>

        {/* Received Time */}
        <PMFormRow label="Received Time">
          <PMTimeInput
            {...register("receivedTime")}
            disabled={disabled}
            hasError={errors.receivedTime}
            className="max-w-[220px]"
          />
        </PMFormRow>

        {/* Received By */}
        <PMFormRow label="Received By">
          <PMInput
            {...register("receivedBy")}
            disabled={disabled}
            hasError={errors.receivedBy}
            fieldLabel="Received By"
            placeholder="Text"
            className="max-w-[500px]"
          />
        </PMFormRow>

        {/* Delivered By */}
        <PMFormRow label="Delivered By">
          <PMInput
            {...register("deliveredBy")}
            disabled={disabled}
            hasError={errors.deliveredBy}
            fieldLabel="Delivered By"
            placeholder="Text"
            className="max-w-[500px]"
          />
        </PMFormRow>

        {/* Delivery Mode */}
        <PMFormRow label="Delivery Mode">
          <PMSelect
            {...register("deliveryMode")}
            disabled={disabled}
            hasError={errors.deliveryMode}
            placeholder="By Hand/By Letter/By Mail/WhatsApp/By Data Card"
            options={DELIVERY_MODE_OPTIONS}
            className="max-w-[400px]"
          />
        </PMFormRow>

        {/* Delivery Reference */}
        <PMFormRow label="Delivery Reference">
          <PMInput
            {...register("deliveryReference")}
            disabled={disabled}
            hasError={errors.deliveryReference}
            fieldLabel="Delivery Reference"
            placeholder="Text"
            className="max-w-[500px]"
          />
        </PMFormRow>

        {/* Attachment */}
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

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-[#d8e6f0]">
          {isEditing && (
            <SaveDraftButton
              onClick={() => handleSubmit(onSave)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
              confirmationTitle="Save BBS Register as Draft?"
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
            confirmationTitle="Submit BBS Register?"
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
