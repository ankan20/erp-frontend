"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/common/SearchableSelect";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass, labelClass } from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";
import FileUploadInline, { ACCEPT_DOC, TYPES_DOC } from "@/components/common/FileUploadInline";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  serviceType:     z.string().min(1, "Service Type is required"),
  serviceDate:     z.string().optional(),
  billAmount:      z.string().optional(),
  partyBillNo:     z.string().optional(),
  serviceLocation: z.string().optional(),
  jobMonitoringBy: z.string().optional(),
  operatorName:    z.string().optional(),
});

const defaultValues = {
  serviceType: "", serviceDate: "", billAmount: "",
  partyBillNo: "", serviceLocation: "", jobMonitoringBy: "", operatorName: "",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const LBL = `${labelClass} w-full sm:w-[260px] sm:min-w-[260px] sm:max-w-[260px] text-[13px] shrink-0`;
const INPUT_W = "w-full sm:w-[340px]";

function FieldRow({ label, required, fileWidget, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <div className={LBL}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {fileWidget ? (
        <div className="flex items-start sm:items-center flex-wrap gap-y-1.5 min-w-0">
          <div className="w-full sm:w-[340px] shrink-0 min-w-0">{children}</div>
          <div className="hidden sm:block sm:w-4 shrink-0" />
          <div className="shrink-0">{fileWidget}</div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 sm:max-w-[340px]">{children}</div>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function ServiceHistoryForm({ mode = "create", recordId, initialData }) {
  const router = useRouter();
  const isCreate = mode === "create";

  const [isEditing,     setIsEditing]     = useState(isCreate);
  const [saving,        setSaving]        = useState(false);
  const [pmList,        setPmList]        = useState([]);
  const [pmId,          setPmId]          = useState(null);
  const [pmName,        setPmName]        = useState("");
  const [filesResetKey, setFilesResetKey] = useState(0);
  const [partyBillFile, setPartyBillFile] = useState({ newFile: null, url: null });
  const [initBillFile,  setInitBillFile]  = useState({ newFile: null, url: null });

  const fieldDisabled = !isEditing || saving;

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  // Fetch PM ID list for the dropdown
  useEffect(() => {
    const projectCode = getLocalStorage("projectInfo")?.projectCode || "";
    apiRequest({
      url: `${API_ENDPOINTS.RESOURCE.MACHINERY.PM_ID.LIST}?project_code=${projectCode}&limit=500`,
      method: "GET",
    })
      .then((res) => setPmList(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialData) return;
    const d = initialData;
    reset({
      serviceType:     d.serviceType     || "",
      serviceDate:     d.serviceDate     || "",
      billAmount:      d.billAmount != null ? String(d.billAmount) : "",
      partyBillNo:     d.partyBillNo     || "",
      serviceLocation: d.serviceLocation || "",
      jobMonitoringBy: d.jobMonitoringBy || "",
      operatorName:    d.operatorName    || "",
    });
    setPmId(d.pmId     || null);
    setPmName(d.pmName || "");
    const f = { newFile: null, url: d.partyBillFile || null };
    setPartyBillFile(f);
    setInitBillFile(f);
  }, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values) => {
    if (isCreate && !pmId) { toast.error("Please select a P&M ID"); return; }
    let tid;
    try {
      setSaving(true);
      tid = toast.loading(isCreate ? "Creating service history…" : "Updating service history…");

      const fd = new FormData();
      if (isCreate) fd.append("pmId", String(pmId));
      Object.entries(values).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (partyBillFile.newFile) fd.append("partyBillFile", partyBillFile.newFile);

      const res = await apiRequest({
        url: isCreate
          ? API_ENDPOINTS.RESOURCE.MACHINERY.SERVICE_HISTORY.CREATE
          : `${API_ENDPOINTS.RESOURCE.MACHINERY.SERVICE_HISTORY.EDIT}${recordId}`,
        method: isCreate ? "POST" : "PUT",
        data: fd,
      });

      toast.success(isCreate ? "Service History created" : "Service History updated", { id: tid });

      if (isCreate) {
        const saved = res?.data;
        router.push(`/resource-management/services/plant-machinery/pm-inventory/service-data/service-history/${saved?.id}`);
      } else {
        const saved = Array.isArray(res?.data) ? res.data[0] : res?.data;
        const updatedFile = { newFile: null, url: saved?.partyBillFile || partyBillFile.url };
        setPartyBillFile(updatedFile);
        setInitBillFile(updatedFile);
        setFilesResetKey((k) => k + 1);
        setIsEditing(false);
      }
    } catch (err) {
      toast.error(err?.message || "Save failed", { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    setPartyBillFile(initBillFile);
    setFilesResetKey((k) => k + 1);
    setIsEditing(false);
  };

  return (
    <div className="px-4 py-4">
      {/* P&M ID selector */}
      <div className="mb-4 flex flex-col gap-2">
        <FieldRow label="P&M ID" required>
          <div className={`w-full sm:max-w-[340px]`}>
            <SearchableSelect
              options={pmList}
              value={pmId != null ? String(pmId) : ""}
              onChange={(val, item) => {
                setPmId(Number(val));
                setPmName(item?.machineName || "");
              }}
              disabled={!isCreate || fieldDisabled}
              placeholder="Search by UID or machine name"
              labelKey={["pmUid", "machineName"]}
              labelSeparator=" — "
              valueKey="id"
              searchKeys={["pmUid", "machineName"]}
            />
          </div>
        </FieldRow>
        <FieldRow label="P&M Name">
          <Input value={pmName} disabled placeholder="[Auto]"
            className={`${getInputClass(false, true)} ${INPUT_W}`} />
        </FieldRow>
      </div>

      <div className="text-[13px] font-semibold text-[#2e5a7a] border-b border-[#b8c7da] pb-0.5 mb-3">
        Machinery Details:
      </div>
      <div className="flex flex-col gap-2">
        <FieldRow label="Service Type" required>
          <Input {...register("serviceType")} disabled={fieldDisabled}
            className={`${getInputClass(!!errors.serviceType, fieldDisabled)} ${INPUT_W}`} />
        </FieldRow>
        <FieldRow label="Service Date">
          <Input type="date" {...register("serviceDate")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} ${INPUT_W}`} />
        </FieldRow>
        <FieldRow label="Bill Amount">
          <Input type="number" {...register("billAmount")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} ${INPUT_W}`} />
        </FieldRow>
        <FieldRow
          label="Party Bill No"
          fileWidget={
            <FileUploadInline
              label="Party Bill"
              disabled={fieldDisabled}
              resetKey={filesResetKey}
              existingUrl={partyBillFile.url || ""}
              onChange={(f) => setPartyBillFile((prev) => ({ ...prev, newFile: f }))}
              onClearExisting={() => setPartyBillFile((prev) => ({ ...prev, url: null }))}
              accept={ACCEPT_DOC}
              allowedTypes={TYPES_DOC}
            />
          }
        >
          <Input {...register("partyBillNo")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} w-full`} />
        </FieldRow>
        <FieldRow label="Service Location">
          <Input {...register("serviceLocation")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} ${INPUT_W}`} />
        </FieldRow>
        <FieldRow label="Job Monitoring By">
          <Input {...register("jobMonitoringBy")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} ${INPUT_W}`} />
        </FieldRow>
        <FieldRow label="Operator Name">
          <Input {...register("operatorName")} disabled={fieldDisabled} placeholder="Text"
            className={`${getInputClass(false, fieldDisabled)} ${INPUT_W}`} />
        </FieldRow>
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-[#dce7f0]">
        {isCreate ? (
          <SaveButton onClick={handleSubmit(onSubmit)} loading={saving} disabled={false} />
        ) : (
          <>
            <EditButton onClick={isEditing ? handleCancel : () => setIsEditing(true)} disabled={saving}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
            {isEditing && <SaveButton onClick={handleSubmit(onSubmit)} loading={saving} disabled={false} />}
          </>
        )}
      </div>
    </div>
  );
}
