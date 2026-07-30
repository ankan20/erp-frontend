"use client";

import { useState, useEffect } from "react";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/common/PhoneInput";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { clearAuthCookies, getCookie, setCookie } from "@/lib/cookies";
import FileUploadInline, { ACCEPT_PDF, TYPES_PDF } from "@/components/common/FileUploadInline";

import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import {
  INDIAN_STATES,
  getStateCodeByName,
} from "@/config/indianStates.config";
import { activeLabelClass, getInputClass, labelClass } from "@/lib/formStyles";

// ---------------- SCHEMA ----------------

const schema = z.object({
  companyName: z.string().min(1, "Required"),
  registeredAddress: z.string().min(1, "Required"),
  corporateAddress: z.string().min(1, "Required"),

  pan: z.string().min(10, "Required"),
  gstn: z.string().min(15, "Required"),

  state: z.string().min(1, "Required"),
  stateCode: z.string().min(1, "Required"),

  gstnType: z.string().min(1, "Required"),

  contactPerson: z.string().min(1, "Required"),

  contactNumber: z.string().refine((v) => (v || "").replace(/\D/g, "").length === 10, "Invalid number"),

  whatsappNumber: z.string().refine((v) => (v || "").replace(/\D/g, "").length === 10, "Invalid number"),

  email: z.string().min(1, "Required").email("Invalid email"),
});

export default function CompanyDetailsPage() {
  const [isEditing, setIsEditing] = useState(false);

  const [panUrl, setPanUrl] = useState("");
  const [gstUrl, setGstUrl] = useState("");
  const [panFile, setPanFile] = useState(null);
  const [gstFile, setGstFile] = useState(null);
  const [panResetKey, setPanResetKey] = useState(0);
  const [gstResetKey, setGstResetKey] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [initialData, setInitialData] = useState(null);
  const emptyFormValues = {
    companyName: "",
    registeredAddress: "",
    corporateAddress: "",
    pan: "",
    gstn: "",
    state: "",
    gstnType: "",
    contactPerson: "",
    contactNumber: "",
    whatsappNumber: "",
    email: "",
    stateCode: "",
  };
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      registeredAddress: "",
      corporateAddress: "",
      pan: "",
      gstn: "",
      state: "",
      gstnType: "",
      contactPerson: "",
      contactNumber: "",
      whatsappNumber: "",
      email: "",
      stateCode: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    getValues,
    reset,
    watch,
    control,
  } = form;

  //Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = Number(getCookie("companyId"));
        if (!id) {
          setLoadingData(false);
          setTimeout(() => {
            toast.info("Create company details.");
          }, 100);
          return;
        }
        const res = await apiRequest({
          url: `${API_ENDPOINTS.SETTINGS.GET_COMPANY_DETAILS_BY_ID}/${id}`,
          method: "GET",
        });
        if (!res.data.length) {
          toast.info(res.message || "No company data found.");
          return;
        }
        const data = res.data[0];

        reset({
          ...data,
          stateCode: getStateCodeByName(data.state || ""),
        });

        setInitialData({
          ...data,
          stateCode: getStateCodeByName(data.state || ""),
        });

        setPanUrl(data.panUrl);
        setGstUrl(data.gstnUrl);
      } catch (err) {
        toast.error("Failed to fetch company data");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, []);


  // SUBMIT
  const onSubmit = async () => {
    let toastId;
    try {
      if (!panFile && !panUrl) {
        toast.error("PAN file is required.");
        return;
      }
      if (!gstFile && !gstUrl) {
        toast.error("GSTN file is required.");
        return;
      }

      const rawId = getCookie("companyId");
      const companyId = Number(rawId);

      const isUpdate = !!companyId;
      toastId = toast.loading(
        isUpdate ? "Updating company details..." : "Saving company details...",
      );

      const raw = getValues();
      const normalizePhone = (v) => {
        const digits = (v || "").replace(/\D/g, "").slice(-10);
        return digits.length === 10 ? `+91${digits}` : v || "";
      };
      const values = {
        ...raw,
        stateCode: getStateCodeByName(raw.state || ""),
        contactNumber: normalizePhone(raw.contactNumber),
        whatsappNumber: normalizePhone(raw.whatsappNumber),
      };
      const formDataPayload = new FormData();

      Object.entries(values).forEach(([key, value]) => {
        formDataPayload.append(key, value);
      });

      if (panFile) formDataPayload.append("panFile", panFile);
      if (gstFile) formDataPayload.append("gstnFile", gstFile);

      let resp = await apiRequest({
        url: isUpdate
          ? `${API_ENDPOINTS.SETTINGS.GET_COMPANY_DETAILS_BY_ID}/${companyId}`
          : API_ENDPOINTS.SETTINGS.CREATE_COMPANY,
        method: isUpdate ? "PUT" : "POST",
        data: formDataPayload,
      });
      // console.log(resp);
      if (!isUpdate) {
        setCookie("companyId", resp.data[0].companyId);
      }
      toast.success(
        isUpdate
          ? "Company details updated successfully"
          : "Saved successfully",
        { id: toastId },
      );

      const updatedValues = {
        ...values,
        stateCode: getStateCodeByName(values.state || ""),
      };

      setInitialData(updatedValues);

      reset(updatedValues);
      setPanUrl(resp.data[0].panUrl || "");
      setGstUrl(resp.data[0].gstUrl || "");
      setPanFile(null);
      setGstFile(null);
      setPanResetKey((k) => k + 1);
      setGstResetKey((k) => k + 1);
      setIsEditing(false);
      setTimeout(() => {
        // window.location.reload();
      }, 1000);
    } catch (err) {
      toast.error(err.message || "Save failed", { id: toastId });
    }
  };

  const handleEdit = () => {
    if (isSubmitting) return;

    const nextEditingState = !isEditing;

    // CANCEL CLICKED
    if (!nextEditingState) {
      reset(initialData || emptyFormValues);
      setPanFile(null);
      setGstFile(null);
      setPanResetKey((k) => k + 1);
      setGstResetKey((k) => k + 1);
    }

    setIsEditing(nextEditingState);
  };


  const errorText = "text-red-500 text-[10px] h-[14px] mt-[2px]";
  const actions = getPageActions({
    router,
  });

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-75">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <div className="p-4 space-y-2">
          {/* COMPANY NAME */}
          <div>
            <div className="md:flex md:items-center">
              <div className={activeLabelClass}>Company Name</div>

              <Input
                {...register("companyName")}
                disabled={!isEditing || isSubmitting}
                className={`${getInputClass(errors.companyName, !isEditing || isSubmitting)} flex-1 -ml-px`}
              />
            </div>
            {/* <p className={errorText}>{errors.companyName?.message}</p> */}
          </div>

          <div className="mt-5">
            {/* REGISTERED ADDRESS */}
            <div>
              <div className="md:flex md:items-center">
                <div className={labelClass}>Registered Address</div>
                <Input
                  {...register("registeredAddress")}
                  disabled={!isEditing || isSubmitting}
                  className={`${getInputClass(errors.registeredAddress, !isEditing || isSubmitting)} flex-1 -ml-px`}
                />
              </div>
              {/* <p className={errorText}>{errors.registeredAddress?.message}</p> */}
            </div>

            {/* CORPORATE ADDRESS */}
            <div>
              <div className="md:flex md:items-center">
                <div className={labelClass}>Corporate Address</div>
                <Input
                  {...register("corporateAddress")}
                  disabled={!isEditing || isSubmitting}
                  className={`${getInputClass(errors.corporateAddress, !isEditing || isSubmitting)} flex-1 -ml-px`}
                />
              </div>
              {/* <p className={errorText}>{errors.corporateAddress?.message}</p> */}
            </div>
          </div>

          <div className="mt-5">
            <div>
              {/* PAN */}
              <div>
                <div className="md:flex md:items-center gap-8 lg:gap-28 xl:gap-56 flex-wrap">
                  <div className="md:flex md:items-center">
                    <div className={labelClass}>PAN</div>
                    <Input
                      {...register("pan")}
                      onChange={(e) => setValue("pan", e.target.value.toUpperCase())}
                      disabled={!isEditing || isSubmitting}
                      className={`${getInputClass(errors.pan, !isEditing || isSubmitting)} w-65 -ml-px`}
                    />
                  </div>
                  <FileUploadInline
                    label="Attached PAN"
                    onChange={(file) => setPanFile(file)}
                    existingUrl={panUrl}
                    onClearExisting={() => setPanUrl("")}
                    disabled={!isEditing || isSubmitting}
                    resetKey={panResetKey}
                    accept={ACCEPT_PDF}
                    allowedTypes={TYPES_PDF}
                    maxSize={5 * 1024 * 1024}
                  />
                </div>
              </div>

              {/* GSTN */}
              <div>
                <div className="md:flex md:items-center gap-8 lg:gap-28 xl:gap-56 flex-wrap">
                  <div className="md:flex md:items-center">
                    <div className={labelClass}>GSTN</div>
                    <Input
                      {...register("gstn")}
                      onChange={(e) => setValue("gstn", e.target.value.toUpperCase())}
                      disabled={!isEditing || isSubmitting}
                      className={`${getInputClass(errors.gstn, !isEditing || isSubmitting)} w-65 -ml-px`}
                    />
                  </div>
                  <FileUploadInline
                    label="Attached GSTN"
                    onChange={(file) => setGstFile(file)}
                    existingUrl={gstUrl}
                    onClearExisting={() => setGstUrl("")}
                    disabled={!isEditing || isSubmitting}
                    resetKey={gstResetKey}
                    accept={ACCEPT_PDF}
                    allowedTypes={TYPES_PDF}
                    maxSize={5 * 1024 * 1024}
                  />
                </div>
              </div>
            </div>

            <div>
              {/* STATE + CODE */}
              <div>
                <div className="md:flex md:items-center">
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
                          ${getInputClass(errors.state, !isEditing || isSubmitting)}
                          w-65 -ml-px
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

                  <div
                    className={`w-[100px] px-3 py-1 bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm md:ml-4`}
                  >
                    State Code
                  </div>
                  {/* <Input
                    {...register("stateCode")}
                    disabled={!isEditing || isSubmitting}
                    className={`${getInputClass(errors.stateCode)} w-25 -ml-px`}
                  /> */}
                  <Input
                    {...register("stateCode")}
                    readOnly
                    disabled
                    className={`${getInputClass(errors.stateCode, true)} w-25 -ml-px`}
                  />
                </div>

                {/* <p className={errorText}>
          {errors.state?.message || errors.stateCode?.message}
        </p> */}
              </div>

              {/* GST TYPE */}
              <div>
                <div className="md:flex md:items-center">
                  <div className={labelClass}>GSTN Type</div>

                  <select
                    {...register("gstnType")}
                    disabled={!isEditing || isSubmitting}
                    className={`
        ${getInputClass(errors.gstnType, !isEditing || isSubmitting)}
        w-65 -ml-px
        disabled:opacity-100
        disabled:text-black
        disabled:cursor-default
      `}
                  >
                    <option value="">Select GST Type</option>

                    <option value="Regular">Regular</option>

                    <option value="Composite">Composite</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CONTACT */}
          <div className=" pt-3">
            <div>
              <div className="md:flex md:items-center">
                <div className={labelClass}>Contact Person</div>
                <Input
                  {...register("contactPerson")}
                  disabled={!isEditing || isSubmitting}
                  className={`${getInputClass(errors.contactPerson, !isEditing || isSubmitting)} w-65 -ml-px`}
                />
              </div>
              {/* <p className={errorText}>{errors.contactPerson?.message}</p> */}
            </div>

            <div>
              <div className="md:flex md:items-center">
                <div className={labelClass}>Contact Number</div>
                <Controller
                  name="contactNumber"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      {...field}
                      disabled={!isEditing || isSubmitting}
                      hasError={!!errors.contactNumber}
                      outputFormat="e164"
                      className="w-65 -ml-px"
                    />
                  )}
                />
              </div>
            </div>

            <div>
              <div className="md:flex md:items-center">
                <div className={labelClass}>WhatsApp Number</div>
                <Controller
                  name="whatsappNumber"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      {...field}
                      disabled={!isEditing || isSubmitting}
                      hasError={!!errors.whatsappNumber}
                      outputFormat="e164"
                      className="w-65 -ml-px"
                    />
                  )}
                />
              </div>
            </div>

            <div>
              <div className="md:flex md:items-center">
                <div className={labelClass}>Email ID</div>
                <Input
                  {...register("email")}
                  disabled={!isEditing || isSubmitting}
                  className={`${getInputClass(errors.email, !isEditing || isSubmitting)} w-65 -ml-px`}
                />
              </div>
              {/* <p className={errorText}>{errors.email?.message}</p> */}
            </div>
          </div>

          {/* ACTION */}
          <div className="flex justify-end gap-3  mt-5">
            <SaveButton
              onClick={() => handleSubmit(onSubmit)()}
              loading={isSubmitting}
              disabled={!isEditing || isSubmitting}
            />

            <EditButton onClick={handleEdit} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          </div>
        </div>
      </HeaderWrapper>
    </>
  );
}
