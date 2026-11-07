"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";

import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ROLE } from "@/config/role.config";
import { getInputClass, labelClass } from "@/lib/formStyles";
import { useRouter } from "next/navigation";

// ---------------- SCHEMA ----------------
const MAX_SIZE = 5 * 1024 * 1024;

export default function UserForm({ mode = "create", data }) {
  const schema = z.object({
    username: z.string().min(1, "Required"),
    role: z.string().min(1, "Please SingleSelect Role"),
    employeeCode: z.string().min(1, "Required"),
    email: z.string().email("Invalid"),
    mobile: z.string().min(10, "Invalid"),
    whatsapp: z.string().min(10, "Invalid"),
    password:
      mode === "create" ? z.string().min(1, "Required") : z.string().optional(),
    status: z.string().min(1, "Required"),
  });
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [signatureName, setSignatureName] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [previewSignature, setPreviewSignature] = useState("");
  const router = useRouter();

  const signatureRef = useRef(null);

  // Profile photo (upload only — no preview)
  const [photoName, setPhotoName] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const photoRef = useRef(null);

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

  //  LOAD EDIT DATA
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
          status: String(data.status ? "true" : "false"), // boolean → string
        });

        // signature preview (use URL)
        setPreviewSignature(data.signatureUrl || "");
        setHasPhoto(!!data.profilePictureUrl);
      }
    };
    apiCall();
  }, []);

  //  FILE HANDLER

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

  //  PROFILE PHOTO HANDLER
  const handlePhotoChange = (file) => {
    if (!file) {
      setPhotoName("");
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setPhotoError("Only PNG/JPG/WEBP allowed");
      if (photoRef.current) photoRef.current.value = "";
      setPhotoName("");
      return;
    }
    if (file.size > MAX_SIZE) {
      setPhotoError("File ≤ 5MB");
      if (photoRef.current) photoRef.current.value = "";
      setPhotoName("");
      return;
    }
    setPhotoError("");
    setPhotoName(file.name);
  };

  //  SUBMIT
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
      });

      const file = signatureRef.current?.files?.[0];
      if (file) formData.append("signature", file);

      const photo = photoRef.current?.files?.[0];
      if (photo) formData.append("profilePicture", photo);

      let res = await apiRequest({
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
      setHasPhoto(!!res.data[0].profilePictureUrl);
      setPhotoName("");
      if (mode == "create" || mode == "edit") {
        setTimeout(() => {
          router.push("/settings/user-id-password/");
        }, 400);
      }
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
        status: String(data.status ? "true" : "false"), // boolean → string
      });

      // signature preview (use URL)
      setPreviewSignature(data.signatureUrl || "");
      setSignatureName("");
      setSignatureError("");
      if (signatureRef.current) {
        signatureRef.current.value = "";
      }
      setPhotoName("");
      setPhotoError("");
      if (photoRef.current) {
        photoRef.current.value = "";
      }
    }
    setIsEditing((prev) => !prev);
  };

  // STYLE
  const errorText = "text-red-500 text-[10px] h-[14px] mt-[2px]";

  return (
    <div className="p-4 ">
      {/* USERNAME + ROLE */}
      <div className="md:flex md:items-center">
        <div className={labelClass}>User Name</div>

        <Input
          {...register("username")}
          disabled={!isEditing || isSubmitting}
          className={`${getInputClass(errors.username, !isEditing || isSubmitting)} w-[250px] -ml-px`}
        />

        <select
          {...register("role")}
          disabled={!isEditing || isSubmitting}
          className={`
                ${getInputClass(errors.role, !isEditing || isSubmitting)}
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
                0 disabled:cursor-not-allowed
          `}
        >
          <option value="">Select Type</option>
          <option value={ROLE.USER}>General User</option>
          <option value={ROLE.SUPER_ADMIN}>Super Admin</option>
          <option value={ROLE.ADMIN}>Admin</option>
        </select>
      </div>
      {/* <p className={errorText}>{errors.username?.message}</p> */}

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
              ? "Password"
              : "Password"
            : label;

        return (
          <div
            key={key}
            className={`${key == "password" || key == "email" ? "mt-3" : ""}`}
          >
            <div className="md:flex md:items-center">
              <div className={labelClass}>{finalLabel}</div>

              <Input
                {...register(key)}
                disabled={!isEditing || isSubmitting}
                className={`${getInputClass(errors[key], !isEditing || isSubmitting)} w-[250px] -ml-px`}
              />
            </div>

            {/* <p className={errorText}>{errors[key]?.message}</p> */}
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
            className={`${getInputClass(errors.status, !isEditing || isSubmitting)} w-62.5 -ml-px focus:ring-1 focus:ring-blue-400
                cursor-pointer
                 disabled:cursor-not-allowed`}
          >
            <option value="true">Active</option>
            <option value="false">Suspended</option>
          </select>
        </div>

        {/* <p className={errorText}>{errors.status?.message}</p> */}
      </div>

      {/* SIGNATURE */}
      <div className="pt-2 mt-3">
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
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
        </div>

        <p className={errorText}>{signatureError}</p>

        {/* PREVIEW */}
        {previewSignature && (
          <div className="mt-4">
            <img src={previewSignature} alt="signature" className="h-[120px]" />
          </div>
        )}
      </div>

      {/* PROFILE PHOTO (upload only) */}
      <div className="pt-2 mt-1">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 min-w-37.5 text-center bg-[#6fa8dc] text-white text-md rounded-sm">
            Profile Photo
          </div>

          <button
            type="button"
            onClick={() => photoRef.current.click()}
            disabled={!isEditing || isSubmitting}
            className="px-3 py-1 bg-[#f6c85f] text-sm rounded-sm cursor-pointer disabled:cursor-not-allowed"
          >
            @
          </button>

          {photoName ? (
            <span className="text-[10px]">{photoName}</span>
          ) : (
            hasPhoto && <span className="text-[10px] text-green-700">Uploaded</span>
          )}

          <input
            ref={photoRef}
            type="file"
            hidden
            accept="image/png, image/jpeg, image/jpg, image/webp"
            onChange={(e) => handlePhotoChange(e.target.files?.[0])}
          />
        </div>

        <p className={errorText}>{photoError}</p>
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
