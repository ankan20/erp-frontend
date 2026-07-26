"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Controller } from "react-hook-form";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/common/SearchableSelect";
import ExpandableTextArea from "@/components/common/ExpandableTextArea";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass, labelClass } from "@/lib/formStyles";
import { CATEGORY_OPTIONS } from "@/config/labourCategories";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  fullName:          z.string().min(1, "Full name is required"),
  vendorId:          z.string().optional(),
  fatherName:        z.string().optional(),
  nominee:           z.string().optional(),
  address:           z.string().optional(),
  category:          z.string().optional(),
  ratePerManday:     z.string().optional(),
  dateOfJoining:     z.string().optional(),
  aadharNumber:      z.string().optional(),
  pan:               z.string().optional(),
  uan:               z.string().optional(),
  esic:              z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankName:          z.string().optional(),
  branchName:        z.string().optional(),
  ifscCode:          z.string().optional(),
});

const defaultValues = {
  fullName: "", vendorId: "", fatherName: "", nominee: "", address: "",
  category: "", ratePerManday: "", dateOfJoining: "", aadharNumber: "",
  pan: "", uan: "", esic: "", bankAccountNumber: "", bankName: "",
  branchName: "", ifscCode: "",
};

// ─── File fields ───────────────────────────────────────────────────────────────

const FILE_FIELDS = [
  { key: "aadharFile",      label: "Aadhar"    },
  { key: "panFile",         label: "PAN"       },
  { key: "uanFile",         label: "UAN"       },
  { key: "esicFile",        label: "ESIC"      },
  { key: "bankDetailsFile", label: "Bank Copy" },
];

const emptyFileState = () =>
  Object.fromEntries(FILE_FIELDS.map(({ key }) => [key, { newFile: null, url: null }]));

// ─── Label — overrides labelClass's w-[250px] for every context ───────────────
// On mobile: full-width (stacks above input).  On sm+: fixed 200 px.
const LBL = `${labelClass} w-full sm:w-[200px] sm:min-w-[200px] sm:max-w-[200px] text-[13px] shrink-0`;

// ─── Consistent input width for all text / identity / bank fields ─────────────
// Keeps inputs bounded so they don't stretch across a wide desktop.
const INPUT_MAX = "max-w-[340px]";

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <div className="text-[13px] font-semibold text-gray-700 border-b border-[#b8c7da] pb-0.5 mb-2">
        {title}:
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────
//
// Normal:   [Label 200px] [children — capped by INPUT_MAX or explicit width]
// File row: [Label 200px] [Input 300px] [·····gap·····] [FileWidget]
//           On mobile / sm the widget wraps below the input automatically.

function FieldRow({ label, required, fileWidget, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <div className={LBL}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>

      {fileWidget ? (
        // flex-wrap: on narrow viewports the widget falls below the input
        <div className="flex items-start sm:items-center flex-wrap gap-y-1.5 min-w-0">
          {/* input — 300 px on sm, grows up to 340 px on lg */}
          <div className="w-full sm:w-[300px] lg:w-[340px] shrink-0 min-w-0">
            {children}
          </div>
          {/* explicit spacer that collapses when the widget wraps */}
          <div className="hidden sm:block sm:w-6 lg:w-10 shrink-0" />
          <div className="shrink-0">{fileWidget}</div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">{children}</div>
      )}
    </div>
  );
}

// ─── FileWidget ───────────────────────────────────────────────────────────────

function FileWidget({ label, fileKey, entry, onFileChange, disabled }) {
  const ref = useRef(null);
  const { newFile, url } = entry;

  return (
    <div className="flex items-center gap-2">
      {/* All badges fixed 80 px → they form a vertical column */}
      <div className="inline-flex items-center justify-center shrink-0
                      h-[28px] w-[80px]
                      bg-[#c4b9f7] border border-[#7c6fd4] rounded-[4px]
                      text-[11.5px] font-semibold text-black">
        {label}
      </div>

      {!disabled && (
        <>
          <input
            ref={ref}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (ref.current) ref.current.value = "";
              if (file) onFileChange(fileKey, file);
            }}
          />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="inline-flex items-center justify-center shrink-0
                       h-[28px] w-[28px]
                       bg-[#ffd966] border border-[#c9a800] rounded-[4px]
                       text-[13px] font-bold hover:bg-[#ffc000] transition-colors"
          >
            @
          </button>
        </>
      )}

      {newFile ? (
        <span className="flex items-center gap-1 text-[12px] text-gray-600 max-w-[150px]">
          <FileText className="w-3 h-3 shrink-0 text-gray-400" />
          <span className="truncate" title={newFile.name}>{newFile.name}</span>
        </span>
      ) : url ? (
        <a href={url} target="_blank" rel="noreferrer"
           className="flex items-center gap-1 text-[12px] text-blue-700 font-medium hover:underline">
          <Download className="w-3 h-3 shrink-0" />
          Download
        </a>
      ) : (
        <span className="text-[11px] text-gray-400 select-none">No file</span>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function ManpowerForm({
  mode = "create",
  workerId,
  initialData,
  disabled: disabledProp = false,
}) {
  const router = useRouter();

  const [isEditing,  setIsEditing]  = useState(mode === "create");
  const [saving,     setSaving]     = useState(false);
  const [manId,      setManId]      = useState("");
  const [vendorList, setVendorList] = useState([]);
  const [files,      setFiles]      = useState(emptyFileState);

  const fieldDisabled = disabledProp || !isEditing || saving;

  const {
    register, handleSubmit, formState: { errors },
    setValue, reset, control,
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.RESOURCE.MANPOWER.VENDOR_DROPDOWN, method: "GET" })
      .then((res) => setVendorList(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialData) return;
    const d = initialData;
    reset({
      fullName:          d.fullName          || "",
      vendorId:          d.vendorId != null  ? String(d.vendorId) : "",
      fatherName:        d.fatherName        || "",
      nominee:           d.nominee           || "",
      address:           d.address           || "",
      category:          d.category          || "",
      ratePerManday:     d.ratePerManday     != null ? String(d.ratePerManday) : "",
      dateOfJoining:     d.dateOfJoining     || "",
      aadharNumber:      d.aadharNumber      || "",
      pan:               d.pan               || "",
      uan:               d.uan               || "",
      esic:              d.esic              || "",
      bankAccountNumber: d.bankAccountNumber || "",
      bankName:          d.bankName          || "",
      branchName:        d.branchName        || "",
      ifscCode:          d.ifscCode          || "",
    });
    setManId(d.manId || "");
    setFiles({
      aadharFile:      { newFile: null, url: d.aadharFile      || null },
      panFile:         { newFile: null, url: d.panFile         || null },
      uanFile:         { newFile: null, url: d.uanFile         || null },
      esicFile:        { newFile: null, url: d.esicFile        || null },
      bankDetailsFile: { newFile: null, url: d.bankDetailsFile || null },
    });
  }, [initialData]);

  const handleFileChange = (key, file) =>
    setFiles((prev) => ({ ...prev, [key]: { ...prev[key], newFile: file } }));

  const buildFormData = (values) => {
    const fd = new FormData();
    const add = (k, v) => { if (v) fd.append(k, v); };
    add("fullName",          values.fullName);
    add("vendorId",          values.vendorId);
    add("fatherName",        values.fatherName);
    add("nominee",           values.nominee);
    add("address",           values.address);
    add("category",          values.category);
    add("ratePerManday",     values.ratePerManday);
    add("dateOfJoining",     values.dateOfJoining);
    add("aadharNumber",      values.aadharNumber);
    add("pan",               values.pan);
    add("uan",               values.uan);
    add("esic",              values.esic);
    add("bankAccountNumber", values.bankAccountNumber);
    add("bankName",          values.bankName);
    add("branchName",        values.branchName);
    add("ifscCode",          values.ifscCode);
    FILE_FIELDS.forEach(({ key }) => {
      if (files[key].newFile) fd.append(key, files[key].newFile);
    });
    return fd;
  };

  const onSubmit = async (values) => {
    let tid;
    try {
      setSaving(true);
      const isUpdate = mode === "edit";
      tid = toast.loading(isUpdate ? "Updating worker…" : "Creating worker…");

      const res = await apiRequest({
        url: isUpdate
          ? `${API_ENDPOINTS.RESOURCE.MANPOWER.LABOUR_ID.UPDATE}/${workerId}`
          : API_ENDPOINTS.RESOURCE.MANPOWER.LABOUR_ID.CREATE,
        method: isUpdate ? "PUT" : "POST",
        data: buildFormData(values),
      });

      const saved = Array.isArray(res?.data) ? res.data[0] : res?.data;
      toast.success(isUpdate ? "Worker updated" : "Worker created", { id: tid });

      if (isUpdate && saved) {
        setFiles((prev) => ({
          aadharFile:      { newFile: null, url: saved.aadharFile      || prev.aadharFile.url },
          panFile:         { newFile: null, url: saved.panFile         || prev.panFile.url },
          uanFile:         { newFile: null, url: saved.uanFile         || prev.uanFile.url },
          esicFile:        { newFile: null, url: saved.esicFile        || prev.esicFile.url },
          bankDetailsFile: { newFile: null, url: saved.bankDetailsFile || prev.bankDetailsFile.url },
        }));
        setIsEditing(false);
      } else if (!isUpdate && saved?.id) {
        router.push(`/resource-management/services/manpower/labour-id/${saved.id}`);
      }
    } catch (err) {
      toast.error(err?.message || "Save failed", { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const fw = (key) => (
    <FileWidget
      fileKey={key}
      label={FILE_FIELDS.find((f) => f.key === key)?.label ?? key}
      entry={files[key]}
      onFileChange={handleFileChange}
      disabled={fieldDisabled}
    />
  );

  // Standard input: full-width inside its container but capped by INPUT_MAX
  const inp = (extra = "", hasErr = false) =>
    `${getInputClass(hasErr, fieldDisabled)} w-full ${INPUT_MAX} ${extra}`.trim();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 pt-4 pb-8 w-full">

      {/* ── Top strip: Man ID + Vendor Name ─────────────────────────────── */}
      {/*
          The top strip uses w-auto for the labels on mobile so the labelClass
          default w-[250px] does not overflow a narrow screen.
      */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 mb-5 pb-4 border-b border-[#dce7f0]">

        <div className="flex items-center gap-2 shrink-0">
          <div className={`${labelClass} text-[13px]
                          w-auto sm:w-[80px] sm:min-w-[80px] sm:max-w-[80px] shrink-0`}>
            Man ID
          </div>
          <Input
            value={manId}
            disabled
            placeholder="[Auto]"
            className={`${getInputClass(false, true)} w-[130px] font-mono`}
          />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`${labelClass} text-[13px]
                          w-auto sm:w-[110px] sm:min-w-[110px] sm:max-w-[110px] shrink-0`}>
            Vendor Name
          </div>
          <div className="flex-1 min-w-0 max-w-[360px]">
            <Controller
              name="vendorId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  options={vendorList}
                  value={field.value ? String(field.value) : ""}
                  onChange={(val) => field.onChange(val ? String(val) : "")}
                  disabled={fieldDisabled}
                  placeholder="Select Vendor"
                  labelKey={["ledgerCode", "ledgerName"]}
                  labelSeparator=" — "
                  valueKey="id"
                  searchKeys={["ledgerName", "ledgerCode"]}
                />
              )}
            />
          </div>
        </div>
      </div>

      {/* ── Personal Info ─────────────────────────────────────────────────── */}
      <Section title="Personal Info">
        <FieldRow label="Full Name" required>
          <Input {...register("fullName")} disabled={fieldDisabled} placeholder="Text"
            className={inp("", !!errors.fullName)} />
        </FieldRow>

        <FieldRow label="Father Name">
          <Input {...register("fatherName")} disabled={fieldDisabled} placeholder="Text"
            className={inp()} />
        </FieldRow>

        <FieldRow label="Nominee">
          <Input {...register("nominee")} disabled={fieldDisabled} placeholder="Text"
            className={inp()} />
        </FieldRow>
      </Section>

      {/* ── Address ───────────────────────────────────────────────────────── */}
      <Section title="Address">
        <FieldRow label="Address">
          <Controller
            name="address"
            control={control}
            render={({ field }) => (
              <ExpandableTextArea
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={fieldDisabled}
                title="Address"
                placeholder="Residential address"
                rows={2}
                modalRows={8}
              />
            )}
          />
        </FieldRow>
      </Section>

      {/* ── Work Details ──────────────────────────────────────────────────── */}
      <Section title="Work Details">
        <FieldRow label="Category">
          <div className={`w-full ${INPUT_MAX}`}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  options={CATEGORY_OPTIONS}
                  value={field.value || ""}
                  onChange={(val) => field.onChange(val || "")}
                  disabled={fieldDisabled}
                  placeholder="Select Category"
                  labelKey="label"
                  valueKey="value"
                  searchKeys={["label"]}
                />
              )}
            />
          </div>
        </FieldRow>

        <FieldRow label="Rate / Manday">
          <Input {...register("ratePerManday")} type="number" min="0" step="0.01"
            disabled={fieldDisabled}
            className={`${getInputClass(false, fieldDisabled)} w-[160px]`} />
        </FieldRow>

        <FieldRow label="Date Of Joining">
          <Input {...register("dateOfJoining")} type="date"
            disabled={fieldDisabled}
            className={inp()} />
        </FieldRow>
      </Section>

      {/* ── Identity & Documents ──────────────────────────────────────────── */}
      <Section title="Identity & Documents">
        <FieldRow label="Aadhar Number" fileWidget={fw("aadharFile")}>
          <Input {...register("aadharNumber")} disabled={fieldDisabled}
            placeholder="Text" className={`${getInputClass(false, fieldDisabled)} w-full`} />
        </FieldRow>

        <FieldRow label="PAN" fileWidget={fw("panFile")}>
          <Input {...register("pan")} disabled={fieldDisabled}
            placeholder="Text"
            className={`${getInputClass(false, fieldDisabled)} w-full uppercase`}
            onChange={(e) => setValue("pan", e.target.value.toUpperCase())} />
        </FieldRow>
      </Section>

      {/* ── Statutory Details ─────────────────────────────────────────────── */}
      <Section title="Statutory Details">
        <FieldRow label="UAN" fileWidget={fw("uanFile")}>
          <Input {...register("uan")} disabled={fieldDisabled}
            placeholder="Text" className={`${getInputClass(false, fieldDisabled)} w-full`} />
        </FieldRow>

        <FieldRow label="ESIC" fileWidget={fw("esicFile")}>
          <Input {...register("esic")} disabled={fieldDisabled}
            placeholder="Text" className={`${getInputClass(false, fieldDisabled)} w-full`} />
        </FieldRow>
      </Section>

      {/* ── Bank Details ──────────────────────────────────────────────────── */}
      <Section title="Bank Details">
        <FieldRow label="Bank A/c Number" fileWidget={fw("bankDetailsFile")}>
          <Input {...register("bankAccountNumber")} disabled={fieldDisabled}
            placeholder="Text" className={`${getInputClass(false, fieldDisabled)} w-full`} />
        </FieldRow>

        <FieldRow label="Bank Name">
          <Input {...register("bankName")} disabled={fieldDisabled}
            placeholder="Text" className={inp()} />
        </FieldRow>

        <FieldRow label="Branch Name">
          <Input {...register("branchName")} disabled={fieldDisabled}
            placeholder="Text" className={inp()} />
        </FieldRow>

        <FieldRow label="IFSC Code">
          <Input {...register("ifscCode")} disabled={fieldDisabled}
            placeholder="Text"
            className={inp("uppercase")}
            onChange={(e) => setValue("ifscCode", e.target.value.toUpperCase())} />
        </FieldRow>
      </Section>

      {/* ── Action Buttons ─────────────────────────────────────────────────── */}
      {!disabledProp && (
        <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-[#dce7f0]">
          {mode !== "create" && (
            <EditButton onClick={() => setIsEditing((v) => !v)} disabled={saving}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
          {isEditing && (
            <SaveButton onClick={handleSubmit(onSubmit)} loading={saving} disabled={false} />
          )}
        </div>
      )}
    </div>
  );
}
