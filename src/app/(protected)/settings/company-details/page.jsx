"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { clearAuthCookies, getCookie, setCookie } from "@/lib/cookies";
import { Paperclip } from "lucide-react";
import { openFileWithAuth } from "@/lib/fileViewer";

import { useForm } from "react-hook-form";
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
const MAX_SIZE = 5 * 1024 * 1024;

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

  contactNumber: z.string().min(10, "Invalid").max(10, "Invalid"),

  whatsappNumber: z.string().min(10, "Invalid").max(10, "Invalid"),

  email: z.string().min(1, "Required").email("Invalid email"),
});

export default function CompanyDetailsPage() {
  const [isEditing, setIsEditing] = useState(false);

  const panRef = useRef(null);
  const gstnRef = useRef(null);
  const [panUrl, setPanUrl] = useState("");
  const [gstUrl, setGstUrl] = useState("");

  const [panFileName, setPanFileName] = useState("");
  const [gstFileName, setGstFileName] = useState("");
  const [panFileError, setPanFileError] = useState("");
  const [gstFileError, setGstFileError] = useState("");
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

  //  FILE HANDLER
  const handleFileChange = (type, file) => {
    if (!file) {
      // clear if user cancels selection
      if (type === "pan") setPanFileName("");
      else setGstFileName("");
      return;
    }

    if (file.size > MAX_SIZE) {
      type === "pan"
        ? setPanFileError("File must be ≤ 5MB")
        : setGstFileError("File must be ≤ 5MB");
      return;
    }

    const display = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    if (type === "pan") {
      setPanFileError("");
      setPanFileName(display);
    } else {
      setGstFileError("");
      setGstFileName(display);
    }
  };

  // SUBMIT
  const onSubmit = async () => {
    let toastId;
    try {
      let hasError = false;
      if (!panRef.current?.files?.[0] && !panUrl) {
        setPanFileError("Pan File Required");
        hasError = true;
      }

      if (!gstnRef.current?.files?.[0] && !gstUrl) {
        setGstFileError("GSTN File Required");
        hasError = true;
      }

      if (hasError) {
        toast.info("Some Fields required.");
        return;
      }

      const rawId = getCookie("companyId");
      const companyId = Number(rawId);

      const isUpdate = !!companyId;
      toastId = toast.loading(
        isUpdate ? "Updating company details..." : "Saving company details...",
      );

      const values = {
        ...getValues(),
        stateCode: getStateCodeByName(getValues().state || ""),
      };
      const formDataPayload = new FormData();

      Object.entries(values).forEach(([key, value]) => {
        formDataPayload.append(key, value);
      });

      if (panRef.current?.files?.[0]) {
        formDataPayload.append("panFile", panRef.current.files[0]);
      }

      if (gstnRef.current?.files?.[0]) {
        formDataPayload.append("gstnFile", gstnRef.current.files[0]);
      }

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
      setPanUrl(resp.data[0].panUrl);
      setGstUrl(resp.data[0].gstUrl);
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

      setPanFileName("");
      setGstFileName("");
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
                <div className="md:flex md:items-center gap-2">
                  <div className="md:flex md:items-center">
                    <div className={labelClass}>PAN</div>

                    <Input
                      {...register("pan")}
                      onChange={(e) =>
                        setValue("pan", e.target.value.toUpperCase())
                      }
                      disabled={!isEditing || isSubmitting}
                      className={`${getInputClass(errors.pan, !isEditing || isSubmitting)} w-65 -ml-px`}
                    />
                  </div>

                  <button className="md:ml-[250px] px-3 py-1  bg-[#8e7cc3] text-white text-sm rounded-sm">
                    Attached PAN
                  </button>

                  <button
                    onClick={() => panRef.current.click()}
                    disabled={!isEditing || isSubmitting}
                    className="px-3 py-1 bg-[#f6c85f] text-sm rounded-sm"
                  >
                    @
                  </button>
                  {/* 🔗 OPEN FILE */}
                  {panUrl && !panFileName && (
                    <a
                      href={panUrl}
                      download="PAN_File"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline ml-2"
                    >
                      <Paperclip className="w-3 h-3" />
                      View Attached PAN
                    </a>
                  )}

                  {panFileName && (
                    <span className="text-[10px] whitespace-nowrap">
                      {panFileName}
                    </span>
                  )}

                  <input
                    ref={panRef}
                    type="file"
                    hidden
                    accept="application/pdf"
                    onChange={(e) => handleFileChange("pan", e.target.files[0])}
                  />
                </div>

                {/* <p className={errorText}>{errors.pan?.message}</p>
        <p className={errorText}>{panFileError}</p> */}
              </div>

              {/* GSTN */}
              <div>
                <div className="md:flex md:items-center gap-2">
                  <div className="md:flex md:items-center">
                    <div className={labelClass}>GSTN</div>
                    <Input
                      {...register("gstn")}
                      onChange={(e) =>
                        setValue("gstn", e.target.value.toUpperCase())
                      }
                      disabled={!isEditing || isSubmitting}
                      className={`${getInputClass(errors.gstn, !isEditing || isSubmitting)} w-65 -ml-px`}
                    />
                  </div>

                  <button className="md:ml-[250px] px-3 py-1 bg-[#8e7cc3] text-white text-sm rounded-sm">
                    Attached GSTN
                  </button>

                  <button
                    onClick={() => gstnRef.current.click()}
                    disabled={!isEditing || isSubmitting}
                    className="px-3 py-1 bg-[#f6c85f] text-sm rounded-sm"
                  >
                    @
                  </button>

                  {gstUrl && !gstFileName && (
                    <a
                      href={gstUrl}
                      download="GSTN_File"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline ml-2"
                    >
                      <Paperclip className="w-3 h-3" />
                      View Attached GSTN
                    </a>
                  )}

                  {gstFileName && (
                    <span className="text-[10px] whitespace-nowrap">
                      {gstFileName}
                    </span>
                  )}

                  <input
                    ref={gstnRef}
                    type="file"
                    hidden
                    accept="application/pdf"
                    onChange={(e) => handleFileChange("gst", e.target.files[0])}
                  />
                </div>

                {/* <p className={errorText}>{errors.gstn?.message}</p>
        <p className={errorText}>{gstFileError}</p> */}
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
                <Input
                  {...register("contactNumber")}
                  disabled={!isEditing || isSubmitting}
                  className={`${getInputClass(errors.contactNumber, !isEditing || isSubmitting)} w-65 -ml-px`}
                />
              </div>
              {/* <p className={errorText}>{errors.contactNumber?.message}</p> */}
            </div>

            <div>
              <div className="md:flex md:items-center">
                <div className={labelClass}>WhatsApp Number</div>
                <Input
                  {...register("whatsappNumber")}
                  disabled={!isEditing || isSubmitting}
                  className={`${getInputClass(errors.whatsappNumber, !isEditing || isSubmitting)} w-65 -ml-px`}
                />
              </div>
              {/* <p className={errorText}>{errors.whatsappNumber?.message}</p> */}
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
