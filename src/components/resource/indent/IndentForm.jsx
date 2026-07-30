"use client";

import { useEffect, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import FileUpload, { ACCEPT_ALL, TYPES_ALL } from "@/components/common/FileUpload";

import { Input } from "@/components/ui/input";

import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { getInputClass } from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";

import IndentItemsTable from "@/components/resource/indent/IndentItemsTable";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { useRouter } from "next/navigation";

const indentSchema = z.object({
  categoryCode: z.string().min(1),
  priority: z.string().min(1),
  requiredWithin: z.string().min(1),
  indentDate: z.string().min(1),
  indentPlacedBy: z.string().min(1),
  siteRegSerialNo: z.string().min(1),
  saleOrderNo: z.string().min(1),
  remarks: z.string().optional(),

  items: z.array(
    z.object({
      itemCode: z.string().min(1),
      itemName: z.string().optional(),
      qty: z.coerce.number().min(1),
      ammenmendQty: z.any().optional(),
      location: z.string().min(2),
      note: z.string().optional(),
      unit: z.string().optional(),
    }),
  ),
});

const defaultItemRow = {
  itemCode: "",
  itemName: "",
  qty: "",
  ammenmendQty: "",
  location: "",
  note: "",
  unit: "",
};

const defaultValues = {
  indentNo: "",
  categoryCode: "",
  priority: "",
  requiredWithin: "",
  indentDate: "",
  indentPlacedBy: "",
  siteRegSerialNo: "",
  saleOrderNo: "",
  remarks: "",
  items: [defaultItemRow],
};

export default function IndentForm({
  mode = "create",
  canApprove = false,
  indentId,
  onUuid,
  onAfterSubmit,
}) {
  const isViewMode = mode === "view" || mode === "approver";

  const [isEditing, setIsEditing] = useState(mode === "create");

  const [initialData, setInitialData] = useState(null);

  const [itemsOptions, setItemsOptions] = useState([]);

  const [attachedFile, setAttachedFile] = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl, setInitialFileUrl] = useState("");
  const [fileResetKey, setFileResetKey] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  const [isSubmitted, setIsSubmitted] = useState(false);

  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const router = useRouter();

  const {
    register,
    control,
    reset,
    setValue,
    getValues,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(indentSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  const projectInfo = getLocalStorage("projectInfo");

  const projectCode = projectInfo?.projectCode || "";

  const fetchItemsByCategory = async (category, existingItems = []) => {
    if (!category) return;

    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.GET_ITEMS_BY_CATEGORY}?categoryCode=${category}`,
        method: "GET",
      });

      const fetchedItems = res.data || [];

      setItemsOptions(fetchedItems);

      if (existingItems.length > 0) {
        existingItems.forEach((item, index) => {
          const matched = fetchedItems.find(
            (row) => row.itemCode === item.itemCode,
          );

          if (matched) {
            setValue(`items.${index}.itemName`, matched.itemName);

            setValue(`items.${index}.unit`, matched.unit || "");
          }
        });
      }
    } catch (err) {
      toast.error("Failed to fetch items");
    }
  };

  useEffect(() => {
    if (mode === "create" || !indentId) return;

    const fetchIndent = async () => {
      try {
        setIsLoading(true);

        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.GET_INDENT_BY_ID}${indentId}`,
          method: "GET",
        });

        const data = res.data;

        const formattedData = {
          indentNo: data.indentNo || "",

          categoryCode: data.categoryCode || "",

          priority: data.priority || "",

          requiredWithin: data.requiredWithin || "",

          indentDate: data.indentDate || "",

          indentPlacedBy: data.indentPlacedBy || "",

          siteRegSerialNo: data.siteRegSerialNo || "",

          saleOrderNo: data.saleOrderNo || "",

          remarks: data.remarks || "",

          items: data.items?.map((item) => ({
            itemCode: item.itemCode || "",

            itemName: item.itemName || "",

            qty: item.qty || "",

            ammenmendQty: item.ammenmendQty || "",

            location: item.location || "",

            note: item.note || "",

            unit: item.unit || "",
          })) || [defaultItemRow],
        };

        reset(formattedData);

        setInitialData(formattedData);
        if (data.uuid && onUuid) onUuid(data.uuid);
        setExistingFileUrl(data.indentFile || "");
        setInitialFileUrl(data.indentFile || "");
        // data.indentStatus === "Submitted" || data.indentStatus==="Approved"
        if (
          data.indentStatus !== "Reback" &&
          data.indentStatus !== "Draft" &&
          mode === "edit"
        ) {
          setIsSubmitted(true);

          setIsEditing(false);
          let msg;
          if (data.indentStatus === "Rejected")
            msg = "Indent already Rejected.";
          else if (data.indentStatus === "Approved")
            msg = "Indent already Approved.";
          else msg = "Indent already Submitted";
          toast.info(msg || "Indent already submitted");
        } else {
          setIsEditing(false);

          setAllowSubmit(true);
        }

        if (data.categoryCode) {
          await fetchItemsByCategory(data.categoryCode, formattedData.items);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load indent");
        setIsSubmitted(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIndent();
  }, [indentId, mode]);


  const handleCategoryChange = async (categoryCode) => {
    setValue("categoryCode", categoryCode);

    const currentItems = getValues("items");

    const updatedItems = currentItems.map((item) => ({
      ...item,
      itemCode: "",
      itemName: "",
      unit: "",
    }));

    setValue("items", updatedItems);

    await fetchItemsByCategory(categoryCode);
  };

  const buildPayload = () => {
    const values = getValues();

    const formData = new FormData();

    formData.append("projectCode", projectCode);

    formData.append("categoryCode", values.categoryCode);

    formData.append("priority", values.priority);

    formData.append("requiredWithin", values.requiredWithin);

    formData.append("indentDate", values.indentDate);

    formData.append("indentPlacedBy", values.indentPlacedBy);

    formData.append("siteRegSerialNo", values.siteRegSerialNo);

    formData.append("saleOrderNo", values.saleOrderNo);

    formData.append("remarks", values.remarks?.trim() || "");

    formData.append(
      "items",
      JSON.stringify(
        values.items.map((item) => ({
          itemCode: item.itemCode,

          qty: Number(item.qty),

          location: item.location?.trim() || "",

          note: item.note?.trim() || "",
        })),
      ),
    );

    if (attachedFile) {
      formData.append("indentFile", attachedFile);
    }

    return formData;
  };

  const handleSaveDraft = async () => {
    let toastId;
    if (!projectCode) {
      toast.error("Please select a project first");

      return;
    }

    try {
      toastId = toast.loading("Saving draft...");

      const payload = buildPayload();

      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.CREATE_INDENT
            : `${API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.UPDATE_INDENT_BY_ID}${indentId}`,

        method: mode === "create" ? "POST" : "PUT",

        data: payload,
      });

      if (res?.data?.indentNo) {
        setValue("indentNo", res.data.indentNo);
      }
      if (res?.data?.uuid && onUuid) onUuid(res.data.uuid);
      if (res?.data?.indentFile) {
        setExistingFileUrl(res.data.indentFile);
        setInitialFileUrl(res.data.indentFile);
        setAttachedFile(null);
        setFileResetKey((k) => k + 1);
      }

      setInitialData(getValues());

      setIsEditing(false);

      setAllowSubmit(true);

      toast.success("Draft saved successfully", {
        id: toastId,
      });
      if(mode ==="create" && res.data.indentId){
        setTimeout(() => {
        router.push(
          `/resource-management/procurement/indent/${res.data.indentId}`,
        );
      }, 400);
      }

      // router.push("/resource-management/procurement/indent")
    } catch (err) {
      toast.error(err.message || "Failed", {
        id: toastId,
      });
    }
  };

  const onSubmit = async () => {
    let toastId;
    if (!projectCode) {
      toast.error("Please select a project first");

      return;
    }

    try {
      toastId = toast.loading("Submitting indent...");

      const res = await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.SUBMIT_INDENT_BY_ID}${indentId}`,
        method: "POST",
      });

      toast.success("Indent submitted successfully", {
        id: toastId,
      });

      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();

      // router.push("/resource-management/procurement/indent")
    } catch (err) {
      toast.error(err.message || "Failed", {
        id: toastId,
      });
    }
  };

  const handleEdit = () => {
    if (isSubmitting || isViewMode) return;

    // CANCEL
    if (isEditing) {
      if (initialData) {
        reset(initialData);
      }

      setAttachedFile(null);
      setExistingFileUrl(initialFileUrl);
      setFileResetKey((k) => k + 1);

      setIsEditing(false);

      setAllowSubmit(true);

      return;
    }

    // EDIT
    setIsEditing(true);

    setAllowSubmit(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  const labelClass =
    "w-[160px] shrink-0 px-3 h-[34px] flex items-center bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm";

  return (
    <div className="p-3 ">
      <div className="md:flex gap-3 items-start">
        {/* LEFT PANEL */}
        {sidebarOpen && (
        <div className="w-full md:w-[400px] shrink-0 bg-[#f7f7f7] p-3 pl-0 pt-0 overflow-x-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-y-0">

          {/* CATEGORY */}
          <div className="flex items-center">
            <div className={labelClass}>Category</div>
            <select
              value={watch("categoryCode")}
              disabled={disabled}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={`${getInputClass(errors.categoryCode, disabled)} flex-1 min-w-0 disabled:opacity-100 disabled:text-black`}
            >
              <option value="">Select Category</option>
              {CATEGORY_OPTIONS.itemCategory.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {/* INDENT NO */}
          <div className="flex items-center">
            <div className={labelClass}>Indent No</div>
            <Input {...register("indentNo")} disabled className={`${getInputClass(false, true)} flex-1 min-w-0`} />
          </div>

          {/* INDENT DATE */}
          <div className="flex items-center">
            <div className={labelClass}>Indent Date</div>
            <Input type="date" {...register("indentDate")} disabled={disabled} className={`${getInputClass(errors.indentDate, disabled)} flex-1 min-w-0`} />
          </div>

          {/* PRIORITY */}
          <div className="flex items-center">
            <div className={labelClass}>Priority</div>
            <select
              {...register("priority")}
              disabled={disabled}
              className={`${getInputClass(errors.priority, disabled)} flex-1 min-w-0 disabled:opacity-100 disabled:text-black`}
            >
              <option value="">Select Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>
          </div>

          {/* REQUIRED WITHIN */}
          <div className="flex items-center">
            <div className={labelClass}>Required Within</div>
            <Input type="date" {...register("requiredWithin")} disabled={disabled} className={`${getInputClass(errors.requiredWithin, disabled)} flex-1 min-w-0`} />
          </div>

          {/* INDENT PLACED BY */}
          <div className="flex items-center">
            <div className={labelClass}>Indent Placed By</div>
            <Input {...register("indentPlacedBy")} disabled={disabled} className={`${getInputClass(errors.indentPlacedBy, disabled)} flex-1 min-w-0`} />
          </div>

          {/* SITE REG SERIAL */}
          <div className="flex items-center">
            <div className={labelClass}>Site Reg Serial No</div>
            <Input {...register("siteRegSerialNo")} disabled={disabled} className={`${getInputClass(errors.siteRegSerialNo, disabled)} flex-1 min-w-0`} />
          </div>

          {/* SALE ORDER */}
          <div className="flex items-center">
            <div className={labelClass}>Sale Order No</div>
            <Input {...register("saleOrderNo")} disabled={disabled} className={`${getInputClass(errors.saleOrderNo, disabled)} flex-1 min-w-0`} />
          </div>

          {/* REMARKS */}
          <div className="flex items-start">
            <div className={labelClass}>Remarks</div>
            <div className="flex-1 min-w-0">
              <ExpandableTextField
                value={watch("remarks")}
                onChange={(val) => setValue("remarks", val)}
                disabled={disabled}
                error={errors.remarks}
                title="Remarks"
                placeholder="Enter remarks"
                subHeader="Provide additional remarks or important notes."
                minHeight="min-h-[36px]"
                modalHeight="min-h-[220px]"
              />
            </div>
          </div>

          </div>{/* end grid */}

          {/* ATTACHMENT */}
          <div className="mt-4">
            <FileUpload
              label="Attached Indent Slip"
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
        )}

        {/* DIVIDER + COLLAPSE BUTTON — md only */}
        <div className="hidden md:flex flex-col items-center self-stretch">
          <div className="flex-1 w-px bg-sky-300" />
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Collapse details panel" : "Expand details panel"}
            className={`flex items-center justify-center w-5 h-10 rounded border transition shrink-0 my-1 ${
              sidebarOpen
                ? "bg-sky-100 border-sky-300 hover:bg-sky-200 text-sky-600"
                : "bg-[#7fc3d4] border-[#4a9fb5] hover:bg-[#6ab8cb] text-white"
            }`}
          >
            {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1 w-px bg-sky-300" />
        </div>

        <IndentItemsTable
          fields={fields}
          register={register}
          setValue={setValue}
          watch={watch}
          append={append}
          remove={remove}
          errors={errors}
          isEditing={isEditing}
          isSubmitting={isSubmitting || isSubmitted}
          itemsOptions={itemsOptions}
          projectCode={projectCode}
        />
      </div>

      {!isViewMode && (
        <div className="flex justify-end gap-3 mt-6">
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
            disabled={
              !allowSubmit ||
              isEditing ||
              isSubmitted ||
              isSubmitting ||
              mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit Indent?"
            confirmationMessage="Once submitted, this indent will be processed."
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
