"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ROLE } from "@/config/role.config";

// ---------------- SCHEMA ----------------
const MAX_SIZE = 5 * 1024 * 1024;

const schema = z.object({
  username: z.string().min(1, "Required"),
  role: z.string().min(1, "Please Select Role"),
  employeeCode: z.string().min(1, "Required"),
  email: z.string().email("Invalid"),
  mobile: z.string().min(10, "Invalid"),
  whatsapp: z.string().min(10, "Invalid"),
  password: z.string().optional(),
  status: z.string().min(1, "Required"),
});

export default function UserForm({ mode = "create", data }) {
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [signatureName, setSignatureName] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [previewSignature, setPreviewSignature] = useState("");

  const signatureRef = useRef(null);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      role: "",
      employeeCode: "",
      email: "",
      mobile: "",
      whatsapp: "",
      password: "",
      status: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
    getValues,
  } = form;

  // ---------------- LOAD EDIT DATA ----------------
  useEffect(() => {
    const apiCall = () => {
      if (data) {
        reset({
          username: data.username || "",
          role: data.role || "",
          employeeCode: data.employeeCode || "",
          email: data.email || "",
          mobile: data.mobile || "",
          whatsapp: data.whatsapp || "",
          password: "", // never prefill password
          status: String(data.status ? "true":"false"), // boolean → string
        });

        // signature preview (use URL)
        setPreviewSignature(data.signatureUrl || "");
      }
    }
    apiCall();

  }, []);

  // ---------------- FILE HANDLER ----------------

  const handleFileChange = (file) => {
    if (!file) {
      setSignatureName("");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];

    if (!allowedTypes.includes(file.type)) {
      setSignatureError("Only PNG/JPG allowed");
      return;
    }

    if (file.size > MAX_SIZE) {
      setSignatureError("File ≤ 5MB");
      return;
    }

    setSignatureError("");
    setSignatureName(file.name);
    setPreviewSignature(URL.createObjectURL(file));
  };

  // ---------------- SUBMIT ----------------
  const onSubmit = async () => {
    let toastId;

    try {
      if (!signatureRef.current?.files?.[0] && mode === "create") {
        setSignatureError("Required");
        return;
      }

      const values = getValues();
      if (mode === "create" && !values.password) {
        toast.error("Password is required");
        return;
      }
      toastId = toast.loading("Saving...");
      values.status = values.status === "true";
      const formData = new FormData();

      Object.entries(values).forEach(([k, v]) => {
        //skip empty password in edit mode
        if (k === "password" && mode === "edit" && !v) return;
        formData.append(k, v);
      }

      );

      const file = signatureRef.current?.files?.[0];
      if (file) formData.append("signature", file);

      let res= await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.SETTINGS.CREATE_USER
            : `${API_ENDPOINTS.SETTINGS.GET_USER_BY_ID}/${data.id}`,
        method: mode === "create" ? "POST" : "PUT",
        data: formData,
      });

      toast.success("Saved successfully", { id: toastId });

      setIsEditing(false);
      setPreviewSignature(res.data[0].signatureUrl || "");

    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  };

  // ---------------- CANCEL ----------------
  const handleEdit = () => {
    if (isEditing && mode === "edit") {
      reset({
          username: data.username || "",
          role: data.role || "",
          employeeCode: data.employeeCode || "",
          email: data.email || "",
          mobile: data.mobile || "",
          whatsapp: data.whatsapp || "",
          password: "", // never prefill password
          status: String(data.status ? "true":"false"), // boolean → string
        });

        // signature preview (use URL)
      setPreviewSignature(data.signatureUrl || "");
      setSignatureName("");
      setSignatureError("");
      if (signatureRef.current) {
      signatureRef.current.value = "";
    }
    }
    setIsEditing((prev) => !prev);
  };

  // ---------------- STYLES ----------------
  const inputClass =
    "h-[30px] border border-[#8f8f8f] text-sm bg-white rounded-sm";

  const labelClass =
    "w-[220px] px-3 py-1 bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm";

  const errorText = "text-red-500 text-[10px] h-[14px] mt-[2px]";

  return (
    <div className="p-4 space-y-1">

      {/* USERNAME + ROLE */}
      <div className="md:flex md:items-center">
        <div className={labelClass}>User Name</div>

        <Input
          {...register("username")}
          disabled={!isEditing || isSubmitting}
          className={`${inputClass} w-[250px] -ml-px`}
        />

        <select
          {...register("role")}
          disabled={!isEditing || isSubmitting}
          className="
                ml-4
                h-7.5
                px-2
                text-sm
                border border-[#8f8f8f]
                bg-white
                rounded-sm
                outline-none
                focus:ring-1 focus:ring-blue-400
                cursor-pointer
                disabled:bg-gray-100 disabled:cursor-not-allowed
                "
        >
          <option value={ROLE.USER}>General User</option>
          <option value={ROLE.SUPER_ADMIN}>Super Admin</option>
          <option value={ROLE.ADMIN}>Admin</option>
        </select>
      </div>
      <p className={errorText}>{errors.username?.message}</p>

      {/* OTHER FIELDS */}
      {[
        ["Employee Code", "employeeCode"],
        ["Email", "email"],
        ["Mobile Number", "mobile"],
        ["WhatsApp Number", "whatsapp"],
        ["Password", "password"],
      ].map(([label, key]) => {
        const finalLabel =
          key === "password"
            ? mode === "edit"
              ? "Password (leave blank to keep unchanged)"
              : "Password"
            : label;

        return (
          <div key={key}>
            <div className="md:flex md:items-center">
              <div className={labelClass}>{finalLabel}</div>

              <Input
                {...register(key)}
                disabled={!isEditing || isSubmitting}
                className={`${inputClass} w-[250px] -ml-px`}
              />
            </div>

            <p className={errorText}>{errors[key]?.message}</p>
          </div>
        );
      })}
      {/* STATUS FIELD */}
      <div>
        <div className="md:flex md:items-center">
          <div className={labelClass}>Status</div>

          <select
            {...register("status")}
            disabled={!isEditing || isSubmitting}
            className={`${inputClass} w-62.5 -ml-px focus:ring-1 focus:ring-blue-400
                cursor-pointer
                disabled:bg-gray-100 disabled:cursor-not-allowed`}
          >
            <option value="true">Active</option>
            <option value="false">Suspended</option>
          </select>
        </div>

        <p className={errorText}>{errors.status?.message}</p>
      </div>

      {/* SIGNATURE */}
      <div className="pt-2">
        <div className="flex items-center gap-2">

          <div className="px-3 py-1 min-w-37.5 text-center bg-[#8e7cc3] text-white text-md rounded-sm">
            Signature
          </div>

          <button
            onClick={() => signatureRef.current.click()}
            disabled={!isEditing || isSubmitting}
            className="px-3 py-1 bg-[#f6c85f] text-sm rounded-sm cursor-pointer"
          >
            @
          </button>

          {signatureName && (
            <span className="text-[10px]">{signatureName}</span>
          )}

          <input
            ref={signatureRef}
            type="file"
            hidden
            accept="image/png, image/jpeg, image/jpg"
            onChange={(e) =>
              handleFileChange(e.target.files?.[0])
            }
          />
        </div>

        <p className={errorText}>{signatureError}</p>

        {/* PREVIEW */}
        {previewSignature && (
          <div className="mt-4">
            <img
              src={previewSignature}
              alt="signature"
              className="h-[120px]"
            />
          </div>
        )}
      </div>

      {/* FOOTER SIGN */}
      <div className="pt-6 mt-14">
        <p>(User Name | EC)</p>
        <div className="border-t w-[200px]" />
        <p>(Authorised Signatory)</p>
      </div>

      {/* BUTTONS */}
      <div className="flex justify-end gap-3 mt-10">
        <SaveButton
          onClick={() => handleSubmit(onSubmit)()}
          loading={isSubmitting}
          disabled={!isEditing || isSubmitting}
        />

        {mode === "edit" && (
          <EditButton onClick={handleEdit} disabled={isSubmitting}>
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        )}
      </div>
    </div>
  );
}