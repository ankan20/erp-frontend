"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Paperclip, Download } from "lucide-react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass } from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";
import SaveDraftButton from "@/components/common/SaveDraftButton";

// ─── ZOD SCHEMA
const concreteSchema = z.object({
  referenceOrderNo: z.string().optional(),
  projectSubLocation: z.string().min(1, "Project Sub Location is required"),
  segment: z.string().min(1, "Segment is required"),
  pouringDate: z.string().min(1, "Pouring Date is required"),
  pouringStartDate: z.string().min(1, "Pouring Start Time is required"),
  pouringEndDate: z.string().min(1, "Pouring Finish Time is required"),
  gradeConcrete: z.string().min(1, "Grade of Concrete is required"),
  concreteVolume: z.string().min(1, "Concrete Volume is required"),
  requisitionNo: z.string().min(1, "Requisition Slip No is required"),
  requisitionBy: z.string().min(1, "Requisition By is required"),
  vehicleNumber: z.string().min(1, "Vehicle Number is required"),
  batchNo: z.string().min(1, "Batch No is required"),
});

const defaultValues = {
  referenceOrderNo: "",
  projectSubLocation: "",
  segment: "",
  pouringDate: "",
  pouringStartDate: "",
  pouringEndDate: "",
  gradeConcrete: "",
  concreteVolume: "",
  requisitionNo: "",
  requisitionBy: "",
  vehicleNumber: "",
  batchNo: "",
};

// ─── FORM SECTIONS CONFIG
const SECTIONS = [
  {
    title: "Concrete Pouring Location",
    fields: [
      {
        label: "Reference Order No",
        name: "referenceOrderNo",
        placeholder: "[Auto Generated]",
        type: "text",
      },
      {
        label: "Project Sub-Location",
        name: "projectSubLocation",
        placeholder: "Enter sub location",
        type: "text",
      },
      {
        label: "Segment / Layer",
        name: "segment",
        placeholder: "Enter segment",
        type: "text",
      },
    ],
  },
  {
    title: "Pouring Details",
    fields: [
      {
        label: "Pouring Date",
        name: "pouringDate",
        placeholder: "",
        type: "date",
      },
      {
        label: "Pouring Start Time",
        name: "pouringStartDate",
        placeholder: "",
        type: "time",
      },
      {
        label: "Pouring Finish Time",
        name: "pouringEndDate",
        placeholder: "",
        type: "time",
      },
    ],
  },
  {
    title: "Grade & Volume Details",
    fields: [
      {
        label: "Grade of Concrete",
        name: "gradeConcrete",
        placeholder: "e.g. M25",
        type: "text",
      },
      {
        label: "Concrete Volume (CuM)",
        name: "concreteVolume",
        placeholder: "Enter volume",
        type: "number",
      },
    ],
  },
  {
    title: "Requisition Details",
    fields: [
      {
        label: "Requisition Slip No",
        name: "requisitionNo",
        placeholder: "Enter requisition no",
        type: "text",
      },
      {
        label: "Requisition By",
        name: "requisitionBy",
        placeholder: "Enter name",
        type: "text",
      },
      {
        label: "TM Vehicle Number",
        name: "vehicleNumber",
        placeholder: "Enter vehicle number",
        type: "text",
      },
      {
        label: "Batch Slip No / Challan",
        name: "batchNo",
        placeholder: "Enter batch no",
        type: "text",
      },
    ],
  },
];

// ─── COMPONENT
export default function ConcreteForm({ mode = "create", registryId }) {
  const isViewMode = mode === "view" || mode === "approver";

  const [isEditing, setIsEditing] = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [isLoading, setIsLoading] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl, setInitialFileUrl] = useState("");

  const fileRef = useRef(null);
  const router = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(concreteSchema),
    defaultValues,
  });

  // fields are editable only when not view-mode, actively editing, and not submitting
  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── FETCH DETAIL (edit/view/approver modes)
  useEffect(() => {
    if (mode === "create" || !registryId) return;

    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        const res = await apiRequest({
          url: `${API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.GET_DETAILS_BY_ID}/${registryId}`,
          method: "GET",
        });

        const d = res.data[0];
        const formatted = {
          referenceOrderNo: d.referenceOrderNo || "",
          projectSubLocation: d.projectSubLocation || "",
          segment: d.segment || "",
          pouringDate: d.pouringDate || "",
          pouringStartDate: d.pouringStartDate || "",
          pouringEndDate: d.pouringEndDate || "",
          gradeConcrete: d.gradeConcrete || "",
          concreteVolume:
            d.concreteVolume != null ? String(d.concreteVolume) : "",
          requisitionNo: d.requisitionNo || "",
          requisitionBy: d.requisitionBy || "",
          vehicleNumber: d.vehicleNumber || "",
          batchNo: d.batchNo || "",
        };

        reset(formatted);
        setInitialData(formatted);

        const url = d.attachBatchFile || "";
        setExistingFileUrl(url);
        setInitialFileUrl(url);
        setIsEditing(false);
      } catch (err) {
        toast.error(err.message || "Failed to load record");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [registryId, mode]);

  // ── EDIT / CANCEL
  const handleEdit = () => {
    if (isSubmitting || isViewMode) return;

    if (isEditing) {
      // CANCEL → restore everything to last-saved state
      if (initialData) reset(initialData);
      setAttachedFile(null);
      setNewFileName("");
      setExistingFileUrl(initialFileUrl);
      if (fileRef.current) fileRef.current.value = "";
      setIsEditing(false);
      return;
    }

    setIsEditing(true);
  };

  // ── FILE CHANGE
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
    setExistingFileUrl(""); // hide the old download link once a new file is chosen
  };

  // ── SUBMIT
  const onSubmit = async () => {
    if (!projectCode) {
      toast.error("Please select a project first");
      return;
    }

    // File is mandatory on create; skip (keep existing) on edit if not changed
    if (mode === "create" && !attachedFile) {
      toast.error("Please attach the batch file before saving");
      return;
    }

    let toastId;
    try {
      toastId = toast.loading(
        mode === "create" ? "Creating..." : "Updating...",
      );
      const v = getValues();

      const formData = new FormData();
      formData.append("projectCode", projectCode);
      // formData.append("referenceOrderNo",   v.referenceOrderNo);
      formData.append("projectSubLocation", v.projectSubLocation);
      formData.append("segment", v.segment);
      formData.append("pouringDate", v.pouringDate);
      formData.append("pouringStartDate", v.pouringStartDate);
      formData.append("pouringEndDate", v.pouringEndDate);
      formData.append("gradeConcrete", v.gradeConcrete);
      formData.append("concreteVolume", v.concreteVolume);
      formData.append("requisitionNo", v.requisitionNo);
      formData.append("requisitionBy", v.requisitionBy);
      formData.append("vehicleNumber", v.vehicleNumber);
      formData.append("batchNo", v.batchNo);

      // Only include file if a new one was selected
      if (attachedFile) {
        formData.append("attachBatchFile", attachedFile);
      }

      if (mode === "create") {
        const res = await apiRequest({
          url: API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.CREATE,
          method: "POST",
          data: formData,
        });

        toast.success("Concrete register created successfully", {
          id: toastId,
        });

        // Navigate to the detail page after create
        const newId = res.data?.id || res.data?.[0]?.id;
        if (newId) {
          setTimeout(() => {
            router.push(`/project-management/register/concrete/${newId}`);
          }, 400);
        }
      } else {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.UPDATE}/${registryId}`,
          method: "PUT",
          data: formData,
        });

        // Update snapshot so Cancel restores to the newly saved state
        setInitialData(getValues());

        if (attachedFile) {
          const updatedUrl = res.data?.attachBatchFile || existingFileUrl;
          setExistingFileUrl(updatedUrl);
          setInitialFileUrl(updatedUrl);
          setAttachedFile(null);
          setNewFileName("");
          if (fileRef.current) fileRef.current.value = "";
        }

        setIsEditing(false);
        toast.success("Concrete register updated successfully", {
          id: toastId,
        });
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    }
  };

  const onSave = async () => {
    if (!projectCode) {
      toast.error("Please select project");
      return;
    }

    let toastId;

    try {
      toastId = toast.loading(
        mode === "create" ? "Saving Draft..." : "Updating Draft...",
      );

      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.CREATE
            : `${API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.UPDATE}/${registryId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });

      const updated = {
        ...getValues(),
        referenceOrderNo:
          res.data[0]?.referenceOrderNo || getValues("referenceOrderNo"),
      };

      reset(updated);
      setInitialData(updated);

      setIsEditing(false);
      setAllowSubmit(true);

      toast.success(mode === "create" ? "Draft saved" : "Draft updated", {
        id: toastId,
      });

      if (mode === "create") {
        const id = res.data?.id;

        if (id) {
          setTimeout(() => {
            router.push(`/project-management/register/concrete/${id}`);
          }, 400);
        }
      }
    } catch (err) {
      toast.error(err.message, {
        id: toastId,
      });
    }
  };

  const onSubmitForApproval = async () => {
    if (!registryId) {
      toast.error("Please save draft first");
      return;
    }

    let toastId;

    try {
      toastId = toast.loading("Submitting...");

      await apiRequest({
        url: `${API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.SUBMIT}/${registryId}`,
        method: "POST",
      });

      setIsSubmitted(true);
      setAllowSubmit(false);
      setIsEditing(false);

      toast.success("Submitted successfully", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Submit failed", { id: toastId });
    }
  };

  const buildPayload = () => {
    const v = getValues();

    const formData = new FormData();

    formData.append("projectCode", projectCode);
    // formData.append("referenceOrderNo", v.referenceOrderNo);
    formData.append("projectSubLocation", v.projectSubLocation);
    formData.append("segment", v.segment);
    formData.append("pouringDate", v.pouringDate);
    formData.append("pouringStartDate", v.pouringStartDate);
    formData.append("pouringEndDate", v.pouringEndDate);
    formData.append("gradeConcrete", v.gradeConcrete);
    formData.append("concreteVolume", v.concreteVolume);
    formData.append("requisitionNo", v.requisitionNo);
    formData.append("requisitionBy", v.requisitionBy);
    formData.append("vehicleNumber", v.vehicleNumber);
    formData.append("batchNo", v.batchNo);

    if (attachedFile) {
      formData.append("attachBatchFile", attachedFile);
    }

    return formData;
  };

  // ── LOADING STATE
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // ── RENDER
  return (
    <div className="p-3 md:p-5">
      <div className="space-y-7">
        {/* ── FIELD SECTIONS  */}
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="text-[#334e75] text-[14px] font-semibold mb-2 uppercase tracking-wide">
              {section.title}
            </h3>

            <div className="space-y-[3px]">
              {section.fields.map(({ label, name, placeholder, type }) => (
                <div key={name}>
                  {/* row: label + input */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-[2px]">
                    {/* label cell */}
                    <div className="bg-[#d6e6f2] border border-[#6f7f8f] text-[13px] h-[30px] px-3 flex items-center rounded-sm w-full sm:w-[230px] shrink-0">
                      {label}
                    </div>

                    {/* input cell */}
                    <Input
                      type={type}
                      step={type === "number" ? "any" : undefined}
                      {...register(name)}
                      disabled={name === "referenceOrderNo" ? true : disabled}
                      placeholder={
                        name === "referenceOrderNo"
                          ? "[Auto Generated]"
                          : placeholder
                      }
                      className={`${getInputClass(
                        !!errors[name],
                        name === "referenceOrderNo" ? true : disabled,
                      )} flex-1 sm:max-w-[400px] -ml-px`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── FILE ATTACHMENT  */}
        <div>
          <h3 className="text-[#334e75] text-[14px] font-semibold mb-2 uppercase tracking-wide">
            Batch Document
          </h3>

          <div className="flex flex-col sm:flex-row sm:items-center gap-[2px]">
            {/* label */}
            <div className="bg-[#d6e6f2] border border-[#6f7f8f] text-[13px] h-[30px] px-3 flex items-center rounded-sm w-full sm:w-[230px] shrink-0">
              Attach Batch Slip / Challan
              {mode === "create" && (
                <span className="text-red-500 ml-1 text-[11px]">*</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 -ml-px">
              {/* choose file button (only when editing) */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-[30px] px-3 rounded-sm border border-[#c96b2c] bg-[#f0cf57] hover:bg-[#e5c547] transition flex items-center gap-1.5 text-[13px] text-[#1f1f1f]"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {newFileName || existingFileUrl
                    ? "Change File"
                    : "Choose File"}
                </button>
              )}

              {/* hidden file input */}
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />

              {/* newly selected file name */}
              {newFileName && (
                <span className="flex items-center gap-1 text-[12px] text-gray-700">
                  <Paperclip className="w-3 h-3 text-orange-500" />
                  {newFileName}
                </span>
              )}

              {/* existing file download (only if no new file chosen) */}
              {!newFileName && existingFileUrl && (
                <a
                  href={existingFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Batch File
                </a>
              )}

              {/* no file placeholder in locked/view state */}
              {!newFileName && !existingFileUrl && disabled && (
                <span className="text-[12px] italic text-gray-400">
                  No file attached
                </span>
              )}
            </div>
          </div>
        </div>
        {/* ── ACTION BUTTONS  */}
        {!isViewMode && (
          <div className="flex justify-end gap-3 pt-3">
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
              disabled={
                !allowSubmit || isEditing || isSubmitted || isSubmitting
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
    </div>
  );
}
