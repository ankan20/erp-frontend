"use client";

import { useEffect, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, X, Check } from "lucide-react";
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

// ── Project chip ──────────────────────────────────────────────────────────────
function ProjectChip({ text, onRemove, disabled }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium">
      {text}
      {!disabled && (
        <button type="button" onClick={onRemove} className="text-blue-400 hover:text-red-500 transition-colors">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

// ── Project multi-select section ──────────────────────────────────────────────
function ProjectSelect({ value, onChange, disabled, allProjects, loading }) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? allProjects.filter((p) =>
        [p.projectCode, p.projectName].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
      )
    : allProjects;

  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  const selectedProjects = allProjects.filter((p) => value.includes(p.id));

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-[#d6e6f2] border-b border-gray-200 flex items-center justify-between">
        <span className="text-[13px] font-semibold">Linked Projects</span>
        {!disabled && value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[11px] text-red-400 hover:text-red-600 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {selectedProjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/40 border-b border-blue-100 min-h-[36px]">
          {selectedProjects.map((p) => (
            <ProjectChip
              key={p.id}
              text={`${p.projectCode} — ${p.projectName}`}
              onRemove={() => toggle(p.id)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {!disabled && (
        <div className="p-2 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="h-7 w-full border border-gray-300 rounded px-2 text-[12px] outline-none focus:border-blue-400 transition"
          />
        </div>
      )}

      {!disabled && (
        <div className="max-h-[180px] overflow-y-auto divide-y divide-gray-100 bg-white">
          {loading ? (
            <div className="flex justify-center py-5">
              <Loader2 className="animate-spin w-4 h-4 text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-gray-400 text-center">No projects found</div>
          ) : (
            filtered.map((p) => {
              const checked = value.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors ${
                    checked ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    checked ? "bg-blue-500 border-blue-500" : "border-gray-300"
                  }`}>
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className={`truncate ${checked ? "font-medium" : ""}`}>
                    {p.projectCode} — {p.projectName}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {disabled && selectedProjects.length === 0 && (
        <div className="px-3 py-4 text-[12px] text-gray-400 text-center">No projects linked</div>
      )}

      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
        <span className="text-[11px] text-gray-400">{value.length} project{value.length !== 1 ? "s" : ""} linked</span>
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function BankCashForm({ mode = "create", disabled = false, recordId, initialData }) {
  const [isEditing, setIsEditing]           = useState(mode === "create");
  const [allProjects, setAllProjects]       = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [linkedProjectIds, setLinkedProjectIds] = useState([]);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  const typeValue = watch("type");
  const isCash = typeValue === "CASH";
  const fieldDisabled = disabled || !isEditing || isSubmitting;

  // Load projects list
  useEffect(() => {
    setLoadingProjects(true);
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" })
      .then((res) => setAllProjects(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []);

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
      setLinkedProjectIds((initialData.projects || []).map((p) => p.id));
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
      setLinkedProjectIds((initialData.projects || []).map((p) => p.id));
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
        projectIds:           linkedProjectIds,
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
          <div className={label}>Bank/Cash Code <span className="text-red-500 ml-0.5">*</span></div>
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
          <div className={label}>Bank/Cash Holder Name</div>
          <Input {...register("bankHolderName")} disabled={fieldDisabled} placeholder="Text"
            className={`flex-1 h-[30px] text-[13px] ${getInputClass(errors.bankHolderName, fieldDisabled)}`} />
        </div>

        {!isCash && (
          <>
            <div className="flex gap-2 items-center">
              <div className={label}>Bank A/c Number</div>
              <Input {...register("bankAcNumber")} disabled={fieldDisabled} placeholder="Text"
                className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`} />
            </div>

            <div className="flex gap-2 items-center">
              <div className={label}>Bank Name</div>
              <Input {...register("bankName")} disabled={fieldDisabled} placeholder="Text"
                className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`} />
            </div>

            <div className="flex gap-2 items-center">
              <div className={label}>Branch Name</div>
              <Input {...register("branchName")} disabled={fieldDisabled} placeholder="Text"
                className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`} />
            </div>

            <div className="flex gap-2 items-center">
              <div className={label}>IFSC Code</div>
              <Input {...register("ifscCode")} disabled={fieldDisabled} placeholder="Text"
                className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`}
                onChange={(e) => setValue("ifscCode", e.target.value.toUpperCase())} />
            </div>

            <div className="flex gap-2 items-center">
              <div className={label}>MICR Code</div>
              <Input {...register("micrCode")} disabled={fieldDisabled} placeholder="Text"
                className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`}
                onChange={(e) => setValue("micrCode", e.target.value.toUpperCase())} />
            </div>

            <div className="flex gap-2 items-center">
              <div className={label}>Customer ID</div>
              <Input {...register("customerId")} disabled={fieldDisabled} placeholder="Text"
                className={`flex-1 h-[30px] text-[13px] ${getInputClass(false, fieldDisabled)}`} />
            </div>
          </>
        )}
      </div>

      {/* BRANCH MANAGER */}
      {!isCash && (
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
      )}

      {/* LINKED PROJECTS */}
      <ProjectSelect
        value={linkedProjectIds}
        onChange={setLinkedProjectIds}
        disabled={fieldDisabled}
        allProjects={allProjects}
        loading={loadingProjects}
      />

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
