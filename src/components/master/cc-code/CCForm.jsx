"use client";

import { useEffect, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
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
import SubGroupCascade from "@/components/master/cc-code/SubGroupCascade";

const schema = z.object({
  ccCode: z.string().min(1, "Required"),
  ccName: z.string().min(1, "Required"),
  groupId: z.string().min(1, "Required"),
  categoryId: z.string().min(1, "Required"),
  subGroupId: z.string().optional(),
});

export default function CCForm({
  mode = "create",
  disabled = false,
  ccId,
  data,
}) {
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  // selected sub group ids from top level down, e.g. [4, 9, 15]
  const [subGroupPath, setSubGroupPath] = useState(data?.subGroupPath || []);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(mode === "create");
  // user-selected at the top; null until chosen
  const [headUnder, setHeadUnder] = useState(data?.headUnder ?? null);
  // null = P&L (not applicable), false = Ledger Head, true = Non-Ledger
  const [isNonLedger, setIsNonLedger] = useState(
    data?.isNonLedger !== undefined ? data.isNonLedger : null
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ccCode: "",
      ccName: "",
      groupId: "",
      categoryId: "",
      subGroupId: "",
    },
  });

  const selectedGroupId = watch("groupId");

  // Groups filtered to match the selected headUnder
  const filteredGroups = headUnder
    ? groups.filter((g) => g.headUnder === headUnder)
    : groups;

  // CC code is saved with the deepest selected sub group
  const applySubGroupPath = (ids) => {
    setSubGroupPath(ids);
    setValue("subGroupId", ids.length ? String(ids[ids.length - 1]) : "");
  };

  // Head Under changed -> reset group and sub groups
  const onHeadUnderChange = (val) => {
    setHeadUnder(val);
    setValue("groupId", "");
    applySubGroupPath([]);
    setIsNonLedger(val === "Balance Sheet" ? false : null);
  };

  // Group changed -> clear sub groups only
  const groupField = register("groupId");
  const onGroupChange = (e) => {
    groupField.onChange(e);
    applySubGroupPath([]);
  };
  const isViewMode = disabled;
  const fieldDisabled = isViewMode || !isEditing || isSubmitting;

  // FETCH GROUP + CATEGORY
  useEffect(() => {
    const loadMaster = async () => {
      const g = await apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_GROUP });
      const loadedGroups = g.data || [];
      const ccOptions = CATEGORY_OPTIONS.ccCategory;
      setGroups(loadedGroups);
      setCategories(ccOptions || []);
      if (data && (mode === "edit" || mode === "view")) {
        reset(data);
        // legacy records may not have headUnder stored yet — derive from group
        if (!data.headUnder && data.groupId) {
          const grp = loadedGroups.find((g) => String(g.groupId) === String(data.groupId));
          if (grp?.headUnder) setHeadUnder(grp.headUnder);
        }
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
        subGroupId: values.subGroupId ? Number(values.subGroupId) : null,
        isNonLedger: isNonLedger,
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
          subGroupId: d.ccSubGroupId ? String(d.ccSubGroupId) : "",
        });
        setSubGroupPath((d.ccSubGroupLevels || []).map((l) => l.subGroupId));
        setHeadUnder(d.headUnder ?? null);
        setIsNonLedger(d.isNonLedger !== undefined ? d.isNonLedger : null);

        setIsEditing(false);
      }
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  };
  const handleCancel = () => {
    if (!data) return;

    reset({
      ccCode: data.ccCode,
      ccName: data.ccName,
      groupId: String(data.ccGroupId || data.groupId),
      categoryId: String(data.ccCategoryId || data.categoryId),
      subGroupId: data.subGroupId || "",
    });
    setSubGroupPath(data.subGroupPath || []);
    setHeadUnder(data.headUnder ?? null);
    setIsNonLedger(data.isNonLedger !== undefined ? data.isNonLedger : null);

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

      {/* HEAD UNDER — user selects first */}
      <div className="flex gap-2">
        <div className="w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md shrink-0">
          Head Under
        </div>
        <div className="flex items-center gap-4 h-[30px] px-1">
          {["Profit & Loss", "Balance Sheet"].map((opt) => (
            <label key={opt} className={`flex items-center gap-1.5 select-none ${fieldDisabled ? "cursor-default" : "cursor-pointer"}`}>
              <input
                type="radio"
                name="headUnder"
                value={opt}
                checked={headUnder === opt}
                disabled={fieldDisabled}
                onChange={() => !fieldDisabled && onHeadUnderChange(opt)}
                className="accent-[#1c3a5e] w-3.5 h-3.5"
              />
              <span className={`text-sm ${headUnder === opt ? "font-semibold text-[#1c3a5e]" : "text-gray-600"}`}>
                {opt}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* LEDGER TYPE — only for Balance Sheet */}
      {headUnder === "Balance Sheet" && (
        <div className="flex gap-2">
          <div className="w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md shrink-0">
            Ledger Type
          </div>
          <div className="flex items-center gap-4 h-[30px] px-1">
            {[
              { label: "Ledger Group", value: false },
              { label: "Auto Ledger", value: true },
            ].map(({ label, value }) => (
              <label key={label} className={`flex items-center gap-1.5 select-none ${fieldDisabled ? "cursor-default" : "cursor-pointer"}`}>
                <input
                  type="radio"
                  name="ledgerType"
                  checked={isNonLedger === value}
                  disabled={fieldDisabled}
                  onChange={() => !fieldDisabled && setIsNonLedger(value)}
                  className="accent-[#1c3a5e] w-3.5 h-3.5"
                />
                <span className={`text-sm ${isNonLedger === value ? "font-semibold text-[#1c3a5e]" : "text-gray-600"}`}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

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

      {/* CATEGORY */}
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

      {/* GROUP — filtered by selected headUnder */}
      <div className="flex gap-2">
        <div className="w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md">
          Group
        </div>
        <select
          {...groupField}
          onChange={onGroupChange}
          disabled={fieldDisabled || !headUnder}
          className={`flex-1 ${getInputClass(errors.groupId, fieldDisabled)} disabled:cursor-not-allowed rounded-md`}
        >
          <option value="">{headUnder ? "Select" : "Select Head Under first"}</option>
          {filteredGroups.map((g) => (
            <option key={g.groupId} value={g.groupId}>
              {g.groupName}
            </option>
          ))}
        </select>
      </div>

      {/* SUB GROUP -> SUB GROUP 1 -> SUB GROUP 2 (each list depends on the one above) */}
      <SubGroupCascade
        groupId={selectedGroupId}
        path={subGroupPath}
        onChange={applySubGroupPath}
        disabled={fieldDisabled}
        labelClassName="w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md"
      />

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
