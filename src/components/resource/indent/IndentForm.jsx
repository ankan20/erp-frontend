"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Paperclip } from "lucide-react";

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
}) {
  const isViewMode = mode === "view" || mode === "approver";

  const [isEditing, setIsEditing] = useState(mode === "create");

  const [initialData, setInitialData] = useState(null);

  const [itemsOptions, setItemsOptions] = useState([]);

  const [fileName, setFileName] = useState("");

  const [fileUrl, setFileUrl] = useState("");

  const [attachedFile, setAttachedFile] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  const [isSubmitted, setIsSubmitted] = useState(false);

  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");

  const [initialFileData, setInitialFileData] = useState({
    fileName: "",
    fileUrl: "",
  });

  const fileRef = useRef(null);

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
        url: `${API_ENDPOINTS.RESOURCE.INDENT.GET_ITEMS_BY_CATEGORY}?categoryCode=${category}`,
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
          url: `${API_ENDPOINTS.RESOURCE.INDENT.GET_INDENT_BY_ID}${indentId}`,
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
        setFileUrl(data.indentFile || "");

        const extractedFileName = data.indentFile?.split("/")?.pop() || "";

        setFileName("");

        setInitialFileData({
          fileName: extractedFileName,
          fileUrl: data.indentFile || "",
        });
        // data.indentStatus === "Submitted" || data.indentStatus==="Approved"
        if (data.indentStatus !== "Draft" && mode === "edit") {
          setIsSubmitted(true);

          setIsEditing(false);
          let msg =
            data.indentStatus === "Approved"
              ? "Indent already Approved"
              : "Indent already submitted";
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

    formData.append("remarks", values.remarks || "");

    formData.append(
      "items",
      JSON.stringify(
        values.items.map((item) => ({
          itemCode: item.itemCode,

          qty: Number(item.qty),

          location: item.location,

          note: item.note,
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
            ? API_ENDPOINTS.RESOURCE.INDENT.CREATE_INDENT
            : `${API_ENDPOINTS.RESOURCE.INDENT.UPDATE_INDENT_BY_ID}${indentId}`,

        method: mode === "create" ? "POST" : "PUT",

        data: payload,
      });

      if (res?.data?.indentNo) {
        setValue("indentNo", res.data.indentNo);
      }
      if (res?.data?.indentFile) {
        setFileUrl(res.data.indentFile);

        setInitialFileData({
          fileName: res.data.indentFile?.split("/")?.pop() || "",
          fileUrl: res.data.indentFile,
        });
      }

      setInitialData(getValues());

      setIsEditing(false);

      setAllowSubmit(true);

      toast.success("Draft saved successfully", {
        id: toastId,
      });

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
        url: `${API_ENDPOINTS.RESOURCE.INDENT.SUBMIT_INDENT_BY_ID}${indentId}`,

        method: "POST",
      });

      toast.success("Indent submitted successfully", {
        id: toastId,
      });

      setIsSubmitted(true);

      setIsEditing(false);

      setAllowSubmit(false);

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

      setFileUrl(initialFileData.fileUrl);

      setFileName("");

      if (fileRef.current) {
        fileRef.current.value = "";
      }

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
    "w-[180px] px-3 py-1 bg-[#d6e6f2] border border-[#6f7f8f] text-md rounded-sm";

  return (
    <div className="p-3 ">
      <div className="md:flex gap-3 items-start">
        {/* LEFT PANEL */}

        <div className="w-[400px] bg-[#f7f7f7] p-3 pl-0 pt-0 ">
          {/* CATEGORY */}
          <div className="md:flex md:items-center">
            <div className={labelClass}>Category</div>

            <select
              value={watch("categoryCode")}
              disabled={disabled}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={`${getInputClass(
                errors.categoryCode,
                disabled,
              )} flex-1 -ml-px disabled:opacity-100 disabled:text-black`}
            >
              <option value="">Select Category</option>

              {CATEGORY_OPTIONS.itemCategory.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            {/* INDENT NO */}
            <div className="md:flex md:items-center">
              <div className={`${labelClass} w-[180px]`}>Indent No</div>

              <Input
                {...register("indentNo")}
                disabled
                className={`${getInputClass(false, true)} flex-1 -ml-px`}
              />
            </div>

            {/* INDENT DATE */}
            <div className="md:flex md:items-center">
              <div className={labelClass}>Indent Date</div>

              <Input
                type="date"
                {...register("indentDate")}
                disabled={disabled}
                className={`${getInputClass(
                  errors.indentDate,
                  disabled,
                )} flex-1 -ml-px`}
              />
            </div>
          </div>

          <div className="mt-4">
            {/* PRIORITY */}
            <div className="md:flex md:items-center">
              <div className={labelClass}>Priority</div>

              <select
                {...register("priority")}
                disabled={disabled}
                className={`${getInputClass(
                  errors.priority,
                  disabled,
                )} flex-1 -ml-px disabled:opacity-100 disabled:text-black`}
              >
                <option value="">Select Priority</option>

                <option value="High">High</option>

                <option value="Medium">Medium</option>
              </select>
            </div>

            {/* REQUIRED WITHIN */}
            <div className="md:flex md:items-center">
              <div className={labelClass}>Required Within</div>

              <Input
                type="date"
                {...register("requiredWithin")}
                disabled={disabled}
                className={`${getInputClass(
                  errors.requiredWithin,
                  disabled,
                )} flex-1 -ml-px`}
              />
            </div>
          </div>

          <div className="mt-4">
            {/* INDENT PLACED BY */}
            <div className="md:flex md:items-center">
              <div className={labelClass}>Indent Placed By</div>

              <Input
                {...register("indentPlacedBy")}
                disabled={disabled}
                className={`${getInputClass(
                  errors.indentPlacedBy,
                  disabled,
                )} flex-1 -ml-px`}
              />
            </div>

            {/* SITE REG SERIAL */}
            <div className="md:flex md:items-center">
              <div className={labelClass}>Site Reg Serial No</div>

              <Input
                {...register("siteRegSerialNo")}
                disabled={disabled}
                className={`${getInputClass(
                  errors.siteRegSerialNo,
                  disabled,
                )} flex-1 -ml-px`}
              />
            </div>

            {/* SALE ORDER */}
            <div className="md:flex md:items-center">
              <div className={labelClass}>Sale Order No</div>

              <Input
                {...register("saleOrderNo")}
                disabled={disabled}
                className={`${getInputClass(
                  errors.saleOrderNo,
                  disabled,
                )} flex-1 -ml-px`}
              />
            </div>
          </div>

          {/* REMARKS */}
          <div className="md:flex md:items-start">
            <div className={labelClass}>Remarks</div>

            <textarea
              {...register("remarks")}
              disabled={disabled}
              className={`
            ${getInputClass(errors.remarks, disabled)}
            flex-1
            -ml-px
            min-h-[70px]
            p-2
          `}
            />
          </div>

          {/* ATTACHMENT */}
          <div className="md:mt-20">
            <div className="flex items-center gap-2">
              {/* FILE NAME BUTTON */}
              <button
                type="button"
                disabled={disabled}
                className="py-1 px-3.5 rounded-md border border-[#c96b2c] bg-[#e9a06d] text-[#1f1f1f] text-[16px] font-md shadow-sm disabled:opacity-60"
              >
                Attached Indent Slip
              </button>

              {/* OPEN FILE BUTTON */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileRef.current?.click()}
                className="py-1 w-[48px] flex items-center justify-center rounded-md border border-[#c96b2c] bg-[#f3d27c] text-[16px] font-bold text-[#1f1f1f] shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-none"
              >
                @
              </button>

              {/* HIDDEN INPUT */}
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setAttachedFile(null);
                    setFileName("");
                    return;
                  }
                  const allowedTypes = [
                    "application/pdf",
                    "application/vnd.ms-excel",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  ];

                  if (!allowedTypes.includes(file.type)) {
                    alert("Only PDF or Excel files are allowed");
                    return;
                  }

                  setAttachedFile(file);
                  setFileName(file.name);
                  setFileUrl("");
                }}
              />
            </div>

            {/* FILE NAME */}
            {fileName && (
              <div className="mt-2 text-[12px] text-gray-700 flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {fileName}
              </div>
            )}

            {/* DOWNLOAD */}
            {!fileName && fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-[12px] text-blue-600 hover:underline flex items-center gap-1"
              >
                <Paperclip className="w-3 h-3" />
                Download Attached File
              </a>
            )}
          </div>
        </div>

        <div className="w-[1px] h-[30vw] bg-sky-300" />

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
        />
      </div>

      {!isViewMode && (
        <div className="flex justify-end gap-3 pt-4 md:pt-0">
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
