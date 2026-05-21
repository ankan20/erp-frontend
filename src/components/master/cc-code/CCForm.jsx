"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { getInputClass } from "@/lib/formStyles";

const schema = z.object({
  ccCode: z.string().min(1, "Required"),
  ccName: z.string().min(1, "Required"),
  groupId: z.string().min(1, "Required"),
  categoryId: z.string().min(1, "Required"),
});

export default function CCForm({
  mode = "create",
  disabled = false,
  ccId,
  data,
}) {
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(mode === "create");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ccCode: "",
      ccName: "",
      groupId: "",
      categoryId: "",
    },
  });
  const isViewMode = disabled;
  const fieldDisabled = isViewMode || !isEditing || isSubmitting;

  // FETCH GROUP + CATEGORY
  useEffect(() => {
    const loadMaster = async () => {
      // const [g, c] = await Promise.all([
      //   apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_GROUP }),
      //   apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CATEGORY }),
      // ]);
      const g = await apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_GROUP });
      const ccOptions = CATEGORY_OPTIONS.ccCategory;
      setGroups(g.data || []);
      setCategories(ccOptions || []);
      if (data && (mode === "edit" || mode==="view")) {
        reset(data);
      }
      setLoading(false);
    };

    loadMaster();
  }, []);

  //  EDIT FETCH
  //   useEffect(() => {
  //     if (mode === "edit" && ccId) {
  //       const fetchData = async () => {
  //         try {
  //           const res = await apiRequest({
  //             url: `${API_ENDPOINTS.MASTER.GET_CC_CODE_BY_ID}/${ccId}`,
  //           });

  //           const d = res.data[0];

  //           reset({
  //             ccCode: d.ccCode,
  //             ccName: d.ccName,
  //             groupId: String(d.ccGroupId),
  //             categoryId: String(d.ccCategoryId),
  //           });

  //         } catch {
  //           toast.error("Failed to fetch");
  //         } finally {
  //           setLoading(false);
  //         }
  //       };

  //       fetchData();
  //     } else {
  //       setLoading(false);
  //     }
  //   }, [ccId]);

  //  SUBMIT
  const onSubmit = async () => {
    let toastId;
    const values = getValues();

    try {
      toastId = toast.loading("Saving...");

      const payload = {
        ccCode: values.ccCode,
        ccName: values.ccName,
        groupId: Number(values.groupId),
        categoryId: values.categoryId,
      };

      if (mode === "create") {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.CREATE_CC_CODE,
          method: "POST",
          data: payload,
        });

        toast.success(res.message || "Created", { id: toastId });
        setIsEditing(false);
      } else {
        let resp = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.UPDATE_CC_CODE_BY_ID}/${ccId}`,
          method: "PUT",
          data: payload,
        });

        toast.success(resp.message || "Updated", { id: toastId });

        //refetch
        const res = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.GET_CC_CODE_BY_ID}/${ccId}`,
        });

        const d = res.data[0];

        reset({
          ccCode: d.ccCode,
          ccName: d.ccName,
          groupId: String(d.ccGroupId),
          categoryId: String(d.ccCategoryId),
        });

        setIsEditing(false);
      }
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  };
  const handleCancel = () => {
    if (!data) return;

    // restore original values
    reset({
      ccCode: data.ccCode,
      ccName: data.ccName,
      groupId: String(data.ccGroupId || data.groupId),
      categoryId: String(data.ccCategoryId || data.categoryId),
    });

    // exit edit mode
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-75">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  const inputClass = "border h-[30px] px-2 text-sm";

  return (
    <div className="p-4 space-y-3">
      {/* CC CODE */}
      <div className="flex gap-2">
        <div className="w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md">
          CC Code
        </div>
        <Input
          {...register("ccCode")}
          disabled={fieldDisabled}
          className={`${getInputClass(errors.ccCode, fieldDisabled)} w-[200px]`}
        />
      </div>

      {/* CC NAME */}
      <div className="flex flex-col">
        <div className="flex gap-2">
          <div className="w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md">
            CC Name
          </div>
          <Input
            {...register("ccName")}
            disabled={fieldDisabled}
            className={`flex-1 ${getInputClass(errors.ccName, fieldDisabled)}`}
          />
        </div>
      </div>

      {/* GROUP */}
      <div className="flex flex-col">
        <div className="flex gap-2">
          <div className="w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md">
            Group
          </div>

          <select
            {...register("groupId")}
            disabled={fieldDisabled}
            className={`flex-1 ${getInputClass(errors.groupId, fieldDisabled)}  disabled:cursor-not-allowed rounded-md`}
          >
            <option value="">Select</option>
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.groupName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CATEGORY */}
      <div className="flex flex-col">
        <div className="flex gap-2">
          <div className="w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md">
            Category
          </div>

          <select
            {...register("categoryId")}
            disabled={fieldDisabled}
            className={`flex-1 ${getInputClass(errors.categoryId, fieldDisabled)} disabled:cursor-not-allowed rounded-md`}
          >
            <option value="">Select</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
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
            disabled={isSubmitting}
          >
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        )}
      </div>
    </div>
  );
}
