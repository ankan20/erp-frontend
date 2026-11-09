"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, ChevronUp, ChevronDown, GripVertical, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  TERMS_MODULES,
  TERMS_SUB_MODULES,
  TERMS_TYPES,
  POINT_STYLES,
} from "../../../config/terms.config";
import ExpandableTextArea from "@/components/common/ExpandableTextArea";
import { pointPrefix } from "@/helper/termsHelpers";

const TC = API_ENDPOINTS.MASTER.TERM;

const labelCls =
  "flex items-center h-[30px] px-3 bg-[#d6e6f2] border border-black rounded-sm text-[13px] font-medium min-w-[160px]";
const inputCls = (err) =>
  `h-[30px] rounded-sm border text-[13px] px-2 w-full bg-white outline-none ${
    err ? "border-red-500 bg-red-50" : "border-[#8f8f8f]"
  } disabled:bg-[#edf8ed] disabled:border-[#7fa37f] disabled:text-gray-500 disabled:cursor-default`;

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const newPoint = () => ({ pointId: uid(), text: "" });
const newGroup = () => ({
  groupId: uid(),
  title: "",
  description: "",
  pointStyle: "bullet",
  points: [],
});


export default function TermsForm({ mode = "create", disabled = false, termId, initialData }) {
  const router = useRouter();
  const [isEditing,       setIsEditing]       = useState(mode === "create");
  const [isSaving,        setIsSaving]        = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [movedGroupId,       setMovedGroupId]       = useState(null);
  const [movedPointId,       setMovedPointId]       = useState(null);
  const [confirmRemoveGroup, setConfirmRemoveGroup] = useState(null);
  const groupRefs = useRef({});

  const toggleCollapse = (groupId) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });

  // ── top-level fields
  const [module,    setModule]    = useState("");
  const [subModule, setSubModule] = useState("");
  const [termType,  setTermType]  = useState("");

  // ── term groups (array of { groupId, title, description, pointStyle, points[] })
  const [groups, setGroups] = useState([]);

  // ── validation errors
  const [errors, setErrors] = useState({});

  const fieldDisabled = disabled || !isEditing || isSaving;

  // ── populate from initialData (edit/view)
  useEffect(() => {
    if (initialData /* edit, view or copy */) {
      setModule(initialData.module    || "");
      setSubModule(initialData.subModule || "");
      setTermType(initialData.termType  || "");
      setGroups(
        (initialData.termGroups || []).map((g) => ({
          ...g,
          groupId: g.groupId || uid(),
          points: (g.points || []).map((p) => ({
            ...p,
            pointId: p.pointId || uid(),
          })),
        }))
      );
    }
  }, [initialData, mode]);

  // ── reset module clears subModule
  const handleModuleChange = (val) => {
    setModule(val);
    setSubModule("");
  };

  // ── group helpers
  const addGroup = () => {
    const group = newGroup();
    setGroups((g) => [...g, group]);
    setTimeout(() => {
      groupRefs.current[group.groupId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const removeGroup = (groupId) =>
    setGroups((g) => g.filter((x) => x.groupId !== groupId));

  const moveGroup = (idx, dir) => {
    setGroups((g) => {
      const next = [...g];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return g;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      const movedId = next[swap].groupId;
      setTimeout(() => {
        setMovedGroupId(movedId);
        groupRefs.current[movedId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setTimeout(() => setMovedGroupId(null), 600);
      }, 0);
      return next;
    });
  };

  const updateGroup = (groupId, field, value) =>
    setGroups((g) =>
      g.map((x) => (x.groupId === groupId ? { ...x, [field]: value } : x))
    );

  // ── point helpers
  const addPoint = (groupId) =>
    setGroups((g) =>
      g.map((x) =>
        x.groupId === groupId ? { ...x, points: [...x.points, newPoint()] } : x
      )
    );

  const removePoint = (groupId, pointId) =>
    setGroups((g) =>
      g.map((x) =>
        x.groupId === groupId
          ? { ...x, points: x.points.filter((p) => p.pointId !== pointId) }
          : x
      )
    );

  const movePoint = (groupId, idx, dir) =>
    setGroups((g) =>
      g.map((x) => {
        if (x.groupId !== groupId) return x;
        const pts = [...x.points];
        const swap = idx + dir;
        if (swap < 0 || swap >= pts.length) return x;
        [pts[idx], pts[swap]] = [pts[swap], pts[idx]];
        const movedId = pts[swap].pointId;
        setTimeout(() => {
          setMovedPointId(movedId);
          setTimeout(() => setMovedPointId(null), 600);
        }, 0);
        return { ...x, points: pts };
      })
    );

  const updatePoint = (groupId, pointId, value) =>
    setGroups((g) =>
      g.map((x) =>
        x.groupId === groupId
          ? {
              ...x,
              points: x.points.map((p) =>
                p.pointId === pointId ? { ...p, text: value } : p
              ),
            }
          : x
      )
    );

  // ── validation
  const validate = () => {
    const errs = {};
    if (!module)    errs.module    = true;
    if (!subModule) errs.subModule = true;
    if (!termType)  errs.termType  = true;
    if (groups.length === 0) errs.groups = "At least one term group is required";
    groups.forEach((g, gi) => {
      if (!g.title.trim())       errs[`group_${gi}_title`]       = true;
      if (!g.description.trim()) errs[`group_${gi}_description`] = true;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── build payload for API
  const buildPayload = () => ({
    module,
    subModule,
    termType,
    termGroups: groups.map((g, gi) => ({
      sortOrder:   gi,
      title:       g.title.trim(),
      description: g.description.trim(),
      pointStyle:  g.pointStyle,
      points:      g.points.map((p, pi) => ({
        sortOrder: pi,
        text:      p.text.trim(),
      })),
    })),
  });

  const onSubmit = async () => {
    if (!validate()) {
      toast.error("Please fill all required fields");
      return;
    }
    setIsSaving(true);
    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating..." : "Updating...");
      const payload = buildPayload();

      if (mode === "create") {
        const res = await apiRequest({ url: TC.CREATE, method: "POST", data: payload });
        const newId = res.data?.[0]?.termId || res.data?.termId;
        toast.success("Term created", { id: toastId });
        setTimeout(() => router.push(`/master/terms-condition/${newId}`), 400);
      } else {
        await apiRequest({ url: `${TC.UPDATE}/${termId}`, method: "PUT", data: payload });
        toast.success("Term updated", { id: toastId });
        setIsEditing(false);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (initialData) {
      setModule(initialData.module    || "");
      setSubModule(initialData.subModule || "");
      setTermType(initialData.termType  || "");
      setGroups(
        (initialData.termGroups || []).map((g) => ({
          ...g,
          groupId: g.groupId || uid(),
          points: (g.points || []).map((p) => ({
            ...p,
            pointId: p.pointId || uid(),
          })),
        }))
      );
    }
    setErrors({});
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsSaving(true);
    let toastId;
    try {
      toastId = toast.loading("Deleting...");
      await apiRequest({ url: `${TC.DELETE}/${termId}`, method: "DELETE" });
      toast.success("Term deleted", { id: toastId });
      setTimeout(() => router.push("/master/terms-condition"), 400);
    } catch (err) {
      toast.error(err.message || "Delete failed", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const subModuleOptions = TERMS_SUB_MODULES[module] || [];

  return (
    <div className="p-4 max-w-4xl mx-auto flex flex-col gap-6">

      {/* ── TOP SECTION: Module / Sub-Module / Type ── */}
      <div className="border border-gray-300 rounded-md overflow-hidden">
        <div className="bg-[#d6e6f2] px-4 py-2 text-[13px] font-semibold border-b border-gray-300">
          Classification
        </div>
        <div className="flex flex-col">
          {/* Module */}
          <div className="flex flex-wrap gap-2 items-center px-4 py-2 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700 min-w-[130px]">
              Module <span className="text-red-500">*</span> :
            </span>
            <div className="flex-1 min-w-[180px] max-w-[320px]">
              <Select value={module} onValueChange={handleModuleChange} disabled={fieldDisabled}>
                <SelectTrigger className={`h-[30px] text-[13px] w-full ${errors.module ? "border-red-500 bg-red-50" : ""}`}>
                  <SelectValue placeholder="Select Module" />
                </SelectTrigger>
                <SelectContent>
                  {TERMS_MODULES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sub Module */}
          <div className="flex flex-wrap gap-2 items-center px-4 py-2 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-700 min-w-[130px]">
              Sub Module <span className="text-red-500">*</span> :
            </span>
            <div className="flex-1 min-w-[180px] max-w-[320px]">
              <Select value={subModule} onValueChange={setSubModule} disabled={fieldDisabled || !module}>
                <SelectTrigger className={`h-[30px] text-[13px] w-full ${errors.subModule ? "border-red-500 bg-red-50" : ""}`}>
                  <SelectValue placeholder={module ? "Select Sub Module" : "Select Module first"} />
                </SelectTrigger>
                <SelectContent>
                  {subModuleOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type */}
          <div className="flex flex-wrap gap-2 items-center px-4 py-2">
            <span className="text-[13px] font-semibold text-gray-700 min-w-[130px]">
              Type <span className="text-red-500">*</span> :
            </span>
            <div className="flex-1 min-w-[180px] max-w-[320px]">
              <Select value={termType} onValueChange={setTermType} disabled={fieldDisabled}>
                <SelectTrigger className={`h-[30px] text-[13px] w-full ${errors.termType ? "border-red-500 bg-red-50" : ""}`}>
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {TERMS_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ── TERM GROUPS ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center">
          <span className="text-[13px] font-semibold text-gray-700">
            Term Groups
            {errors.groups && (
              <span className="ml-2 text-red-500 text-[12px] font-normal">{errors.groups}</span>
            )}
          </span>
        </div>

        {groups.length === 0 && (
          <div className="text-[13px] text-gray-400 text-center py-6 border border-dashed border-gray-300 rounded-md">
            No term groups yet.{!fieldDisabled && " Click \"+ Add Term Group\" below to start."}
          </div>
        )}

        {groups.map((group, gi) => (
          <div
            key={group.groupId}
            ref={(el) => { groupRefs.current[group.groupId] = el; }}
            style={{ transition: "box-shadow 0.4s ease, border-color 0.4s ease" }}
            className={`border rounded-md overflow-hidden ${
              movedGroupId === group.groupId
                ? "border-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.3)]"
                : "border-gray-300"
            }`}
          >
            {/* Group header bar */}
            <div
              className="flex items-center gap-2 bg-[#f0f7ff] px-3 py-1.5 border-b border-gray-200 cursor-pointer select-none"
              onClick={() => toggleCollapse(group.groupId)}
            >
              <GripVertical size={14} className="text-gray-400 shrink-0" onClick={(e) => e.stopPropagation()} />
              <span className="text-[13px] font-semibold text-gray-700 flex-1">
                {gi + 1}. {group.title || "Untitled Group"}
              </span>
              <ChevronDown
                size={15}
                className={`text-gray-400 transition-transform duration-200 ${collapsedGroups.has(group.groupId) ? "" : "rotate-180"}`}
              />
              {!fieldDisabled && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => moveGroup(gi, -1)}
                    disabled={gi === 0}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 transition"
                    title="Move up"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGroup(gi, 1)}
                    disabled={gi === groups.length - 1}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 transition"
                    title="Move down"
                  >
                    <ChevronDown size={15} />
                  </button>
                  {confirmRemoveGroup === group.groupId ? (
                    <div className="flex items-center gap-1 bg-red-50 border border-red-300 rounded-sm px-2 py-0.5">
                      <span className="text-[11px] text-red-600 font-medium">Remove?</span>
                      <button
                        type="button"
                        onClick={() => { removeGroup(group.groupId); setConfirmRemoveGroup(null); }}
                        className="text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 px-1.5 py-0.5 rounded-sm transition"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveGroup(null)}
                        className="text-[11px] font-medium text-gray-600 hover:text-gray-900 px-1 transition"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveGroup(group.groupId)}
                      className="p-0.5 rounded hover:bg-red-100 text-red-500 transition"
                      title="Remove group"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {!collapsedGroups.has(group.groupId) && <div className="p-4 flex flex-col gap-0">
              {/* Title */}
              <div className="flex flex-wrap gap-2 items-center py-2 border-b border-gray-200">
                <span className="text-[12px] text-gray-700 font-semibold min-w-[130px]">
                  Title of Terms <span className="text-red-500">*</span> :
                </span>
                <input
                  type="text"
                  value={group.title}
                  onChange={(e) => updateGroup(group.groupId, "title", e.target.value)}
                  disabled={fieldDisabled}
                  placeholder="e.g. Contract Documents"
                  className={`${inputCls(errors[`group_${gi}_title`])} flex-1 min-w-[180px]`}
                />
              </div>

              {/* Description */}
              <div className="flex flex-wrap gap-2 items-start py-2 border-b border-gray-200">
                <span className="text-[12px] text-gray-700 font-semibold min-w-[130px] mt-1">
                  Terms Description <span className="text-red-500">*</span> :
                </span>
                <ExpandableTextArea
                  value={group.description}
                  onChange={(v) => updateGroup(group.groupId, "description", v)}
                  disabled={fieldDisabled}
                  hasError={!!errors[`group_${gi}_description`]}
                  placeholder="Brief description of this term group…"
                  title="Terms Description"
                  rows={2}
                  maxInlineRows={3}
                  modalRows={10}
                  className="flex-1 min-w-[180px]"
                />
              </div>

              {/* Point style selector */}
              <div className="flex flex-wrap gap-2 items-center py-2 border-b border-gray-200">
                <span className="text-[12px] text-gray-700 font-semibold min-w-[130px]">Sub-point Style :</span>
                <div className="flex-1 min-w-[180px]">
                  <Select
                    value={group.pointStyle}
                    onValueChange={(v) => updateGroup(group.groupId, "pointStyle", v)}
                    disabled={fieldDisabled}
                  >
                    <SelectTrigger className="h-[30px] text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POINT_STYLES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Points */}
              {(group.points.length > 0 || !fieldDisabled) && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {group.points.map((pt, pi) => (
                    <div
                      key={pt.pointId}
                      style={{ transition: "box-shadow 0.4s ease, border-radius 0.4s ease" }}
                      className={`flex items-center gap-2 rounded-sm ${movedPointId === pt.pointId ? "shadow-[0_0_0_2px_rgba(56,189,248,0.4)]" : ""}`}
                    >
                      <span className={`shrink-0 w-7 text-right font-mono text-gray-500 ${group.pointStyle === "bullet" ? "text-[24px] leading-[30px]" : "text-[13px]"}`}>
                        {pointPrefix(group.pointStyle, pi)}
                      </span>
                      <ExpandableTextArea
                        value={pt.text}
                        onChange={(v) => updatePoint(group.groupId, pt.pointId, v)}
                        disabled={fieldDisabled}
                        placeholder={`Point ${pi + 1}`}
                        title={`Point ${pi + 1}`}
                        rows={1}
                        maxInlineRows={2}
                        modalRows={6}
                        className="flex-1"
                      />
                      {!fieldDisabled && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => movePoint(group.groupId, pi, -1)}
                            disabled={pi === 0}
                            className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 transition"
                            title="Move up"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePoint(group.groupId, pi, 1)}
                            disabled={pi === group.points.length - 1}
                            className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 transition"
                            title="Move down"
                          >
                            <ChevronDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePoint(group.groupId, pt.pointId)}
                            className="p-0.5 rounded hover:bg-red-100 text-red-400 transition"
                            title="Remove point"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {!fieldDisabled && (
                    <button
                      type="button"
                      onClick={() => addPoint(group.groupId)}
                      className="flex items-center gap-1 self-start mt-1 px-2 h-[24px] text-[11px] text-sky-600 border border-sky-300 rounded-sm hover:bg-sky-50 transition"
                    >
                      <Plus size={11} /> Add Point
                    </button>
                  )}
                </div>
              )}
            </div>}
          </div>
        ))}

        {!fieldDisabled && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addGroup}
              className="flex items-center gap-1 px-3 h-[28px] text-[12px] font-medium bg-sky-100 border border-sky-400 text-sky-700 rounded-sm hover:bg-sky-200 transition"
            >
              <Plus size={13} /> Add Term Group
            </button>
          </div>
        )}
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="flex justify-end gap-3 mt-2">
        {/* Delete (edit mode only) */}
        {mode === "edit" && !disabled && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isSaving}
                className="h-8 px-4 rounded-md border border-red-400 bg-red-100 text-black text-sm font-medium hover:bg-red-200 transition disabled:opacity-60"
              >
                Delete
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Term?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this term and all its groups. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Edit / Cancel */}
        {mode === "edit" && !disabled && (
          <EditButton
            onClick={isEditing ? handleCancel : () => setIsEditing(true)}
            disabled={isSaving}
          >
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        )}

        {/* Save */}
        {!disabled && (
          <SaveButton
            onClick={onSubmit}
            loading={isSaving}
            disabled={!isEditing || isSaving}
            requireConfirmation
            confirmationTitle="Save Term?"
            confirmationMessage={
              mode === "create"
                ? "This will create a new term and redirect to the edit page."
                : "This will update the term with the current changes."
            }
          />
        )}
      </div>
    </div>
  );
}
