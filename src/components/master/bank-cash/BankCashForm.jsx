"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass } from "@/lib/formStyles";
import { useRouter } from "next/navigation";

const schema = z.object({
  type:                   z.enum(["BANK", "CASH"]),
  bankCode:               z.string().min(1, "Required"),
  bankHolderName:         z.string().min(1, "Required"),
  bankAcNumber:           z.string().optional(),
  bankName:               z.string().optional(),
  branchName:             z.string().optional(),
  ifscCode:               z.string().optional(),
  micrCode:               z.string().optional(),
  customerId:             z.string().optional(),
  branchManagerName:      z.string().optional(),
  branchManagerContact:   z.string().optional(),
  branchManagerMailId:    z.string().optional(),
});

const defaultValues = {
  type:                   "BANK",
  bankCode:               "",
  bankHolderName:         "",
  bankAcNumber:           "",
  bankName:               "",
  branchName:             "",
  ifscCode:               "",
  micrCode:               "",
  customerId:             "",
  branchManagerName:      "",
  branchManagerContact:   "",
  branchManagerMailId:    "",
};

const label =
  "w-[240px] min-w-[240px] h-[30px] flex items-center px-3 bg-[#d6e6f2] border border-black rounded-sm text-[13px]";

const BC = API_ENDPOINTS.MASTER.BANK_CASH;

export default function BankCashForm({ mode = "create", disabled = false, recordId, initialData }) {
  const [isEditing, setIsEditing] = useState(mode === "create");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  const typeValue = watch("type");
  const isCash = typeValue === "CASH";
  const fieldDisabled = disabled || !isEditing || isSubmitting;

  // Load initial data for edit/view
  useEffect(() => {
    if ((mode === "edit" || mode === "view") && initialData) {
      reset({
        type:                 initialData.type               || "BANK",
        bankCode:             initialData.bankCode           || "",
        bankHolderName:       initialData.bankHolderName     || "",
        bankAcNumber:         initialData.bankAcNumber       || "",
        bankName:             initialData.bankName           || "",
        branchName:           initialData.branchName         || "",
        ifscCode:             initialData.ifscCode           || "",
        micrCode:             initialData.micrCode           || "",
        customerId:           initialData.customerId         || "",
        branchManagerName:    initialData.branchManagerName  || "",
        branchManagerContact: initialData.branchManagerContact || "",
        branchManagerMailId:  initialData.branchManagerMailId || "",
      });
    }
  }, [initialData, mode, reset]);

  const handleCancel = () => {
    if (initialData) {
      reset({
        type:                 initialData.type               || "BANK",
        bankCode:             initialData.bankCode           || "",
        bankHolderName:       initialData.bankHolderName     || "",
        bankAcNumber:         initialData.bankAcNumber       || "",
        bankName:             initialData.bankName           || "",
        branchName:           initialData.branchName         || "",
        ifscCode:             initialData.ifscCode           || "",
        micrCode:             initialData.micrCode           || "",
        customerId:           initialData.customerId         || "",
        branchManagerName:    initialData.branchManagerName  || "",
        branchManagerContact: initialData.branchManagerContact || "",
        branchManagerMailId:  initialData.branchManagerMailId || "",
      });
    }
    setIsEditing(false);
  };

  const onSubmit = async () => {
    let toastId;
    try {
      toastId = toast.loading("Saving...");
      const v = getValues();
      const payload = {
        type:                 v.type,
        bankCode:             v.bankCode,
        bankHolderName:       v.bankHolderName,
        bankAcNumber:         isCash ? undefined : v.bankAcNumber || undefined,
        bankName:             isCash ? undefined : v.bankName     || undefined,
        branchName:           isCash ? undefined : v.branchName   || undefined,
        ifscCode:             isCash ? undefined : v.ifscCode     || undefined,
        micrCode:             isCash ? undefined : v.micrCode     || undefined,
        customerId:           isCash ? undefined : v.customerId   || undefined,
        branchManagerName:    v.branchManagerName    || undefined,
        branchManagerContact: v.branchManagerContact || undefined,
        branchManagerMailId:  v.branchManagerMailId  || undefined,
      };

      if (mode === "create") {
        const res = await apiRequest({ url: BC.CREATE, method: "POST", data: payload });
        toast.success("Bank/Cash created", { id: toastId });
        const newId = res.data?.[0]?.id;
        if (newId) {
          setTimeout(() => router.push(`/master/bank-cash/${newId}`), 400);
        } else {
          setIsEditing(false);
        }
      } else {
        await apiRequest({ url: `${BC.UPDATE}/${recordId}`, method: "PUT", data: payload });
        toast.success("Bank/Cash updated", { id: toastId });
        setIsEditing(false);
      }
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6">

      {/* TYPE + CODE */}
      <div className="space-y-1">
        <div className="flex gap-2 items-center">
          <div className={label}>Type</div>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={fieldDisabled || mode !== "create"}>
                <SelectTrigger className={`flex-1 h-[30px] text-[13px] ${getInputClass(errors.type, fieldDisabled || mode !== "create")}`}>
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">BANK</SelectItem>
                  <SelectItem value="CASH">CASH</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>Bank Code</div>
          <Input
            {...register("bankCode")}
            disabled={fieldDisabled || mode !== "create"}
            placeholder="Text but Always Unique"
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(errors.bankCode, fieldDisabled || mode !== "create")}`}
          />
        </div>
      </div>

      {/* HOLDER + BANK DETAILS */}
      <div className="space-y-1">
        <div className="flex gap-2 items-center">
          <div className={label}>Bank Holder Name</div>
          <Input {...register("bankHolderName")} disabled={fieldDisabled} placeholder="Text"
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(errors.bankHolderName, fieldDisabled)}`} />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>Bank A/c Number</div>
          <Input {...register("bankAcNumber")} disabled={fieldDisabled || isCash} placeholder={isCash ? "N/A for Cash" : "Text"}
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled || isCash)}`} />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>Bank Name</div>
          <Input {...register("bankName")} disabled={fieldDisabled || isCash} placeholder={isCash ? "N/A for Cash" : "Text"}
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled || isCash)}`} />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>Branch Name</div>
          <Input {...register("branchName")} disabled={fieldDisabled || isCash} placeholder={isCash ? "N/A for Cash" : "Text"}
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled || isCash)}`} />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>IFSC Code</div>
          <Input {...register("ifscCode")} disabled={fieldDisabled || isCash} placeholder={isCash ? "N/A for Cash" : "Text"}
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled || isCash)}`} />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>MICR Code</div>
          <Input {...register("micrCode")} disabled={fieldDisabled || isCash} placeholder={isCash ? "N/A for Cash" : "Text"}
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled || isCash)}`} />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>Customer ID</div>
          <Input {...register("customerId")} disabled={fieldDisabled || isCash} placeholder={isCash ? "N/A for Cash" : "Text"}
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled || isCash)}`} />
        </div>
      </div>

      {/* BRANCH MANAGER */}
      <div className="space-y-1">
        <div className="flex gap-2 items-center">
          <div className={label}>Branch Manager Name</div>
          <Input {...register("branchManagerName")} disabled={fieldDisabled} placeholder="Text"
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`} />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>Branch Manager Contact Number</div>
          <Input {...register("branchManagerContact")} disabled={fieldDisabled} placeholder="Text"
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`} />
        </div>

        <div className="flex gap-2 items-center">
          <div className={label}>Branch Manager Mail id</div>
          <Input {...register("branchManagerMailId")} disabled={fieldDisabled} placeholder="Text"
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`} />
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex justify-end gap-3 mt-4">
        {!disabled && (
          <SaveButton
            onClick={() => handleSubmit(onSubmit)()}
            loading={isSubmitting}
            disabled={!isEditing || isSubmitting}
          />
        )}
        {mode === "edit" && !disabled && (
          <EditButton onClick={isEditing ? handleCancel : () => setIsEditing(true)} disabled={isSubmitting}>
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        )}
      </div>
    </div>
  );
}
