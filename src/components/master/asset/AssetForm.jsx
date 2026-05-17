"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import SearchableSelect from "@/components/common/SearchableSelect";
import { getInputClass } from "@/lib/formStyles";

const assetSchema = z.object({
  itemCategoryId: z.string().min(1),
  ccCodeId: z.string().min(1),
  assetName: z.string().min(1),
  assetDescription: z.string().min(1),
  unit: z.string().min(1),
  hsnSac: z.string().min(1),
  gstPercentage: z.string().min(1),
});

export default function AssetForm({
  mode = "create",
  assetId,
  initialData,
  categories = [],
}) {
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [ccList, setCcList] = useState([]);
  const [loadingCc, setLoadingCc] = useState(false);
  const [unitList, setUnitList] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      assetDisplayCode: "",
      itemCategoryId: "",
      ccCodeId: "",
      assetName: "",
      assetDescription: "",
      unit: "",
      hsnSac: "",
      gstPercentage: "",
    },
  });

  const selectedCategory = watch("itemCategoryId");

  //  FETCH CC LIST BASED ON CATEGORY
  useEffect(() => {
    if (!selectedCategory) return;

    const fetchCC = async () => {
      try {
        setLoadingCc(true);

        const res = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.GET_ALL_CC_CODE}?categoryId=${selectedCategory}&key=asset`,
        });

        setCcList(res.data || []);

        // clear only in create mode
        if (mode === "create") {
          setValue("ccCodeId", "");
        }
      } catch {
        setCcList([]);
      } finally {
        setLoadingCc(false);
      }
    };

    fetchCC();
  }, [selectedCategory]);
  // FETCH UNIT LIST
  useEffect(() => {
    const fetchUnitList = async () => {
      try {
        setLoadingUnits(true);

        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.GET_ALL_UNIT,
        });

        setUnitList(res.data || []);
      } catch (err) {
        console.log(err);
        setUnitList([]);
      } finally {
        setLoadingUnits(false);
      }
    };

    fetchUnitList();
  }, []);

  //  SET EDIT DATA
  useEffect(() => {
    if (
      mode === "edit" &&
      initialData &&
      categories.length &&
      unitList.length
    ) {
      reset({
        ...initialData,
        itemCategoryId: String(initialData.itemCategoryId),
        ccCodeId: String(initialData.ccCodeId || ""),
        unit: String(initialData.unit || ""),
      });
    }
  }, [initialData, categories, unitList]);

  //  CANCEL
  const handleCancel = () => {
    if (!initialData) return;

    reset({
      ...initialData,
      itemCategoryId: String(initialData.itemCategoryId),
      ccCodeId: String(initialData.ccCodeId),
    });

    setIsEditing(false);
  };

  //  SUBMIT
  const onSubmit = async () => {
    let toastId;

    try {
      toastId = toast.loading("Saving...");

      const v = getValues();

      const payload = {
        itemCategoryId: v.itemCategoryId,
        ccCodeId: Number(v.ccCodeId),
        assetName: v.assetName,
        assetDescription: v.assetDescription,
        unit: Number(v.unit),
        hsnSac: v.hsnSac,
        gstPercentage: Number(v.gstPercentage),
      };

      if (mode === "create") {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.CREATE_ASSET,
          method: "POST",
          data: payload,
        });

        const d = res.data[0];
        setValue("assetDisplayCode", d.assetDisplayCode);
        setIsEditing(false);

        toast.success("Created", { id: toastId });
      } else {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.UPDATE_ASSET_BY_ID}/${assetId}`,
          method: "PUT",
          data: payload,
        });

        const d = res.data[0];
        setValue("assetDisplayCode", d.assetDisplayCode);
        setIsEditing(false);

        toast.success("Updated", { id: toastId });
      }
    } catch {
      toast.error("Failed", { id: toastId });
    }
  };

  const label =
    "w-[220px] h-[30px] flex items-center px-3 bg-[#d6e6f2] border border-black rounded-sm text-sm";
  const inputClass = "border border-[#8f8f8f] h-[30px] text-sm rounded-sm px-2";

  return (
    <div className="p-4 flex flex-col gap-7">
      {/* CODE */}
      <div className="flex gap-2">
        <div className={label}>Asset Code</div>
        <Input
          {...register("assetDisplayCode")}
          disabled
          className={`${getInputClass(false, true)} w-[200px]`}
          placeholder="[Auto]"
        />
      </div>
      <div className="space-y-1">
        {/* CATEGORY */}
        <div className="flex gap-2">
          <div className={label}>Item Category</div>
          <select
            {...register("itemCategoryId")}
            disabled={!isEditing || isSubmitting}
            className={`flex-1 ${getInputClass(errors.itemCategoryId, !isEditing || isSubmitting)}`}
          >
            <option value="">Select</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* CC */}
        <div className="flex gap-2 items-start">
          <div className={label}>CC Category</div>

          <div className="flex-1">
            <SearchableSelect
              options={ccList}
              value={watch("ccCodeId")}
              onChange={(value) => setValue("ccCodeId", String(value))}
              placeholder={loadingCc ? "Loading..." : "Select CC"}
              disabled={!isEditing || isSubmitting || loadingCc}
              labelKey="ccName"
              valueKey="ccId"
              searchKeys={["ccName", "ccCode"]}
            />
          </div>
        </div>
      </div>
      <div className="space-y-1">
        {/* NAME */}
        <div className="flex gap-2">
          <div className={label}>Asset Name</div>
          <Input
            {...register("assetName")}
            disabled={!isEditing || isSubmitting}
            className={`flex-1 ${getInputClass(errors.assetName, !isEditing || isSubmitting)}`}
          />
        </div>

        {/* DESC */}
        <div className="flex gap-2 items-start">
          <div className={label}>Asset Description</div>
          <textarea
            {...register("assetDescription")}
            disabled={!isEditing || isSubmitting}
            className={`flex-1 ${getInputClass(errors.assetDescription, !isEditing || isSubmitting)}  px-2 py-1 min-h-[80px] resize-none
                 disabled:cursor-not-allowed `}
          />
        </div>
      </div>

      {/* BOTTOM */}
      <div className="grid md:grid-cols-2 gap-x-10 mt-7">
        <div className="space-y-1">
          {/* <div className="flex gap-2">
            <div className={label}>Unit</div>
            <Input
              {...register("unit")}
              disabled={!isEditing || isSubmitting}
              className={`flex-1 ${errors.unit && "border-red-500"} ${inputClass}`}
            />
          </div> */}
          <div className="flex gap-2 items-start">
            <div className={label + " h-[30px]"}>Unit</div>

            <div className="flex-1">
              <SearchableSelect
                options={unitList}
                value={watch("unit")}
                onChange={(value) => setValue("unit", String(value))}
                placeholder={loadingUnits ? "Loading..." : "Select Unit"}
                searchPlaceholder="Search by short/unit/parent/category name"
                disabled={!isEditing || isSubmitting || loadingUnits}
                labelKey="shortName"
                valueKey="unitId"
                dropdownPosition="up"
                searchKeys={[
                  "shortName",
                  "unitName",
                  "parentUnitName",
                  "categoryName",
                ]}
                className={`
                    ${
                      errors.unit &&
                      "border-red-500 bg-red-50 focus-visible:ring-red-500"
                    }
                    
                  `}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className={label}>HSN/SAC</div>
            <Input
              {...register("hsnSac")}
              disabled={!isEditing || isSubmitting}
              className={`flex-1 ${getInputClass(errors.hsnSac, !isEditing || isSubmitting)}`}
            />
          </div>

          <div className="flex gap-2">
            <div className={label}>GST %</div>
            <Input
              {...register("gstPercentage")}
              disabled={!isEditing || isSubmitting}
              className={`flex-1 ${getInputClass(errors.gstPercentage, !isEditing || isSubmitting)}`}
            />
          </div>
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex justify-end gap-3 mt-10">
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
