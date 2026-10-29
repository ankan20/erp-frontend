"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getInputClass } from "@/lib/formStyles";
import { zodDate } from "@/lib/dateUtils";
import {
  INDIAN_STATES,
  getStateCodeByName,
} from "@/config/indianStates.config";

const projectSchema = z.object({
  projectCode: z.string().min(1, "Required"),
  clientName: z.string().min(1, "Required"),
  gstn: z.string().min(1, "Required"),

  stateCode: z.string().optional(),
  state: z.string().optional(),

  registeredAddress: z.string().min(1, "Required"),
  projectName: z.string().min(1, "Required"),
  projectDetails: z.string().min(1, "Required"),

  projectManager: z.string().min(1, "Required"),
  projMgmtContactNumber: z.string().regex(/^[0-9]{10}$/, "Invalid number"),
  projMgmtEmailId: z.string().email("Invalid email"),

  commercialManager: z.string().optional(),
  commMgmtContactNumber: z.string().optional(),
  commMgmtEmailId: z.string().optional(),

  initialOrderValue: z
    .string()
    .min(1, "Required")
    .regex(/^\d+(\.\d+)?$/, "Invalid number"),

  revisedOrderValue: z
    .union([z.literal(""), z.string().regex(/^\d+(\.\d+)?$/, "Invalid number")])
    .optional(),

  scheduleDate: zodDate(z, "scheduleDate", true),
  scheduleCompletionDate: zodDate(z, "scheduleCompletionDate", true),
  originalStartDate: zodDate(z, "originalStartDate"),
  extendedCompleteDate: zodDate(z, "extendedCompleteDate"),

  billingAddress: z.string().min(1, "Required"),
  companyBillingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingAddress2: z.string().optional(),
  shippingAddress3: z.string().optional(),

  status: z.string().min(1, "Required"),
});

export default function ProjectForm({ mode = "create", data, projectId }) {
  const [isEditing, setIsEditing] = useState(mode === "create");

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectCode: "",
      clientName: "",
      gstn: "",
      stateCode: "",
      state: "",
      registeredAddress: "",
      projectName: "",
      projectDetails: "",
      projectManager: "",
      projMgmtContactNumber: "",
      projMgmtEmailId: "",
      commercialManager: "",
      commMgmtContactNumber: "",
      commMgmtEmailId: "",
      initialOrderValue: "",
      revisedOrderValue: "",
      scheduleDate: "",
      scheduleCompletionDate: "",
      originalStartDate: "",
      extendedCompleteDate: "",
      billingAddress: "",
      companyBillingAddress: "",
      shippingAddress: "",
      shippingAddress2: "",
      shippingAddress3: "",
      status: "",
    },
  });

  // LOAD DATA
  useEffect(() => {
    if (data) {
      reset({
        ...data,
        stateCode:         getStateCodeByName(data.state || ""),
        initialOrderValue: data.initialOrderValue
          ? String(Number(data.initialOrderValue) / 1e7)
          : "",
        revisedOrderValue: data.revisedOrderValue
          ? String(Number(data.revisedOrderValue) / 1e7)
          : "",
      });
    }
  }, [data]);

  //  SUBMIT
  const onSubmit = async () => {
    let toastId;

    try {
      const raw = getValues();
      const values = {
        ...raw,
        stateCode:         getStateCodeByName(raw.state || ""),
        initialOrderValue: raw.initialOrderValue
          ? String(Number(raw.initialOrderValue) * 1e7)
          : "",
        revisedOrderValue: raw.revisedOrderValue
          ? String(Number(raw.revisedOrderValue) * 1e7)
          : "",
      };

      toastId = toast.loading(
        mode === "edit" ? "Updating project..." : "Saving project...",
      );

      await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.SETTINGS.CREATE_PROJECT
            : `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: values,
      });

      toast.success(
        mode === "edit" ? "Updated successfully" : "Saved successfully",
        { id: toastId },
      );

      setIsEditing(false);
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  };

  //  EDIT TOGGLE
  const handleEdit = () => {
    if (isEditing && mode === "edit") {
      reset({
        ...data,
        stateCode:         getStateCodeByName(data.state || ""),
        initialOrderValue: data.initialOrderValue
          ? String(Number(data.initialOrderValue) / 1e7)
          : "",
        revisedOrderValue: data.revisedOrderValue
          ? String(Number(data.revisedOrderValue) / 1e7)
          : "",
      });
    }
    setIsEditing((prev) => !prev);
  };

  //  STYLES
  const labelClass =
    "px-3 py-1 bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm min-w-[180px]";

  //  UI
  return (
    <div className="p-4  space-y-2">
      {/* TOP ROW */}
      <div>
        <div className="flex justify-between flex-wrap">
          {/* PROJECT CODE */}
          <div className="flex flex-col">
            <div className="flex items-center ">
              <div className={labelClass}>Project Code</div>

              <Input
                {...register("projectCode")}
                disabled={!isEditing || isSubmitting}
                className={`w-[200px] ${getInputClass(errors.projectCode, !isEditing || isSubmitting)}`}
                placeholder="Text"
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                        {errors.projectCode?.message}
                    </p> */}
          </div>

          {/* STATUS */}
          <div className="flex flex-col">
            <div className="flex items-center">
              <div className={labelClass}>Status</div>

              <select
                {...register("status")}
                disabled={!isEditing || isSubmitting}
                className={`w-[200px] ${getInputClass(errors.status, !isEditing || isSubmitting)}  
    `}
              >
                <option value="">Select</option>
                <option value="ongoing">Ongoing</option>
                <option value="hold">Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                        {errors.status?.message}
                    </p> */}
          </div>
        </div>

        {/* CLIENT */}
        <div className="flex flex-col">
          <div className="flex flex-wrap">
            <div className={labelClass}>Client Name</div>

            <Input
              {...register("clientName")}
              disabled={!isEditing || isSubmitting}
              className={`flex-1 ${getInputClass(errors.clientName, !isEditing || isSubmitting)}`}
              placeholder="Text"
            />
          </div>

          {/* optional error message */}
          {/* <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                    {errors.clientName?.message}
                </p> */}
        </div>

        <div className="flex flex-wrap gap-4">
          {/* GSTN */}
          <div className="flex flex-col">
            <div className="flex items-center">
              <div className={labelClass}>GSTN</div>

              <Input
                {...register("gstn")}
                disabled={!isEditing || isSubmitting}
                className={`w-[200px] ${getInputClass(errors.gstn, !isEditing || isSubmitting)}`}
                onChange={(e) => setValue("gstn", e.target.value.toUpperCase(), { shouldValidate: true })}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                        {errors.gstn?.message}
                    </p> */}
          </div>

          {/* STATE */}
          <div className="flex flex-col">
            <div className="flex items-center ">
              <div className={labelClass}>State</div>

              <select
                {...register("state")}
                disabled={!isEditing || isSubmitting}
                onChange={(e) => {
                  const selectedState = e.target.value;

                  setValue("state", selectedState);

                  setValue("stateCode", getStateCodeByName(selectedState));
                }}
                className={`
        w-[220px]
        ${getInputClass(errors.state, !isEditing || isSubmitting)}
        disabled:opacity-100
        disabled:text-black
        disabled:cursor-default
      `}
              >
                <option value="">Select State</option>

                {INDIAN_STATES.map((item) => (
                  <option key={item.code} value={item.state}>
                    {item.state}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STATE CODE */}
          <div className="flex flex-col">
            <div className="flex items-center">
              <div className={labelClass}>State Code</div>

              <Input
                {...register("stateCode")}
                readOnly
                disabled
                className={`w-[120px] ${getInputClass(errors.stateCode, true)}`}
              />
            </div>
          </div>
        </div>

        {/* ADDRESS */}
        <div className="flex flex-col">
          <div className="flex flex-wrap ">
            <div className={labelClass}>Registered Address</div>

            <Input
              {...register("registeredAddress")}
              disabled={!isEditing || isSubmitting}
              className={`flex-1 ${getInputClass(errors.registeredAddress, !isEditing || isSubmitting)}`}
              placeholder="Text"
            />
          </div>

          {/* <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                    {errors.registeredAddress?.message}
                </p> */}
        </div>

        {/* PROJECT NAME */}
        <div className="flex flex-col">
          <div className="flex flex-wrap">
            <div className={labelClass}>Project Name</div>

            <Input
              {...register("projectName")}
              disabled={!isEditing || isSubmitting}
              className={`flex-1 ${getInputClass(errors.projectName, !isEditing || isSubmitting)}`}
              placeholder="Text"
            />
          </div>

          {/* <p className="text-red-500 text-[10px] h-[14px]">
                    {errors.projectName?.message}
                </p> */}
        </div>

        {/* PROJECT DETAILS */}
        <div className="flex flex-col">
          <div className="flex flex-wrap ">
            <div className={labelClass}>Project Details</div>

            <textarea
              {...register("projectDetails")}
              disabled={!isEditing || isSubmitting}
              className={`border text-sm rounded-sm w-full p-2 bg-white ${
                errors.projectDetails ? "border-red-500" : "border-[#8f8f8f]"
              } border-[#7fa37f] bg-[#edf8ed] disabled:bg-[#edf8ed] 
    disabled:text-gray-500 
    `}
              placeholder="Text"
            />
          </div>

          {/* <p className="text-red-500 text-[10px] h-[14px]">
                    {errors.projectDetails?.message}
                </p> */}
        </div>
      </div>

      {/* MANAGERS */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* PM */}
        <div>
          {/* NAME */}
          <div className="flex flex-col">
            <div className="flex">
              <div className={labelClass}>Project Manager</div>

              <Input
                {...register("projectManager")}
                disabled={!isEditing || isSubmitting}
                className={getInputClass(
                  errors.projectManager,
                  !isEditing || isSubmitting,
                )}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.projectManager?.message}
                        </p> */}
          </div>

          {/* CONTACT */}
          <div className="flex flex-col">
            <div className="flex ">
              <div className={labelClass}>Contact Number</div>

              <Input
                {...register("projMgmtContactNumber")}
                disabled={!isEditing || isSubmitting}
                className={getInputClass(
                  errors.projMgmtContactNumber,
                  !isEditing || isSubmitting,
                )}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.projMgmtContactNumber?.message}
                        </p> */}
          </div>

          {/* EMAIL */}
          <div className="flex flex-col">
            <div className="flex ">
              <div className={labelClass}>Email Id</div>

              <Input
                {...register("projMgmtEmailId")}
                disabled={!isEditing || isSubmitting}
                className={getInputClass(
                  errors.projMgmtEmailId,
                  !isEditing || isSubmitting,
                )}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.projMgmtEmailId?.message}
                        </p> */}
          </div>
        </div>

        {/* CM */}
        <div>
          <div className="flex flex-col">
            <div className="flex ">
              <div className={labelClass}>Commercial Manager</div>

              <Input
                {...register("commercialManager")}
                disabled={!isEditing || isSubmitting}
                className={getInputClass(
                  errors.commercialManager,
                  !isEditing || isSubmitting,
                )}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.commercialManager?.message}
                        </p> */}
          </div>

          <div className="flex flex-col">
            <div className="flex ">
              <div className={labelClass}>Contact Number</div>

              <Input
                {...register("commMgmtContactNumber")}
                disabled={!isEditing || isSubmitting}
                className={getInputClass(
                  errors.commMgmtContactNumber,
                  !isEditing || isSubmitting,
                )}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.commMgmtContactNumber?.message}
                        </p> */}
          </div>

          <div className="flex flex-col">
            <div className="flex ">
              <div className={labelClass}>Email Id</div>

              <Input
                {...register("commMgmtEmailId")}
                disabled={!isEditing || isSubmitting}
                className={getInputClass(
                  errors.commMgmtEmailId,
                  !isEditing || isSubmitting,
                )}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.commMgmtEmailId?.message}
                        </p> */}
          </div>
        </div>
      </div>
      <div>
        {/* VALUES */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="flex flex-col">
            <div className="flex ">
              <div className={labelClass}>Initial Order Value(Cr)</div>

              <Input
                {...register("initialOrderValue")}
                inputMode="decimal"
                onInput={(e) => {
                  let value = e.target.value;

                  value = value.replace(/[^0-9.]/g, "");

                  const parts = value.split(".");

                  if (parts.length > 2) {
                    value = parts[0] + "." + parts.slice(1).join("");
                  }

                  e.target.value = value;
                }}
                disabled={!isEditing || isSubmitting}
                className={getInputClass(
                  errors.initialOrderValue,
                  !isEditing || isSubmitting,
                )}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                        {errors.initialOrderValue?.message}
                    </p> */}
          </div>

          <div className="flex flex-col">
            <div className="flex ">
              <div className={labelClass}>Revised Order Value(Cr)</div>

              <Input
                {...register("revisedOrderValue")}
                inputMode="decimal"
                onInput={(e) => {
                  let value = e.target.value;

                  value = value.replace(/[^0-9.]/g, "");

                  const parts = value.split(".");

                  if (parts.length > 2) {
                    value = parts[0] + "." + parts.slice(1).join("");
                  }

                  e.target.value = value;
                }}
                disabled={!isEditing || isSubmitting}
                className={getInputClass(
                  errors.revisedOrderValue,
                  !isEditing || isSubmitting,
                )}
              />
            </div>

            {/* <p className="text-red-500 text-[10px] h-[14px]">
                        {errors.revisedOrderValue?.message}
                    </p> */}
          </div>
        </div>

        {/* DATES */}
        <div className="grid md:grid-cols-2 gap-x-3">
          {[
            ["Schedule Start Date", "scheduleDate"],
            ["Original Start Date", "originalStartDate"],
            ["Completion Date", "scheduleCompletionDate"],
            ["Completion Date", "extendedCompleteDate"],
          ].map(([label, key]) => (
            <div key={key} className="flex flex-col">
              <div className="flex items-center">
                <div className={labelClass}>{label}</div>

                <Input
                  type="date"
                  {...register(key)}
                  disabled={!isEditing || isSubmitting}
                  className={getInputClass(
                    errors[key],
                    !isEditing || isSubmitting,
                  )}
                />
              </div>

              {/* <p className="text-red-500 text-[10px] h-[14px]">
                            {errors[key]?.message}
                        </p> */}
            </div>
          ))}
        </div>
      </div>
      <div>
        {/* ADDRESS BLOCK */}
        {[
          ["BADD", "Sale Billing Address", "billingAddress"],
          ["CBADD", "Purchase Billing Address", "companyBillingAddress"],
          ["SHP1", "Shipping Address 1", "shippingAddress"],
          ["SHP2", "Shipping Address 2", "shippingAddress2"],
          ["SHP3", "Shipping Address 3", "shippingAddress3"],
        ].map(([short, full, key]) => (
          <div key={key} className="flex flex-col">
            <div className="flex  items-center">
              {/* SHORT LABEL */}
              <div className={`${labelClass} min-w-[80px] text-center`}>
                {short}
              </div>

              {/* FULL LABEL */}
              <div className={`${labelClass} min-w-[180px]`}>{full}</div>

              {/* INPUT */}
              <Input
                {...register(key)}
                disabled={!isEditing || isSubmitting}
                className={`flex-1 ${getInputClass(errors[key], !isEditing || isSubmitting)}`}
                placeholder="Text"
              />
            </div>

            {/* ERROR */}
            {/* <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                        {errors[key]?.message}
                    </p> */}
          </div>
        ))}
      </div>

      {/* BUTTONS */}
      <div className="flex justify-end gap-3 mt-10">
        <SaveButton
          onClick={() => handleSubmit(onSubmit)()}
          loading={isSubmitting}
          disabled={!isEditing || isSubmitting}
        />

        {mode === "edit" && (
          <EditButton onClick={handleEdit}>
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        )}
      </div>
    </div>
  );
}
