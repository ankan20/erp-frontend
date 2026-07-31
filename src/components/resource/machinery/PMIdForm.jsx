"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass, labelClass } from "@/lib/formStyles";
import FileUploadInline, { ACCEPT_DOC, TYPES_DOC } from "@/components/common/FileUploadInline";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  machineName:         z.string().min(1, "Machine Name is required"),
  machineryType:       z.string().optional(),
  registrationNumber:  z.string().optional(),
  registrationDate:    z.string().optional(),
  insuranceNumber:     z.string().optional(),
  insuranceDate:       z.string().optional(),
  pucCertNumber:       z.string().optional(),
  pucDate:             z.string().optional(),
  roadTaxNumber:       z.string().optional(),
  roadTaxDate:         z.string().optional(),
  fuelConsumptionUnit: z.string().optional(),
  purchasedBillAmount: z.string().optional(),
  purchasedBillDate:   z.string().optional(),
});

const defaultValues = {
  machineName: "", machineryType: "",
  registrationNumber: "", registrationDate: "",
  insuranceNumber: "", insuranceDate: "",
  pucCertNumber: "", pucDate: "",
  roadTaxNumber: "", roadTaxDate: "",
  fuelConsumptionUnit: "",
  purchasedBillAmount: "", purchasedBillDate: "",
};

// ─── File fields ──────────────────────────────────────────────────────────────

const FILE_FIELDS = [
  { key: "registrationFile", label: "Reg. Doc"  },
  { key: "insuranceFile",    label: "Insurance" },
  { key: "pucFile",          label: "PUC"       },
  { key: "roadTaxFile",      label: "Road Tax"  },
  { key: "purchasedBillFile",label: "Bill"      },
];

const emptyFileState = () =>
  Object.fromEntries(FILE_FIELDS.map(({ key }) => [key, { newFile: null, url: null }]));

// ─── Styles ───────────────────────────────────────────────────────────────────

const LBL = `${labelClass} w-full sm:w-[260px] sm:min-w-[260px] sm:max-w-[260px] text-[13px] shrink-0`;
const INPUT_W = "w-full sm:w-[280px] shrink-0";
const FILE_LABEL_CLS = "min-w-[90px]";

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <div className="text-[13px] font-semibold text-[#2e5a7a] border-b border-[#b8c7da] pb-0.5 mb-3">
        {title}:
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FieldRow({ label, required, fileWidget, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <div className={LBL}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {fileWidget ? (
        <div className="flex items-center flex-wrap gap-2 min-w-0">
          {children}
          <div className="shrink-0">{fileWidget}</div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 sm:max-w-[340px]">{children}</div>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function PMIdForm({ mode = "create", recordId, initialData }) {
  const router = useRouter();
  const isCreate = mode === "create";

  const [isEditing,     setIsEditing]     = useState(isCreate);
  const [saving,        setSaving]        = useState(false);
  const [pmUid,         setPmUid]         = useState("");
  const [filesResetKey, setFilesResetKey] = useState(0);
  const [files,         setFiles]         = useState(emptyFileState);
  const [initialFiles,  setInitialFiles]  = useState(emptyFileState);

  const fieldDisabled = !isEditing || saving;

  const {
    register, handleSubmit, formState: { errors }, reset,
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (!initialData) return;
    const d = initialData;
    reset({
      machineName:         d.machineName         || "",
      machineryType:       d.machineryType        || "",
      registrationNumber:  d.registrationNumber   || "",
      registrationDate:    d.registrationDate     || "",
      insuranceNumber:     d.insuranceNumber      || "",
      insuranceDate:       d.insuranceDate        || "",
      pucCertNumber:       d.pucCertNumber        || "",
      pucDate:             d.pucDate              || "",
      roadTaxNumber:       d.roadTaxNumber        || "",
      roadTaxDate:         d.roadTaxDate          || "",
      fuelConsumptionUnit: d.fuelConsumptionUnit  || "",
      purchasedBillAmount: d.purchasedBillAmount != null ? String(d.purchasedBillAmount) : "",
      purchasedBillDate:   d.purchasedBillDate    || "",
    });
    setPmUid(d.pmUid || "");
    const fileState = {
      registrationFile:  { newFile: null, url: d.registrationFile  || null },
      insuranceFile:     { newFile: null, url: d.insuranceFile     || null },
      pucFile:           { newFile: null, url: d.pucFile           || null },
      roadTaxFile:       { newFile: null, url: d.roadTaxFile       || null },
      purchasedBillFile: { newFile: null, url: d.purchasedBillFile || null },
    };
    setFiles(fileState);
    setInitialFiles(fileState);
  }, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (key, file) =>
    setFiles((prev) => ({ ...prev, [key]: { ...prev[key], newFile: file } }));

  const clearExisting = (key) =>
    setFiles((prev) => ({ ...prev, [key]: { ...prev[key], url: null } }));

  const buildFormData = (values) => {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => { if (v) fd.append(k, v); });
    FILE_FIELDS.forEach(({ key }) => {
      if (files[key].newFile) fd.append(key, files[key].newFile);
    });
    return fd;
  };

  const onSubmit = async (values) => {
    let tid;
    try {
      setSaving(true);
      tid = toast.loading(isCreate ? "Creating P&M ID…" : "Updating P&M ID…");

      const res = await apiRequest({
        url: isCreate
          ? API_ENDPOINTS.RESOURCE.MACHINERY.PM_ID.CREATE
          : `${API_ENDPOINTS.RESOURCE.MACHINERY.PM_ID.EDIT}${recordId}`,
        method: isCreate ? "POST" : "PUT",
        data: buildFormData(values),
      });

      toast.success(isCreate ? "P&M ID created" : "P&M ID updated", { id: tid });

      if (isCreate) {
        const saved = res?.data;
        router.push(`/resource-management/services/plant-machinery/pm-inventory/pm-id/${saved?.id}`);
      } else {
        const saved = Array.isArray(res?.data) ? res.data[0] : res?.data;
        if (saved) {
          const updatedFiles = {
            registrationFile:  { newFile: null, url: saved.registrationFile  || files.registrationFile.url  },
            insuranceFile:     { newFile: null, url: saved.insuranceFile     || files.insuranceFile.url     },
            pucFile:           { newFile: null, url: saved.pucFile           || files.pucFile.url           },
            roadTaxFile:       { newFile: null, url: saved.roadTaxFile       || files.roadTaxFile.url       },
            purchasedBillFile: { newFile: null, url: saved.purchasedBillFile || files.purchasedBillFile.url },
          };
          setFiles(updatedFiles);
          setInitialFiles(updatedFiles);
          setFilesResetKey((k) => k + 1);
        }
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
    setFiles(initialFiles);
    setFilesResetKey((k) => k + 1);
    setIsEditing(false);
  };

  const fw = (key) => {
    const field = FILE_FIELDS.find((f) => f.key === key);
    return (
      <FileUploadInline
        label={field?.label ?? key}
        labelClassName={FILE_LABEL_CLS}
        onChange={(file) => handleFileChange(key, file)}
        existingUrl={files[key]?.url || ""}
        onClearExisting={() => clearExisting(key)}
        disabled={fieldDisabled}
        resetKey={filesResetKey}
        accept={ACCEPT_DOC}
        allowedTypes={TYPES_DOC}
      />
    );
  };

  const inp = (extra = "", hasErr = false) =>
    `${getInputClass(hasErr, fieldDisabled)} ${INPUT_W} ${extra}`.trim();

  return (
    <div className="px-4 py-4">
      {/* P&M UID — read-only, edit mode only */}
      {!isCreate && (
        <div className="mb-4">
          <FieldRow label="P&M UID">
            <Input value={pmUid} disabled className={`${getInputClass(false, true)} w-full sm:w-[280px]`} />
          </FieldRow>
        </div>
      )}

      <Section title="Machinery Details">
        <FieldRow label="Machine Name" required>
          <Input {...register("machineName")} disabled={fieldDisabled} placeholder="Text"
            className={inp("", !!errors.machineName)} />
        </FieldRow>

        <FieldRow label="Machinery Type">
          <Input {...register("machineryType")} disabled={fieldDisabled} placeholder="Text"
            className={inp()} />
        </FieldRow>

        <FieldRow label="Registration Number" fileWidget={fw("registrationFile")}>
          <Input {...register("registrationNumber")} disabled={fieldDisabled} placeholder="Number"
            className={inp()} />
          <Input type="date" {...register("registrationDate")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} w-full sm:w-[150px] shrink-0`} />
        </FieldRow>

        <FieldRow label="Insurance Number" fileWidget={fw("insuranceFile")}>
          <Input {...register("insuranceNumber")} disabled={fieldDisabled} placeholder="Number"
            className={inp()} />
          <Input type="date" {...register("insuranceDate")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} w-full sm:w-[150px] shrink-0`} />
        </FieldRow>

        <FieldRow label="PUC Certification Number" fileWidget={fw("pucFile")}>
          <Input {...register("pucCertNumber")} disabled={fieldDisabled} placeholder="Number"
            className={inp()} />
          <Input type="date" {...register("pucDate")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} w-full sm:w-[150px] shrink-0`} />
        </FieldRow>

        <FieldRow label="Road Tax Number" fileWidget={fw("roadTaxFile")}>
          <Input {...register("roadTaxNumber")} disabled={fieldDisabled} placeholder="Number"
            className={inp()} />
          <Input type="date" {...register("roadTaxDate")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} w-full sm:w-[150px] shrink-0`} />
        </FieldRow>

        <FieldRow label="Fuel Consumption / Unit Reading">
          <Input {...register("fuelConsumptionUnit")} disabled={fieldDisabled} placeholder="Text"
            className={inp()} />
        </FieldRow>
      </Section>

      <Section title="Purchase Details">
        <FieldRow label="Purchased Bill Amount" fileWidget={fw("purchasedBillFile")}>
          <Input type="number" {...register("purchasedBillAmount")} disabled={fieldDisabled} placeholder="Amount"
            className={inp()} />
          <Input type="date" {...register("purchasedBillDate")} disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} w-full sm:w-[150px] shrink-0`} />
        </FieldRow>
      </Section>

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
