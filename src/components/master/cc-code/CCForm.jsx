"use client";

import { useEffect, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
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
  const router = useRouter();
  // delete confirmation (same pop-up as other master pages)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "create");
  // Ledger type (Balance Sheet): false = Ledger Group, true = Auto Ledger
  const [isNonLedger, setIsNonLedger] = useState(
    data?.isNonLedger !== undefined && data?.isNonLedger !== null ? data.isNonLedger : false
  );
  // Profit & Loss link (every CC code is Balance Sheet; some also fall under P&L)
  const [plLinked, setPlLinked] = useState(!!data?.plLinked);
  const [plGroupId, setPlGroupId] = useState(data?.plGroupId ? String(data.plGroupId) : "");
  const [plSubGroupPath, setPlSubGroupPath] = useState(data?.plSubGroupPath || []);

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

  // Main group: Balance Sheet groups (plus an older record's current group, if it is not one)
  const BS = "Balance Sheet";
  const PL = "Profit & Loss";
  const balanceSheetGroups = groups.filter(
    (g) => g.headUnder !== PL || String(g.groupId) === String(selectedGroupId)
  );
  const profitLossGroups = groups.filter((g) => g.headUnder === PL);
  const selectedGroup = groups.find((g) => String(g.groupId) === String(selectedGroupId));
  const showLedgerType = !selectedGroup || selectedGroup.headUnder === BS;

  // CC code is saved with the deepest selected sub group
  const applySubGroupPath = (ids) => {
    setSubGroupPath(ids);
    setValue("subGroupId", ids.length ? String(ids[ids.length - 1]) : "");
  };

  // P&L link on/off and P&L group change clear the P&L sub groups
  const onPlToggle = (on) => {
    setPlLinked(on);
    if (!on) {
      setPlGroupId("");
      setPlSubGroupPath([]);
    }
  };
  const onPlGroupChange = (value) => {
    setPlGroupId(value);
    setPlSubGroupPath([]);
  };

  const plGroupName = profitLossGroups.find((g) => String(g.groupId) === String(plGroupId))?.groupName;

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

    if (plLinked && !plGroupId) {
      toast.warning("Select the Profit & Loss group, or switch the Profit & Loss link off");
      return;
    }

    try {
      toastId = toast.loading("Saving...");

      const payload = {
        ccCode: values.ccCode,
        ccName: values.ccName,
        groupId: Number(values.groupId),
        categoryId: values.categoryId,
        subGroupId: values.subGroupId ? Number(values.subGroupId) : null,
        isNonLedger: showLedgerType ? !!isNonLedger : null,
        plLinked,
        plGroupId: plLinked && plGroupId ? Number(plGroupId) : null,
        plSubGroupId: plLinked && plSubGroupPath.length ? plSubGroupPath[plSubGroupPath.length - 1] : null,
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
        setIsNonLedger(d.isNonLedger ?? false);
        setPlLinked(!!d.plLinked);
        setPlGroupId(d.plGroupId ? String(d.plGroupId) : "");
        setPlSubGroupPath((d.plSubGroupLevels || []).map((l) => l.subGroupId));

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
    setIsNonLedger(data.isNonLedger ?? false);
    setPlLinked(!!data.plLinked);
    setPlGroupId(data.plGroupId ? String(data.plGroupId) : "");
    setPlSubGroupPath(data.plSubGroupPath || []);

    setIsEditing(false);
  };

  // deletes only this CC code record (no cascade)
  const handleDeleteConfirm = async () => {
    try {
      setDeleteLoading(true);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.MASTER.DELETE_CC_CODE_BY_ID}/${ccId}`,
        method: "DELETE",
      });
      toast.success(res?.message || "CC Code deleted");
      setConfirmDelete(false);
      router.push("/master/cc-code");
    } catch (err) {
      toast.error(err.message || "Failed to delete CC Code");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-75">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  const inputClass = "border h-[30px] px-2 text-sm";

  const label = "w-[220px] bg-[#d6e6f2] px-3 py-1 border rounded-md shrink-0";

  return (
    <div className="p-4 max-w-2xl">
      <div className="space-y-0.5">

        {/* LEDGER TYPE */}
        {showLedgerType && (
          <div className="flex gap-2">
            <div className={label}>Ledger Type</div>
            <div className="flex items-center gap-4 h-[30px] px-1 flex-wrap">
              {[
                { label: "Ledger Group", value: false },
                { label: "Auto Ledger", value: true },
              ].map(({ label: text, value }) => (
                <label key={text} className={`flex items-center gap-1.5 select-none ${fieldDisabled ? "cursor-default" : "cursor-pointer"}`}>
                  <input
                    type="radio"
                    name="ledgerType"
                    checked={isNonLedger === value}
                    disabled={fieldDisabled}
                    onChange={() => !fieldDisabled && setIsNonLedger(value)}
                    className="accent-[#1c3a5e] w-3.5 h-3.5"
                  />
                  <span className={`text-sm ${isNonLedger === value ? "font-semibold text-[#1c3a5e]" : "text-gray-600"}`}>
                    {text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* CC CODE */}
        <div className="flex gap-2">
          <div className={label}>CC Code</div>
          <Input
            {...register("ccCode")}
            disabled={fieldDisabled}
            className={`${getInputClass(errors.ccCode, fieldDisabled)} w-[200px]`}
          />
        </div>

        {/* CC NAME */}
        <div className="flex gap-2">
          <div className={label}>CC Name</div>
          <Input
            {...register("ccName")}
            disabled={fieldDisabled}
            className={`flex-1 ${getInputClass(errors.ccName, fieldDisabled)}`}
          />
        </div>

        {/* CATEGORY */}
        <div className="flex gap-2">
          <div className={label}>Category</div>
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

        {/* ── BALANCE SHEET GROUP SECTION ── */}
        <div className="pt-2">
          <div className="text-[13px] font-semibold text-[#1c3a5e] uppercase tracking-wide pb-1 border-b border-[#1c3a5e] mb-3">
            Balance Sheet Group
          </div>
          <div className="space-y-0.5">
            {/* GROUP */}
            <div className="flex gap-2">
              <div className={label}>Group</div>
              <select
                {...groupField}
                onChange={onGroupChange}
                disabled={fieldDisabled}
                className={`flex-1 ${getInputClass(errors.groupId, fieldDisabled)} disabled:cursor-not-allowed rounded-md`}
              >
                <option value="">Select group</option>
                {balanceSheetGroups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.groupName}
                    {g.headUnder === PL ? " (Profit & Loss – older record)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* SUB GROUP CASCADE */}
            <SubGroupCascade
              groupId={selectedGroupId}
              path={subGroupPath}
              onChange={applySubGroupPath}
              disabled={fieldDisabled}
              labelClassName={label}
            />
          </div>
        </div>

        {/* ── PROFIT & LOSS GROUP SECTION ── */}
        <div className="pt-2">
          {/* Toggle row */}
          <div className="flex items-center justify-between gap-3 rounded-md bg-[#f3f7ff] border border-[#b5c7d8] px-3 py-2 mb-3">
            <span className="text-[13px] font-semibold text-[#1c3a5e] uppercase tracking-wide">
              Also in Profit &amp; Loss
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={plLinked}
              aria-label="Also in Profit and Loss"
              disabled={fieldDisabled}
              onClick={() => onPlToggle(!plLinked)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                plLinked ? "bg-[#1c7c3a]" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${plLinked ? "translate-x-5" : "translate-x-0.5"}`} />
              <span className="sr-only">{plLinked ? "Yes" : "No"}</span>
            </button>
          </div>

          {plLinked && (
            <div className="space-y-0.5">
              <div className="text-[13px] font-semibold text-[#1c3a5e] uppercase tracking-wide pb-1 border-b border-[#1c3a5e] mb-3">
                Profit &amp; Loss Group
              </div>

              {/* P&L GROUP */}
              <div className="flex gap-2">
                <div className={label}>Group</div>
                <select
                  value={plGroupId}
                  onChange={(e) => onPlGroupChange(e.target.value)}
                  disabled={fieldDisabled}
                  className={`flex-1 ${getInputClass(plLinked && !plGroupId ? { message: "Required" } : null, fieldDisabled)} disabled:cursor-not-allowed rounded-md`}
                >
                  <option value="">{profitLossGroups.length ? "Select group" : "No Profit & Loss group found"}</option>
                  {profitLossGroups.map((g) => (
                    <option key={g.groupId} value={g.groupId}>
                      {g.groupName}
                    </option>
                  ))}
                </select>
              </div>

              {/* P&L SUB GROUP CASCADE */}
              <SubGroupCascade
                groupId={plGroupId}
                path={plSubGroupPath}
                onChange={setPlSubGroupPath}
                disabled={fieldDisabled}
                labelClassName={label}
              />

              {plGroupName && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
                  Shows in Profit &amp; Loss under <b>{plGroupName}</b>
                  {plSubGroupPath.length > 0 ? " and the selected sub group." : "."}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* BUTTONS */}
      <div className="flex justify-end gap-3 mt-10">
        {mode === "edit" && !isViewMode && ccId && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isSubmitting || isEditing}
            title={isEditing ? "Finish or cancel editing first" : "Delete this CC Code"}
            className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-4 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}

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

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={(v) => { if (!v && !deleteLoading) setConfirmDelete(false); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">Delete CC Code</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-black">
                &quot;{getValues("ccCode")} – {getValues("ccName")}&quot;
              </span>
              ? Only this CC code is deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="text-[12px] h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteLoading}
              onClick={(e) => { e.preventDefault(); handleDeleteConfirm(); }}
              className="bg-red-600 hover:bg-red-700 text-[12px] h-8"
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
