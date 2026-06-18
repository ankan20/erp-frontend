"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass, labelClass as baseLabelClass } from "@/lib/formStyles";

const labelClass = `${baseLabelClass} shrink-0 min-w-[180px] w-[180px]`;
import { useRouter } from "next/navigation";

const LB = API_ENDPOINTS.RESOURCE.MACHINERY.LOG_BOOK;

const schema = z.object({
  createDate: z.string().min(1, "Required"),
  partyOrderId: z.string().optional(),
  partyName: z.string().optional(),
  machineryName: z.string().optional(),
  machineryRegNo: z.string().optional(),
  fuelConsumptionUnit: z.string().optional(),
  fuelConsumptionPerUnit: z.string().optional(),
});

const defaultValues = {
  createDate: "",
  partyOrderId: "",
  partyName: "",
  machineryName: "",
  machineryRegNo: "",
  fuelConsumptionUnit: "",
  fuelConsumptionPerUnit: "",
};

export default function LogBookForm({ mode = "create", logBookId }) {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [initialData, setInitialData] = useState(null);
  const [pwOrders, setPwOrders] = useState([]);
  const [logBookNo, setLogBookNo] = useState("");
  const router = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode;

  const form = useForm({ resolver: zodResolver(schema), defaultValues, mode: "onChange" });
  const { control, reset, watch, setValue, getValues, handleSubmit, register, formState: { errors, isSubmitting } } = form;

  const disabled = mode === "view" || mode === "approver" || !isEditing || isSubmitted || isSubmitting;

  // Fetch PW orders for searchable select
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${LB.GET_PW_ORDERS}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => setPwOrders(res.data || []))
      .catch(() => {});
  }, [projectCode]);

  // Load details for edit/view
  useEffect(() => {
    if (mode === "create" || !logBookId) return;

    const fetch = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({ url: `${LB.DETAILS}/${logBookId}`, method: "GET" });
        const d = res.data;
        setLogBookNo(d.logBookNo || "");

        const fd = {
          createDate: d.createDate || "",
          partyOrderId: String(d.partyOrderId || ""),
          partyName: d.partyName || "",
          machineryName: d.machineryName || "",
          machineryRegNo: d.machineryRegNo || "",
          fuelConsumptionUnit: d.fuelConsumptionUnit || "",
          fuelConsumptionPerUnit: String(d.fuelConsumptionPerUnit || ""),
        };

        reset(fd);
        setInitialData(fd);

        const st = (d.workflowStatus || "").toLowerCase();
        if (mode === "edit" && !["draft", "reback"].includes(st)) {
          setIsSubmitted(true);
          setIsEditing(false);
          if (st === "approved") toast.info("Log Book already Approved");
          else if (st === "rejected") toast.info("Log Book already Rejected");
          else toast.info("Log Book already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Log Book");
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [logBookId, mode, reset]);

  const buildPayload = () => {
    const v = getValues();
    return {
      projectCode,
      createDate: v.createDate,
      ...(v.partyOrderId ? { partyOrderId: Number(v.partyOrderId) } : {}),
      ...(v.machineryName ? { machineryName: v.machineryName } : {}),
      ...(v.machineryRegNo ? { machineryRegNo: v.machineryRegNo } : {}),
      ...(v.fuelConsumptionUnit ? { fuelConsumptionUnit: v.fuelConsumptionUnit } : {}),
      ...(v.fuelConsumptionPerUnit ? { fuelConsumptionPerUnit: Number(v.fuelConsumptionPerUnit) } : {}),
    };
  };

  const handleSaveDraft = async () => {
    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating Log Book..." : "Updating Log Book...");
      const res = await apiRequest({
        url: mode === "create" ? LB.CREATE : `${LB.EDIT}/${logBookId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });
      if (res?.data?.logBookNo) setLogBookNo(res.data.logBookNo);
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved successfully", { id: toastId });
      if (mode === "create" && res.data?.logBookId) {
        setTimeout(() => router.push(`/resource-management/machinery/log-sheet/log-book/${res.data.logBookId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save draft", { id: toastId });
    }
  };

  const onSubmit = async () => {
    let toastId;
    try {
      toastId = toast.loading("Submitting Log Book...");
      await apiRequest({ url: `${LB.SUBMIT}/${logBookId}`, method: "POST" });
      toast.success("Log Book submitted successfully", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    }
  };

  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-3 max-w-[620px]">

        {/* Group 1 */}
        <div className=" rounded-sm p-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className={labelClass}>Log Book No</div>
            <Input value={logBookNo || "[Auto]"} disabled className={getInputClass(false, true)} />
          </div>
          <div className="flex items-center gap-2">
            <div className={labelClass}>Create Date</div>
            <Input
              type="date"
              {...register("createDate")}
              disabled={disabled}
              className={getInputClass(!!errors.createDate, disabled)}
            />
          </div>
        </div>

        {/* Group 2 */}
        <div className=" rounded-sm p-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className={labelClass}>Party Order No</div>
            <Controller
              name="partyOrderId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  options={pwOrders}
                  value={field.value}
                  onChange={(val, item) => {
                    field.onChange(String(val));
                    setValue("partyName", item.partyName || "");
                  }}
                  disabled={disabled}
                  placeholder="Select Order"
                  labelKey="orderNo"
                  valueKey="id"
                  searchKeys={["orderNo", "partyName"]}
                />
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className={labelClass}>Party Name</div>
            <Input value={watch("partyName") || ""} disabled className={`flex-1 ${getInputClass(false, true)}`} placeholder="[Auto]" />
          </div>
          <div className="flex items-center gap-2">
            <div className={labelClass}>Machinery Name</div>
            <Input {...register("machineryName")} disabled={disabled} placeholder="Text" className={getInputClass(false, disabled)} />
          </div>
          <div className="flex items-center gap-2">
            <div className={labelClass}>Machinery Reg. Number</div>
            <Input {...register("machineryRegNo")} disabled={disabled} placeholder="Text" className={getInputClass(false, disabled)} />
          </div>
        </div>

        {/* Group 3 */}
        <div className=" rounded-sm p-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className={labelClass}>Fuel Consumption Unit</div>
            <Input {...register("fuelConsumptionUnit")} disabled={disabled} placeholder="Text" className={getInputClass(false, disabled)} />
          </div>
          <div className="flex items-center gap-2">
            <div className={labelClass}>Fuel Consumption /Unit</div>
            <Input
              type="number"
              step="0.01"
              {...register("fuelConsumptionPerUnit")}
              disabled={disabled}
              placeholder="Text"
              className={getInputClass(false, disabled)}
            />
          </div>
        </div>

      </div>

      {mode !== "view" && mode !== "approver" && (
        <div className="flex justify-end gap-3 mt-5 px-4">
          {((mode === "create" && isEditing) || (mode === "edit" && isEditing && !isSubmitted)) && (
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
            disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting}
            requireConfirmation
            confirmationTitle="Submit Log Book?"
            confirmationMessage="Once submitted, this Log Book will go for approval."
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
    </>
  );
}
