"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

import { toast } from "sonner";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { getInputClass } from "@/lib/formStyles";

const schema = z.object({
  unitName: z.string().min(1),
  shortName: z.string().min(1),
  unitType: z.string().min(1),
  categoryId: z.string().min(1),

  parentUnitId: z.string().optional(),
  parentUnitMultiplyFactor: z.string().optional(),
});

export default function UnitForm({ mode = "create",disabled=false, unitId, initialData }) {
  const [isEditing, setIsEditing] = useState(mode === "create");

  const [parentUnits, setParentUnits] = useState([]);
  const [loadingParentUnits, setLoadingParentUnits] = useState(false);

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

    defaultValues: {
      unitName: "",
      shortName: "",
      unitType: "",
      parentUnitId: "",
      parentUnitMultiplyFactor: "",
      categoryId: "",
    },
  });

  const selectedUnitType = watch("unitType");
  const selectedCategory = watch("categoryId");
  const isViewMode = disabled;

  const fieldDisabled = isViewMode || !isEditing || isSubmitting;

  // FETCH PARENT UNITS
  useEffect(() => {
    const fetchUnits = async () => {
      if (selectedUnitType !== "Child" || !selectedCategory) {
        setParentUnits([]);

        setValue("parentUnitId", "");
        setValue("parentUnitMultiplyFactor", "");

        return;
      }

      try {
        setLoadingParentUnits(true);

        const res = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.GET_ALL_UNIT}?unitType=Parent&categoryId=${selectedCategory}`,
        });

        setParentUnits(res.data || []);
      } catch {
        setParentUnits([]);
      } finally {
        setLoadingParentUnits(false);
      }
    };

    fetchUnits();
  }, [selectedUnitType, selectedCategory]);

  // EDIT MODE DATA
  useEffect(() => {
    if ((mode === "edit" || mode==="view") && initialData) {
      reset({
        unitName: initialData.unitName || "",
        shortName: initialData.shortName || "",
        unitType: initialData.unitType || "",

        parentUnitId: initialData.parentUnitId
          ? String(initialData.parentUnitId)
          : "",

        parentUnitMultiplyFactor: initialData.parentUnitMultiplyFactor || "",

        categoryId: initialData.categoryId || "",
      });
    }
  }, [initialData]);

  // CANCEL
  const handleCancel = () => {
    if (!initialData) return;

    reset({
      unitName: initialData.unitName || "",
      shortName: initialData.shortName || "",
      unitType: initialData.unitType || "",

      parentUnitId: initialData.parentUnitId
        ? String(initialData.parentUnitId)
        : "",

      parentUnitMultiplyFactor: initialData.parentUnitMultiplyFactor || "",

      categoryId: initialData.categoryId || "",
    });

    setIsEditing(false);
  };

  // SUBMIT
  const onSubmit = async () => {
    let toastId;

    try {
      toastId = toast.loading("Saving...");

      const v = getValues();

      const payload = {
        unitName: v.unitName,
        shortName: v.shortName,
        unitType: v.unitType,

        parentUnitId: v.unitType === "Child" ? Number(v.parentUnitId) : null,

        parentUnitMultiplyFactor:
          v.unitType === "Child" ? v.parentUnitMultiplyFactor : null,

        categoryId: v.categoryId,
      };

      if (mode === "create") {
        await apiRequest({
          url: API_ENDPOINTS.MASTER.CREATE_UNIT,
          method: "POST",
          data: payload,
        });

        toast.success("Created", {
          id: toastId,
        });

        setIsEditing(false);
      } else {
        await apiRequest({
          url: `${API_ENDPOINTS.MASTER.UPDATE_UNIT_BY_ID}/${unitId}`,
          method: "PUT",
          data: payload,
        });

        toast.success("Updated", {
          id: toastId,
        });

        setIsEditing(false);
      }
    } catch (err) {
      toast.error(err.message || "Failed", {
        id: toastId,
      });
    }
  };

  const label =
    "w-[240px] h-[30px] flex items-center px-3 bg-[#d6e6f2] border border-black rounded-sm text-[13px]";

  const inputClass =
    "border border-[#8f8f8f] h-[30px] text-[13px] font-normal rounded-sm px-2 placeholder:text-[13px] placeholder:font-normal";

  return (
    <div className="p-4 flex flex-col gap-7">
      {/* TOP */}
      <div className="space-y-1">
        {/* UNIT NAME */}
        <div className="flex gap-2">
          <div className={label}>Unit Name</div>

          <Input
            {...register("unitName")}
            disabled={fieldDisabled}
            className={`flex-1 ${getInputClass(errors.unitName,fieldDisabled)}`}
          />
        </div>

        {/* SHORT NAME */}
        <div className="flex gap-2">
          <div className={label}>Short Name</div>

          <Input
            {...register("shortName")}
            disabled={fieldDisabled}
            className={`flex-1 ${getInputClass(errors.shortName,fieldDisabled)}`}
          />
        </div>

        {/* UNIT TYPE */}
        <div className="flex gap-2">
          <div className={label}>Type of Unit</div>

          <select
            {...register("unitType")}
            disabled={fieldDisabled}
            className={`flex-1 ${getInputClass(errors.unitType,fieldDisabled)}`}
          >
            <option value="">SingleSelect</option>

            <option value="Parent">Parent</option>

            <option value="Child">Child</option>
          </select>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="space-y-1">
        {/* CATEGORY */}
        <div className="flex gap-2 items-start">
          <div className={label}>Unit Category</div>

          <div className="flex-1">
            <SearchableSelect
              options={CATEGORY_OPTIONS.unitCategory}
              value={watch("categoryId")}
              onChange={(value) => setValue("categoryId", String(value))}
              placeholder="Select"
              disabled={fieldDisabled}
              labelKey="label"
              valueKey="value"
              searchKeys={["label", "value"]}
            />
          </div>
        </div>

        {/* FACTOR */}
        <div className="flex gap-2">
          <div className={label}>Parent Unit Multiply Factor</div>

          <Input
            {...register("parentUnitMultiplyFactor")}
            disabled={
              fieldDisabled || selectedUnitType !== "Child"
            }
            className={`flex-1 ${getInputClass(errors.shortName,fieldDisabled || selectedUnitType !== "Child")}`}
          />
        </div>

        {/* PARENT UNIT */}
        <div className="flex gap-2 items-start">
          <div className={label}>Parent Unit</div>

          <div className="flex-1">
            <SearchableSelect
              options={parentUnits}
              value={watch("parentUnitId")}
              onChange={(value) => setValue("parentUnitId", String(value))}
              placeholder="Select"
              disabled={
                !isEditing ||
                isSubmitting ||
                selectedUnitType !== "Child" ||
                loadingParentUnits
              }
              labelKey="unitName"
              valueKey="unitId"
              searchKeys={["unitName", "shortName"]}
            />
          </div>
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex justify-end gap-3 mt-10">
        {!isViewMode &&(
        <SaveButton
          onClick={() => handleSubmit(onSubmit)()}
          loading={isSubmitting}
          disabled={!isEditing || isSubmitting}
        />
        )}

        {mode === "edit" && !isViewMode && (
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
