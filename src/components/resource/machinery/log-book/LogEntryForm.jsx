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

const LE = API_ENDPOINTS.RESOURCE.MACHINERY.LOG_ENTRY;
const LB = API_ENDPOINTS.RESOURCE.MACHINERY.LOG_BOOK;

const schema = z.object({
  logBookId: z.string().min(1, "Required"),
  runningDate: z.string().optional(),
  runningStartTime: z.string().optional(),
  runningFinishTime: z.string().optional(),
  projectSubLocation: z.string().optional(),
  segmentLayer: z.string().optional(),
  workMonitoringBy: z.string().optional(),
  operatorName: z.string().optional(),
});

const defaultValues = {
  logBookId: "",
  runningDate: "",
  runningStartTime: "",
  runningFinishTime: "",
  projectSubLocation: "",
  segmentLayer: "",
  workMonitoringBy: "",
  operatorName: "",
};

const SectionTitle = ({ children }) => (
  <div className="text-[13px] font-semibold text-gray-600 pt-3 pb-1 border-b border-gray-200 mb-1">
    {children}
  </div>
);

export default function LogEntryForm({ mode = "create", entryId }) {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [initialData, setInitialData] = useState(null);
  const [logUid, setLogUid] = useState("");
  const [logBooks, setLogBooks] = useState([]);
  // Auto-populated from selected log book
  const [autoFields, setAutoFields] = useState({ partyName: "", machineryName: "", machineryRegNo: "" });
  const router = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode;

  const form = useForm({ resolver: zodResolver(schema), defaultValues, mode: "onChange" });
  const { control, reset, watch, setValue, getValues, handleSubmit, register, formState: { errors, isSubmitting } } = form;

  const disabled = mode === "view" || mode === "approver" || !isEditing || isSubmitted || isSubmitting;

  // Fetch log books for searchable select
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${LB.LIST}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => setLogBooks(res.data || []))
      .catch(() => {});
  }, [projectCode]);

  // Load entry details for edit/view
  useEffect(() => {
    if (mode === "create" || !entryId) return;

    const fetch = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({ url: `${LE.DETAILS}/${entryId}`, method: "GET" });
        const d = res.data;
        setLogUid(d.logUid || "");
        setAutoFields({
          partyName: d.partyName || "",
          machineryName: d.machineryName || "",
          machineryRegNo: d.machineryRegNo || "",
        });

        const fd = {
          logBookId: String(d.logBookId || ""),
          runningDate: d.runningDate || "",
          runningStartTime: d.runningStartTime || "",
          runningFinishTime: d.runningFinishTime || "",
          projectSubLocation: d.projectSubLocation || "",
          segmentLayer: d.segmentLayer || "",
          workMonitoringBy: d.workMonitoringBy || "",
          operatorName: d.operatorName || "",
        };

        reset(fd);
        setInitialData(fd);

        const st = (d.workflowStatus || "").toLowerCase();
        if (mode === "edit" && !["draft", "reback"].includes(st)) {
          setIsSubmitted(true);
          setIsEditing(false);
          if (st === "approved") toast.info("Log Entry already Approved");
          else if (st === "rejected") toast.info("Log Entry already Rejected");
          else toast.info("Log Entry already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Log Entry");
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [entryId, mode, reset]);

  const buildPayload = () => {
    const v = getValues();
    return {
      projectCode,
      logBookId: Number(v.logBookId),
      ...(v.runningDate ? { runningDate: v.runningDate } : {}),
      ...(v.runningStartTime ? { runningStartTime: v.runningStartTime } : {}),
      ...(v.runningFinishTime ? { runningFinishTime: v.runningFinishTime } : {}),
      ...(v.projectSubLocation ? { projectSubLocation: v.projectSubLocation } : {}),
      ...(v.segmentLayer ? { segmentLayer: v.segmentLayer } : {}),
      ...(v.workMonitoringBy ? { workMonitoringBy: v.workMonitoringBy } : {}),
      ...(v.operatorName ? { operatorName: v.operatorName } : {}),
    };
  };

  const handleSaveDraft = async () => {
    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating Log Entry..." : "Updating Log Entry...");
      const res = await apiRequest({
        url: mode === "create" ? LE.CREATE : `${LE.EDIT}/${entryId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });
      if (res?.data?.logUid) setLogUid(res.data.logUid);
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved successfully", { id: toastId });
      if (mode === "create" && res.data?.entryId) {
        setTimeout(() => router.push(`/resource-management/machinery/log-sheet/log-entry/${res.data.entryId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save draft", { id: toastId });
    }
  };

  const onSubmit = async () => {
    let toastId;
    try {
      toastId = toast.loading("Submitting Log Entry...");
      await apiRequest({ url: `${LE.SUBMIT}/${entryId}`, method: "POST" });
      toast.success("Log Entry submitted successfully", { id: toastId });
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
      <div className="p-4 space-y-0.5 max-w-[620px]">

        {/* LOG UID — always auto */}
        <div className="flex items-center gap-2">
          <div className={labelClass}>Log UID</div>
          <Input value={logUid || "[Auto]"} disabled className={getInputClass(false, true)} />
        </div>

        {/* ── MACHINERY DETAILS ── */}
        <SectionTitle>Machinery Details:</SectionTitle>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Log Book No</div>
          <Controller
            name="logBookId"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                options={logBooks}
                value={field.value}
                onChange={(val, item) => {
                  field.onChange(String(val));
                  setAutoFields({
                    partyName: item.partyName || "",
                    machineryName: item.machineryName || "",
                    machineryRegNo: item.machineryRegNo || "",
                  });
                }}
                disabled={disabled}
                placeholder="Select from Log Book"
                labelKey="logBookNo"
                valueKey="id"
                searchKeys={["logBookNo", "partyName", "machineryName", "machineryRegNo"]}
              />
            )}
          />
          {errors.logBookId && <span className="text-xs text-red-500">Required</span>}
        </div>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Party Name</div>
          <Input value={autoFields.partyName} disabled placeholder="[Auto]" className={`flex-1 ${getInputClass(false, true)}`} />
        </div>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Machinery Name</div>
          <Input value={autoFields.machineryName} disabled placeholder="[Auto]" className={getInputClass(false, true)} />
        </div>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Machinery Reg. Number</div>
          <Input value={autoFields.machineryRegNo} disabled placeholder="[Auto]" className={getInputClass(false, true)} />
        </div>

        {/* ── RUNNING DETAILS ── */}
        <SectionTitle>Running Details:</SectionTitle>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Running Date</div>
          <Input type="date" {...register("runningDate")} disabled={disabled} className={getInputClass(false, disabled)} />
        </div>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Running Start Time</div>
          <Input type="time" {...register("runningStartTime")} disabled={disabled} placeholder="Time Selection" className={getInputClass(false, disabled)} />
        </div>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Running Finish Time</div>
          <Input type="time" {...register("runningFinishTime")} disabled={disabled} placeholder="Time Selection" className={getInputClass(false, disabled)} />
        </div>

        {/* ── JOB LOCATION ── */}
        <SectionTitle>Job Location:</SectionTitle>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Project Sub-Location</div>
          <Input {...register("projectSubLocation")} disabled={disabled} placeholder="Select Sub Location" className={getInputClass(false, disabled)} />
        </div>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Segment /Layer</div>
          <Input {...register("segmentLayer")} disabled={disabled} placeholder="Select Sub Location" className={getInputClass(false, disabled)} />
        </div>

        {/* ── HANDLING RECORD ── */}
        <SectionTitle>Handling Record:</SectionTitle>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Work Monitoring By</div>
          <Input {...register("workMonitoringBy")} disabled={disabled} placeholder="Text" className={getInputClass(false, disabled)} />
        </div>

        <div className="flex items-center gap-2">
          <div className={labelClass}>Operator Name</div>
          <Input {...register("operatorName")} disabled={disabled} placeholder="Text" className={getInputClass(false, disabled)} />
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
            confirmationTitle="Submit Log Entry?"
            confirmationMessage="Once submitted, this Log Entry will go for approval."
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
