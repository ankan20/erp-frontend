"use client";

import { useEffect, useRef, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Paperclip, Download } from "lucide-react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass } from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";

// ── DELIVERY MODE OPTIONS ─────────────────────────────────────────────────────
// Accepted values per API spec: By Hand / By Letter / By Mail / WhatsApp / By Data Card
const DELIVERY_MODE_OPTIONS = [
  "By Hand",
  "By Letter",
  "By Mail",
  "WhatsApp",
  "By Data Card",
];

// ── ZOD SCHEMA ────────────────────────────────────────────────────────────────
// All fields are optional per API spec — only projectCode is required server-side
const drawingSchema = z.object({
  drNo:               z.string().optional(),
  drawingNo:          z.string().optional(),
  revision:           z.string().optional(),
  drawingTitle:       z.string().optional(),
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
  drNo:               "",
  drawingNo:          "",
  revision:           "",
  drawingTitle:       "",
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

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function DrawingRegisterForm({ mode = "create", drId, onAfterSubmit }) {
  const isViewMode = mode === "view" || mode === "approver";

  const [isEditing,       setIsEditing]       = useState(mode === "create");
  const [isSubmitted,     setIsSubmitted]     = useState(false);
  const [allowSubmit,     setAllowSubmit]     = useState(mode === "edit");
  const [isLoading,       setIsLoading]       = useState(false);
  const [initialData,     setInitialData]     = useState(null);
  const [attachedFile,    setAttachedFile]    = useState(null);
  const [newFileName,     setNewFileName]     = useState("");
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl,  setInitialFileUrl]  = useState("");

  const fileRef = useRef(null);
  const router  = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(drawingSchema),
    defaultValues,
  });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── FETCH DETAIL ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !drId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.PROJECT.REGISTER.DRAWING_REGISTER.GET_DRAWING_REGISTER_BY_ID}/${drId}`,
          method: "GET",
        });

        const d = res.data;
        const formatted = {
          drNo:               d.drNo               || "",
          drawingNo:          d.drawingNo          || "",
          revision:           d.revision           || "",
          drawingTitle:       d.drawingTitle       || "",
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
          if      (st === "Approved") toast.info("Drawing Register already Approved");
          else if (st === "Rejected") toast.info("Drawing Register already Rejected");
          else                         toast.info("Drawing Register already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Drawing Register");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [drId, mode]);

  // ── EDIT / CANCEL ──────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setAttachedFile(null);
      setNewFileName("");
      setExistingFileUrl(initialFileUrl);
      if (fileRef.current) fileRef.current.value = "";
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  // ── FILE CHANGE ────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachedFile(null);
      setNewFileName("");
      return;
    }
    const allowed = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF, Excel, JPG or PNG files are allowed");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setAttachedFile(file);
    setNewFileName(file.name);
    setExistingFileUrl("");
  };

  // ── BUILD PAYLOAD ──────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();

    if (mode === "create") fd.append("projectCode", projectCode);
    if (v.drawingNo)          fd.append("drawingNo",          v.drawingNo);
    if (v.revision)           fd.append("revision",           v.revision);
    if (v.drawingTitle)       fd.append("drawingTitle",       v.drawingTitle);
    // TODO: referenceOrderNo will later come from a Sale Order lookup API.
    //       For now it is a free-text field per API spec.
    if (v.referenceOrderNo)   fd.append("referenceOrderNo",   v.referenceOrderNo);
    if (v.projectSubLocation) fd.append("projectSubLocation", v.projectSubLocation);
    if (v.segmentLayer)       fd.append("segmentLayer",       v.segmentLayer);
    if (v.receivedDate)       fd.append("receivedDate",       v.receivedDate);
    if (v.receivedTime)       fd.append("receivedTime",       v.receivedTime);
    if (v.receivedBy)         fd.append("receivedBy",         v.receivedBy);
    if (v.deliveredBy)        fd.append("deliveredBy",        v.deliveredBy);
    if (v.deliveryMode)       fd.append("deliveryMode",       v.deliveryMode);
    if (v.deliveryReference)  fd.append("deliveryReference",  v.deliveryReference);
    if (attachedFile)         fd.append("attachment",         attachedFile);

    return fd;
  };

  // ── SAVE (draft / update) ──────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) {
      toast.error("Please select a project first");
      return;
    }

    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating..." : "Saving...");

      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.PROJECT.REGISTER.DRAWING_REGISTER.CREATE
            : `${API_ENDPOINTS.PROJECT.REGISTER.DRAWING_REGISTER.UPDATE_DRAWING_REGISTER_BY_ID}/${drId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });

      if (res?.data?.drNo) setValue("drNo", res.data.drNo);

      if (res?.data?.attachment) {
        const url = res.data.attachment;
        setExistingFileUrl(url);
        setInitialFileUrl(url);
        setAttachedFile(null);
        setNewFileName("");
        if (fileRef.current) fileRef.current.value = "";
      }

      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);

      toast.success(
        mode === "create"
          ? "Drawing Register created successfully"
          : "Drawing Register updated successfully",
        { id: toastId },
      );

      // First-time create → navigate to detail page
      if (mode === "create") {
        const newId = res.data?.drId || res.data?.id;
        if (newId) {
          setTimeout(() => {
            router.push(`/project-management/register/drawing/${newId}`);
          }, 400);
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    }
  };

  // ── SUBMIT FOR APPROVAL ────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!drId) {
      toast.error("Please save first");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Submitting for approval...");
      await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.REGISTER.DRAWING_REGISTER.SUBMIT_DRAWING_REGISTER_BY_ID}/${drId}`,
        method: "POST",
      });
      toast.success("Drawing Register submitted for approval", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    }
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // shared label class
  const L = "h-[30px] flex items-center px-3 bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm w-[210px] min-w-[210px] shrink-0";
  const secHeader = "text-[13px] font-semibold text-[#008080] mb-[3px]";

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4">
      {/* ── DR NO (auto) ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[2px] mb-5">
        <div className={L}>DR No</div>
        <Input
          {...register("drNo")}
          disabled
          placeholder="[Auto]"
          className={`${getInputClass(false, true)} w-[200px] h-[30px]`}
        />
      </div>

      {/* ── SECTION 1: DRAWING DETAILS ─────────────────────────────────── */}
      <div className="mb-5">
        <p className={secHeader}>Drawing Details:</p>
        <div className="space-y-[2px]">

          {/* Drawing No */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Drawing No</div>
            <Input
              {...register("drawingNo")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} flex-1 max-w-[500px] h-[30px] -ml-px`}
            />
          </div>

          {/* Revision */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Revision</div>
            <Input
              {...register("revision")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} w-[180px] h-[30px] -ml-px`}
            />
          </div>

          {/* Drawing Title — full width */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Drawing Title</div>
            <Input
              {...register("drawingTitle")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} flex-1 h-[30px] -ml-px`}
            />
          </div>

        </div>
      </div>

      {/* ── SECTION 2: LOCATION DETAILS ────────────────────────────────── */}
      <div className="mb-5">
        <p className={secHeader}>Location Details:</p>
        <div className="space-y-[2px]">

          {/*
           * TODO: referenceOrderNo will be converted to a <Select> / searchable
           * dropdown once the Sale Order lookup API endpoint is ready.
           * For now it is a plain text input per the current API spec.
           */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Reference Order No</div>
            <Input
              {...register("referenceOrderNo")}
              disabled={disabled}
              placeholder="Select from Sale Order List"
              className={`${getInputClass(false, disabled)} flex-1 max-w-[500px] h-[30px] -ml-px`}
            />
          </div>

          {/* Project Sub-Location */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Project Sub-Location /Unit</div>
            <Input
              {...register("projectSubLocation")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} flex-1 max-w-[500px] h-[30px] -ml-px`}
            />
          </div>

          {/* Segment / Layer */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Segment / Layer</div>
            <Input
              {...register("segmentLayer")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} flex-1 max-w-[500px] h-[30px] -ml-px`}
            />
          </div>

        </div>
      </div>

      {/* ── SECTION 3: RECEIVED DETAILS ────────────────────────────────── */}
      <div className="mb-5">
        <p className={secHeader}>Received Details:</p>
        <div className="space-y-[2px]">

          {/* Received Date */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Received Date</div>
            <Input
              type="date"
              {...register("receivedDate")}
              disabled={disabled}
              className={`${getInputClass(false, disabled)} w-[200px] h-[30px] -ml-px`}
            />
          </div>

          {/* Received Time */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Received Time</div>
            <Input
              type="time"
              {...register("receivedTime")}
              disabled={disabled}
              className={`${getInputClass(false, disabled)} w-[200px] h-[30px] -ml-px`}
            />
          </div>

          {/* Received By */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Received By</div>
            <Input
              {...register("receivedBy")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} flex-1 max-w-[500px] h-[30px] -ml-px`}
            />
          </div>

          {/* Delivered By */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Delivered By</div>
            <Input
              {...register("deliveredBy")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} flex-1 max-w-[500px] h-[30px] -ml-px`}
            />
          </div>

          {/* Delivery Mode — select */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Delivery Mode</div>
            <select
              {...register("deliveryMode")}
              disabled={disabled}
              className={`
                ${getInputClass(false, disabled)}
                flex-1 max-w-[400px] h-[30px] -ml-px
                disabled:opacity-100 disabled:text-black
              `}
            >
              <option value="">Select Delivery Mode</option>
              {DELIVERY_MODE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Delivery Reference */}
          <div className="flex items-center gap-[2px]">
            <div className={L}>Delivery Reference</div>
            <Input
              {...register("deliveryReference")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} flex-1 max-w-[500px] h-[30px] -ml-px`}
            />
          </div>

          {/* ── ATTACHMENT ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 pt-3">
            {/* Purple "Attachment" label button */}
            <button
              type="button"
              className="py-1 px-3.5 rounded-md border border-[#7b68c8] bg-[#b8b3ff] text-[#1f1f1f] text-[14px] font-medium shadow-sm select-none"
            >
              Attachment
            </button>

            {/* Yellow "@" trigger button */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className="py-1 w-[42px] flex items-center justify-center rounded-md border border-[#c96b2c] bg-[#f3d27c] text-[16px] font-bold text-[#1f1f1f] shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition hover:bg-[#ebbe60]"
            >
              @
            </button>

            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />

            {/* New file selected */}
            {newFileName && (
              <span className="flex items-center gap-1 text-[12px] text-gray-700">
                <Paperclip className="w-3 h-3 text-orange-500" />
                {newFileName}
              </span>
            )}

            {/* Existing file download */}
            {!newFileName && existingFileUrl && (
              <a
                href={existingFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download Attachment
              </a>
            )}

            {/* No file in locked state */}
            {!newFileName && !existingFileUrl && disabled && (
              <span className="text-[12px] italic text-gray-400">No attachment</span>
            )}
          </div>

        </div>
      </div>

      {/* ── ACTION BUTTONS ────────────────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#d8e6f0]">
          {/* Save (draft / update) — visible while editing */}
          {isEditing && (
            <SaveDraftButton
              onClick={() => handleSubmit(onSave)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
              confirmationTitle="Save Drawing Register as Draft?"
              confirmationMessage="This entry will be saved as a draft and can be edited or submitted later."
            >
              Save as Draft
            </SaveDraftButton>
          )}

          {/* Submit for approval — visible after save, not while editing */}
          <SaveButton
            onClick={onSubmitForApproval}
            loading={isSubmitting}
            disabled={
              !allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit Drawing Register?"
            confirmationMessage="Once submitted, this entry will be sent for approval."
          >
            Submit
          </SaveButton>

          {/* Edit / Cancel — only in edit mode and not fully submitted */}
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
