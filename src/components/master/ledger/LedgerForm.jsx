"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getInputClass } from "@/lib/formStyles";
import {
  getStateCodeByName,
  INDIAN_STATES,
} from "@/config/indianStates.config";

const schema = z.object({
  categoryId: z.string().min(1, "Required"),
  ledgerName: z.string().min(1, "Required"),
  registeredAddress: z.string().min(1, "Required"),
  corporateAddress: z.string().min(1, "Required"),
  pan: z.string().min(1, "Required"),
  gstin: z.string().min(1, "Required"),
  stateCode: z.string().min(1, "Required"),
  stateName: z.string().min(1, "Required"),
  primaryContactPerson: z.string().min(1, "Required"),
  primaryContactNumber: z.string().min(1, "Required"),
  designation: z.string().min(1, "Required"),
  whatsappNumber: z.string().min(1, "Required"),
  bankAccountNumber: z.string().min(1, "Required"),
  bankName: z.string().min(1, "Required"),
  branchName: z.string().min(1, "Required"),
  ifscCode: z.string().min(1, "Required"),
});

export default function LedgerForm({
  mode = "create",
  disabled = false,
  ledgerId,
  initialData,
  categories = [],
}) {
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [loading, setLoading] = useState(mode === "edit" || mode ==="view");

  const [fileNames, setFileNames] = useState({});
  const [fileUrls, setFileUrls] = useState({});
  const [files, setFiles] = useState({});

  const tradeRef = useRef(null);
  const panRef = useRef(null);
  const gstnRef = useRef(null);
  const bankRef = useRef(null);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });
  const isViewMode = disabled;

  const fieldDisabled = isViewMode || !isEditing || isSubmitting;

  // ================= FILE =================
  const handleFileChange = (key, file) => {
    if (!file) {
      setFileNames((p) => ({ ...p, [key]: "" }));
      setFiles((p) => ({ ...p, [key]: null }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB allowed");
      return;
    }

    setFiles((p) => ({ ...p, [key]: file }));
    setFileNames((p) => ({
      ...p,
      [key]: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
    }));
  };

  //  LOAD
  useEffect(() => {
    if ((mode === "edit" || mode==="view") && initialData && categories.length > 0) {
      reset({
        ...initialData,
        categoryId: String(initialData.categoryId),
      });

      queueMicrotask(() => {
        setFileUrls({
          trade: initialData.tradeLicenceFile,
          pan: initialData.panFile,
          gstn: initialData.gstnFile,
          bank: initialData.bankDetailsFile,
        });

        setLoading(false);
      });
    }
  }, [initialData, categories]);

  //  SUBMIT
  const onSubmit = async () => {
    if (mode === "create") {
      if (!files.trade || !files.pan || !files.gstn || !files.bank) {
        toast.error("All files required");
        return;
      }
    }

    let toastId;

    try {
      toastId = toast.loading("Saving...");

      const values = getValues();
      const formData = new FormData();

      // ONLY REQUIRED FIELDS
      const allowedFields = [
        "ledgerName",
        "registeredAddress",
        "corporateAddress",
        "categoryId",
        "pan",
        "gstin",
        "stateCode",
        "stateName",
        "primaryContactPerson",
        "primaryContactNumber",
        "designation",
        "whatsappNumber",
        "bankAccountNumber",
        "bankName",
        "branchName",
        "ifscCode",
      ];

      allowedFields.forEach((key) => {
        let value = values[key];

        //   if (key === "categoryId") {
        //     value = value ? (value) : "";
        //   }

        formData.append(key, value ?? "");
      });

      //  FILES
      if (files.trade) formData.append("tradeLicenceFile", files.trade);
      if (files.pan) formData.append("panFile", files.pan);
      if (files.gstn) formData.append("gstnFile", files.gstn);
      if (files.bank) formData.append("bankDetailsFile", files.bank);

      // CREATE
      if (mode === "create") {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.CREATE_LEDGER,
          method: "POST",
          data: formData,
        });

        const d = res.data[0];

        setValue("ledgerCode", d.ledgerCode);

        setFileUrls({
          trade: d.tradeLicenceUrl,
          pan: d.panUrl,
          gstn: d.gstnUrl,
          bank: d.bankDetailsUrl,
        });

        setIsEditing(false);
        toast.success("Created", { id: toastId });

        // UPDATE
      } else {
        let res = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.UPDATE_LEDGER_BY_ID}/${ledgerId}`,
          method: "PUT",
          data: formData,
        });
        let d = res.data[0];
        setValue("ledgerCode", d.ledgerCode);

        setFileUrls({
          trade: d.tradeLicenceUrl,
          pan: d.panUrl,
          gstn: d.gstnUrl,
          bank: d.bankDetailsUrl,
        });

        setIsEditing(false);
        toast.success("Updated", { id: toastId });
      }
    } catch {
      toast.error("Failed", { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  const label =
    "w-[220px] px-3 py-1 bg-[#d6e6f2] border border-black rounded-md";
  const inputClass = "border h-[30px] px-2 text-sm";

  const renderFile = (key, ref, labelText) => (
    <div className="flex items-center gap-2">
      <div className="px-3 py-1 bg-[#8e7cc3] text-white md:min-w-50 rounded-md">
        {labelText}
      </div>

      {isEditing && (
        <button
          onClick={() => ref.current?.click()}
          className="bg-[#f6c85f] px-3 py-1 rounded cursor-pointer"
          disabled={isSubmitting}
        >
          @
        </button>
      )}

      {isEditing
        ? fileNames[key] && <span className="text-xs">{fileNames[key]}</span>
        : fileUrls[key] && (
            <button
              onClick={() => window.open(fileUrls[key])}
              className="text-blue-500 underline text-xs cursor-pointer"
            >
              Download
            </button>
          )}

      <input
        type="file"
        hidden
        ref={ref}
        onChange={(e) => handleFileChange(key, e.target.files[0])}
      />
    </div>
  );

  const handleCancel = () => {
    if (!initialData) return;

    // ✅ reset form values
    reset({
      ...initialData,
      categoryId: String(initialData.categoryId),
    });

    // ✅ restore file URLs
    setFileUrls({
      trade: initialData.tradeLicenceFile,
      pan: initialData.panFile,
      gstn: initialData.gstnFile,
      bank: initialData.bankDetailsFile,
    });

    // ✅ clear selected new files
    setFiles({});
    setFileNames({});

    // ✅ clear file inputs (important)
    if (tradeRef.current) tradeRef.current.value = "";
    if (panRef.current) panRef.current.value = "";
    if (gstnRef.current) gstnRef.current.value = "";
    if (bankRef.current) bankRef.current.value = "";

    // ✅ exit edit mode
    setIsEditing(false);
  };

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-0.5">
        {/* ROW 1 */}
        <div className="flex gap-2">
          <div className={label}>Ledger Code</div>
          <Input
            {...register("ledgerCode")}
            disabled
            className={`${getInputClass(false, true)} w-[200px]`}
          />
        </div>

        {/* ROW 2 */}
        <div className="flex flex-col">
          <div className="flex gap-2">
            <div className={label}>Ledger Name</div>
            <Input
              {...register("ledgerName")}
              disabled={fieldDisabled}
              className={`flex-1 ${getInputClass(errors.ledgerName, fieldDisabled)}`}
            />
          </div>
          {/* <p className={error}>{errors.ledgerName?.message}</p> */}
        </div>

        {/* ROW 3 */}
        <div className="flex flex-col">
          <div className="flex gap-2">
            <div className={label}>Registered Address</div>
            <Input
              {...register("registeredAddress")}
              disabled={fieldDisabled}
              className={`flex-1 ${getInputClass(errors.registeredAddress, fieldDisabled)}`}
            />
          </div>
          {/* <p className={error}>{errors.registeredAddress?.message}</p> */}
        </div>

        {/* ROW 4 */}
        <div className="flex flex-col">
          <div className="flex gap-2">
            <div className={label}>Corporate Address</div>
            <Input
              {...register("corporateAddress")}
              disabled={fieldDisabled}
              className={`flex-1 ${getInputClass(errors.corporateAddress, fieldDisabled)}`}
            />
          </div>
          {/* <p className={error}>{errors.corporateAddress?.message}</p> */}
        </div>
      </div>

      {/* VENDOR CATEGORY */}
      <div className="flex flex-col">
        <div className="flex gap-2">
          <div className={label}>Ledger Category</div>

          <select
            {...register("categoryId")}
            disabled={fieldDisabled}
            className={`flex-1 ${getInputClass(errors.categoryId, fieldDisabled)} disabled:cursor-not-allowed rounded-md`}
          >
            <option value="">Select</option>

            {categories.map((item) => (
              <option key={item.value} value={String(item.value)}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* <p className={error}>{errors.categoryId?.message}</p> */}
      </div>

      {/*  TWO COLUMN SECTION  */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10  ">
        {/* LEFT SIDE */}
        <div className="space-y-5">
          <div className="space-y-0.5">
            {/* PAN */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>PAN</div>
                <Input
                  {...register("pan")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.pan, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.pan?.message}</p> */}
            </div>

            {/* GSTN */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>GSTN</div>
                <Input
                  {...register("gstin")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.gstin, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.gstin?.message}</p> */}
            </div>
          </div>

          <div className="space-y-0.5">
            {/* PRIMARY CONTACT PERSON */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>Primary Contact Person</div>
                <Input
                  {...register("primaryContactPerson")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.primaryContactPerson, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.primaryContactPerson?.message}</p> */}
            </div>

            {/* PRIMARY CONTACT NUMBER */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>Primary Contact Number</div>
                <Input
                  {...register("primaryContactNumber")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.primaryContactPerson, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.primaryContactNumber?.message}</p> */}
            </div>
          </div>
          <div className="space-y-0.5">
            {/* BANK A/C */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>Bank A/c Number</div>
                <Input
                  {...register("bankAccountNumber")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.bankAccountNumber, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.bankAccountNumber?.message}</p> */}
            </div>

            {/* BANK NAME */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>Bank Name</div>
                <Input
                  {...register("bankName")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.bankName, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.bankName?.message}</p> */}
            </div>

            {/* BRANCH */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>Branch Name</div>
                <Input
                  {...register("branchName")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.branchName, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.branchName?.message}</p> */}
            </div>

            {/* IFSC */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>IFSC Code</div>
                <Input
                  {...register("ifscCode")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.ifscCode, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.ifscCode?.message}</p> */}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="space-y-5">
          <div className="space-y-0.5">
            {/* STATE CODE */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>State Code</div>
                <Input
                  {...register("stateCode")}
                  disabled
                  className={`flex-1 ${getInputClass(errors.stateCode, true)}`}
                />
              </div>
              {/* <p className={error}>{errors.stateCode?.message}</p> */}
            </div>

            {/* STATE NAME */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>State Name</div>
                <select
                  {...register("stateName")}
                  disabled={fieldDisabled}
                  onChange={(e) => {
                    const selectedState = e.target.value;
                    setValue("stateName", selectedState);
                    setValue("stateCode", getStateCodeByName(selectedState));
                  }}
                  className={`flex-1 ${getInputClass(errors.stateName, fieldDisabled)}`}
                >
                  <option value="">Select State</option>

                  {INDIAN_STATES.map((item) => (
                    <option key={item.code} value={item.state}>
                      {item.state}
                    </option>
                  ))}
                </select>
              </div>
              {/* <p className={error}>{errors.stateName?.message}</p> */}
            </div>
          </div>

          <div className="space-y-0.5">
            {/* DESIGNATION */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>Designation</div>
                <Input
                  {...register("designation")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.designation, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.designation?.message}</p> */}
            </div>

            {/* WHATSAPP */}
            <div className="flex flex-col">
              <div className="flex gap-2">
                <div className={label}>WhatsApp Number</div>
                <Input
                  {...register("whatsappNumber")}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(errors.whatsappNumber, fieldDisabled)}`}
                />
              </div>
              {/* <p className={error}>{errors.whatsappNumber?.message}</p> */}
            </div>
          </div>

          {/* FILE SECTION */}
          <div className=" space-y-0.5">
            {renderFile("trade", tradeRef, "Trade Licence")}
            {renderFile("pan", panRef, "PAN")}
            {renderFile("gstn", gstnRef, "GSTN")}
            {renderFile("bank", bankRef, "Bank Details Copy")}
          </div>
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex justify-end gap-3 mt-10">
        {!isViewMode && (
          <SaveButton
            onClick={() => handleSubmit(onSubmit)()}
            loading={isSubmitting}
            disabled={!isEditing || isSubmitting}
          />
        )}

        {mode === "edit" && !isViewMode && (
          <EditButton
            onClick={isEditing ? handleCancel : () => setIsEditing(true)}
          >
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        )}
      </div>
    </div>
  );
}
