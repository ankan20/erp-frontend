"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import SearchableSelect from "@/components/common/SearchableSelect";

const schema = z.object({
  itemCategoryId: z.string().min(1, "Required"),
  ccCodeId: z.string().min(1, "Required"),
  itemName: z.string().min(1, "Required"),
  itemDescription: z.string().min(1, "Required"),
  unit: z.string().min(1, "Required"),
  hsnSac: z.string().min(1, "Required"),
  gstPercentage: z.string().min(1, "Required"),
});

export default function ItemForm({
  mode = "create",
  itemId,
  initialData,
  categories = [],
}) {
  const [isEditing, setIsEditing] = useState(mode === "create");

  const [ccList, setCcList] = useState([]);
  // const [filteredCcList, setFilteredCcList] = useState([]);
  // const [ccSearch, setCcSearch] = useState("");
  const [loadingCc, setLoadingCc] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const selectedCategory = watch("itemCategoryId");

  // EDIT MODE DATA SYNC
  useEffect(() => {
    if (mode === "edit" && initialData && categories.length) {
      reset({
        ...initialData,
        itemCategoryId: String(initialData.itemCategoryId),
        ccCodeId: String(initialData.ccCodeId),
      });
    }
  }, [initialData, categories]);

  // FETCH CC LIST
  useEffect(() => {
    const fetchCcList = async () => {
      if (!selectedCategory) {
        setCcList([]);
        // setFilteredCcList([]);
        return;
      }

      try {
        setLoadingCc(true);

        const res = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.GET_ALL_CC_CODE}?categoryId=${selectedCategory}`,
        });

        const data = res.data || [];

        setCcList(data);
        // setFilteredCcList(data);

        // reset cc only in create mode
        if (mode === "create") {
          setValue("ccCodeId", "");
        }
      } catch (err) {
        console.log(err);
        setCcList([]);
        // setFilteredCcList([]);
      } finally {
        setLoadingCc(false);
      }
    };

    fetchCcList();
  }, [selectedCategory]);

  // SEARCH FILTER
  // useEffect(() => {
  //   if (!ccSearch.trim()) {
  //     setFilteredCcList(ccList);
  //     return;
  //   }

  //   const search = ccSearch.toLowerCase();

  //   const filtered = ccList.filter((item) => {
  //     return (
  //       item.ccName?.toLowerCase().includes(search) ||
  //       item.ccCode?.toLowerCase().includes(search)
  //     );
  //   });

  //   setFilteredCcList(filtered);
  // }, [ccSearch, ccList]);

  // SUBMIT
  const onSubmit = async () => {
    let toastId;

    try {
      toastId = toast.loading("Saving...");

      const v = getValues();

      const payload = {
        itemCategoryId: v.itemCategoryId,
        ccCodeId: Number(v.ccCodeId),
        itemName: v.itemName,
        itemDescription: v.itemDescription,
        unit: Number(v.unit),
        hsnSac: v.hsnSac,
        gstPercentage: Number(v.gstPercentage),
      };

      if (mode === "create") {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.CREATE_ITEM,
          method: "POST",
          data: payload,
        });

        const d = res.data[0];

        setValue("itemCode", d.itemCode);

        setIsEditing(false);

        toast.success("Created", { id: toastId });
      } else {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.UPDATE_ITEM_BY_ID}/${itemId}`,
          method: "PUT",
          data: payload,
        });

        const d = res.data[0];

        setValue("itemCode", d.itemCode);

        setIsEditing(false);

        toast.success("Updated", { id: toastId });
      }
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  };

  const handleCancel = () => {
    if (!initialData) return;

    reset({
      ...initialData,
      itemCategoryId: String(initialData.itemCategoryId),
      ccCodeId: String(initialData.ccCodeId),
    });

    setIsEditing(false);
  };

  const label =
    "w-[220px] px-3 py-1 bg-[#d6e6f2] border border-black rounded-sm text-sm";

  const inputClass =
    "border border-[#8f8f8f] h-[30px] text-[14px] font-normal rounded-sm px-2 placeholder:text-[14px] placeholder:font-normal";

  return (
    <div className="p-4 flex flex-col gap-7">
      {/* ITEM CODE */}
      <div className="flex gap-2">
        <div className={label}>Item Code</div>

        <Input
          {...register("itemCode")}
          disabled
          className="w-[200px] border border-[#8f8f8f]"
          placeholder="[Auto]"
        />
      </div>

      <div className="space-y-1">
        {/* CATEGORY */}
        <div className="flex flex-col">
          <div className="flex gap-2">
            <div className={label}>Item Category</div>

            <select
              {...register("itemCategoryId")}
              disabled={!isEditing || isSubmitting}
              className={`flex-1 ${inputClass} ${errors.itemCategoryId && "border-red-500"
                } disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed`}
            >
              <option value="">Select</option>

              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CC */}
        <div className="flex flex-col">
          <div className="flex gap-2 items-start">

            <div className={label + " h-[30px]"}>CC Name</div>

            <div className="flex-1">

              <SearchableSelect
                options={ccList}
                value={watch("ccCodeId")}
                onChange={(value) =>
                  setValue("ccCodeId", String(value))
                }
                placeholder={
                  loadingCc ? "Loading..." : "Select CC"
                }
                disabled={
                  !isEditing || isSubmitting || loadingCc
                }
                labelKey="ccName"
                valueKey="ccId"
                searchKeys={["ccName", "ccCode"]}
                className={`${errors.ccCodeId && "border-red-500"}`}
              />

            </div>

          </div>
        </div>
      </div>

      <div className="space-y-1">
        {/* ITEM NAME */}
        <div className="flex flex-col">
          <div className="flex gap-2">
            <div className={label}>Item Name</div>

            <Input
              {...register("itemName")}
              disabled={!isEditing || isSubmitting}
              className={`flex-1 ${inputClass} ${errors.itemName && "border-red-500"}`}
            />
          </div>
        </div>

        {/* DESCRIPTION */}
        <div className="flex flex-col">
          <div className="flex gap-2 items-start">
            <div className={label}>Item Description</div>

            <textarea
              {...register("itemDescription")}
              disabled={!isEditing || isSubmitting}
              className={`
                flex-1
                border border-[#8f8f8f]
                text-sm
                rounded-sm
                px-2 py-1
                min-h-[80px]
                resize-none
                disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                ${errors.itemDescription && "border-red-500"}
              `}
              placeholder="Text"
            />
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 mt-7">
        <div className="space-y-1">
          {/* UNIT */}
          <div className="flex flex-col">
            <div className="flex gap-2">
              <div className={label}>Unit</div>

              <Input
                {...register("unit")}
                disabled={!isEditing || isSubmitting}
                className={`flex-1 ${inputClass} ${errors.unit && "border-red-500"}`}
              />
            </div>
          </div>

          {/* HSN */}
          <div className="flex flex-col">
            <div className="flex gap-2">
              <div className={label}>HSN/SAC</div>

              <Input
                {...register("hsnSac")}
                disabled={!isEditing || isSubmitting}
                className={`flex-1 ${inputClass} ${errors.hsnSac && "border-red-500"}`}
              />
            </div>
          </div>

          {/* GST */}
          <div className="flex flex-col">
            <div className="flex gap-2">
              <div className={label}>GST %</div>

              <Input
                {...register("gstPercentage")}
                disabled={!isEditing || isSubmitting}
                className={`flex-1 ${inputClass} ${errors.gstPercentage && "border-red-500"}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex justify-end gap-3 mt-4">
        <SaveButton
          onClick={() => handleSubmit(onSubmit)()}
          loading={isSubmitting}
          disabled={!isEditing || isSubmitting}
        />

        {mode === "edit" && (
          <EditButton
            onClick={isEditing ? handleCancel : () => setIsEditing(true)}
            disabled={isSubmitting}
          >
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        )}
      </div>
    </div>
  );
}
