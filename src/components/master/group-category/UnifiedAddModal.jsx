"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/apiClient";
import { toast } from "sonner";
import SaveButton from "@/components/common/SaveButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import { API_ENDPOINTS } from "@/config/api.config";

const TYPES = ["Group", "Sub Group", "Sub Group 1", "Sub Group 2"];
const HEAD_OPTIONS = ["Profit & Loss", "Balance Sheet"];

const EMPTY = {
  name: "",
  type: "",
  headUnder: "",
  groupId: "",
  subGroupId: "",   // level-0 parent (for Sub Group 1 + Sub Group 2)
  subGroup1Id: "",  // level-1 parent (for Sub Group 2 only)
};

function Field({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 sm:items-center">
      <div className="px-3 py-1 bg-[#d6e6f2] border w-full sm:w-[140px] shrink-0 text-sm">
        {label}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function UnifiedAddModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);   // level 0
  const [subGroups1, setSubGroups1] = useState([]); // level 1, filtered by selected subGroupId
  const [autoCode, setAutoCode] = useState("");
  const suggestId = useRef(0);

  // Reset + load groups on open
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setSubGroups([]);
    setSubGroups1([]);
    setAutoCode("");
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_GROUP })
      .then((r) => setGroups(r?.data || []))
      .catch(() => toast.error("Failed to load groups"));
  }, [open]);

  // Load all level-0 Sub Groups when type needs them
  useEffect(() => {
    if (!open || (form.type !== "Sub Group 1" && form.type !== "Sub Group 2")) {
      setSubGroups([]);
      return;
    }
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_SUB_GROUP, params: { level: 0 } })
      .then((r) => setSubGroups(r?.data || []))
      .catch(() => setSubGroups([]));
  }, [open, form.type]);

  // Load level-1 Sub Groups when a level-0 Sub Group is selected (for Sub Group 2)
  useEffect(() => {
    if (!open || form.type !== "Sub Group 2" || !form.subGroupId) {
      setSubGroups1([]);
      return;
    }
    apiRequest({
      url: API_ENDPOINTS.MASTER.GET_ALL_SUB_GROUP,
      params: { parentId: form.subGroupId },
    })
      .then((r) => setSubGroups1(r?.data || []))
      .catch(() => setSubGroups1([]));
  }, [open, form.type, form.subGroupId]);

  // Auto code preview (debounced)
  useEffect(() => {
    if (!open || form.type === "Group" || !form.name.trim()) {
      setAutoCode("");
      return;
    }
    const parentId =
      form.type === "Sub Group 1" ? form.subGroupId :
      form.type === "Sub Group 2" ? form.subGroup1Id : undefined;
    const myId = ++suggestId.current;
    const t = setTimeout(async () => {
      try {
        const r = await apiRequest({
          url: API_ENDPOINTS.MASTER.SUGGEST_SUB_GROUP_CODE,
          params: { name: form.name.trim(), ...(parentId && { parentId }) },
        });
        if (myId === suggestId.current) setAutoCode(r?.data?.[0]?.code || "");
      } catch {
        if (myId === suggestId.current) setAutoCode("");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [open, form.name, form.type, form.subGroupId, form.subGroup1Id]);

  const set = (key) => (value) =>
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "type") {
        // reset all conditional fields when type changes
        next.headUnder = "";
        next.groupId = "";
        next.subGroupId = "";
        next.subGroup1Id = "";
      }
      if (key === "subGroupId") next.subGroup1Id = "";
      return next;
    });

  // Auto-filled group name for display
  const autoGroupName = (() => {
    if (form.type === "Sub Group 1" && form.subGroupId)
      return subGroups.find((s) => String(s.subGroupId) === String(form.subGroupId))?.groupName;
    if (form.type === "Sub Group 2" && form.subGroup1Id)
      return subGroups1.find((s) => String(s.subGroupId) === String(form.subGroup1Id))?.groupName;
    if (form.type === "Sub Group 2" && form.subGroupId)
      return subGroups.find((s) => String(s.subGroupId) === String(form.subGroupId))?.groupName;
    return null;
  })();

  const isValid = (() => {
    if (!form.name.trim() || !form.type) return false;
    if (form.type === "Group")       return !!form.headUnder;
    if (form.type === "Sub Group")   return !!form.groupId;
    if (form.type === "Sub Group 1") return !!form.subGroupId;
    if (form.type === "Sub Group 2") return !!form.subGroup1Id;
    return false;
  })();

  const handleSave = async () => {
    if (!isValid) return;
    let toastId;
    try {
      setSaving(true);
      toastId = toast.loading("Saving...");

      if (form.type === "Group") {
        await apiRequest({
          url: API_ENDPOINTS.MASTER.CREATE_GROUP,
          method: "POST",
          data: { groupName: form.name.trim(), headUnder: form.headUnder },
        });
      } else {
        const parentId =
          form.type === "Sub Group 1" ? Number(form.subGroupId) :
          form.type === "Sub Group 2" ? Number(form.subGroup1Id) : null;
        await apiRequest({
          url: API_ENDPOINTS.MASTER.CREATE_SUB_GROUP,
          method: "POST",
          data: {
            subGroupName: form.name.trim(),
            ...(parentId ? { parentId } : { groupId: Number(form.groupId) }),
          },
        });
      }

      toast.success("Saved successfully", { id: toastId });
      onSuccess?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message || "Failed to save", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving && !v) onClose?.(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Add {form.type || "Group / Sub Group"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">

          {/* NAME */}
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              disabled={saving}
              placeholder="Enter name"
              className={!form.name.trim() ? "border-red-400" : ""}
              autoFocus
            />
          </Field>

          {/* TYPE */}
          <Field label="Type">
            <select
              value={form.type}
              onChange={(e) => set("type")(e.target.value)}
              disabled={saving}
              className={`border w-full p-2 text-sm ${!form.type ? "border-red-400" : ""}`}
            >
              <option value="">Select type</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          {/* GROUP type → Head Under */}
          {form.type === "Group" && (
            <Field label="Head Under">
              <select
                value={form.headUnder}
                onChange={(e) => set("headUnder")(e.target.value)}
                disabled={saving}
                className={`border w-full p-2 text-sm ${!form.headUnder ? "border-red-400" : ""}`}
              >
                <option value="">Select</option>
                {HEAD_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </Field>
          )}

          {/* SUB GROUP type → Group select */}
          {form.type === "Sub Group" && (
            <Field label="Group">
              <SearchableSelect
                options={groups}
                value={form.groupId}
                onChange={(v) => set("groupId")(v ? String(v) : "")}
                disabled={saving}
                placeholder="Select Group"
                labelKey="groupName"
                valueKey="groupId"
                searchKeys={["groupName", "headUnder"]}
                className={!form.groupId ? "[&>button]:border-red-400" : ""}
              />
            </Field>
          )}

          {/* SUB GROUP 1 / SUB GROUP 2 → Sub Group select */}
          {(form.type === "Sub Group 1" || form.type === "Sub Group 2") && (
            <Field label="Sub Group">
              <SearchableSelect
                options={subGroups}
                value={form.subGroupId}
                onChange={(v) => set("subGroupId")(v ? String(v) : "")}
                disabled={saving}
                placeholder="Select Sub Group"
                labelKey={["subGroupName", "groupName"]}
                labelSeparator=" — "
                valueKey="subGroupId"
                searchKeys={["subGroupName", "groupName"]}
                className={!form.subGroupId ? "[&>button]:border-red-400" : ""}
              />
            </Field>
          )}

          {/* SUB GROUP 2 → Sub Group 1 select (filtered by selected Sub Group) */}
          {form.type === "Sub Group 2" && (
            <Field label="Sub Group 1">
              <SearchableSelect
                options={subGroups1}
                value={form.subGroup1Id}
                onChange={(v) => set("subGroup1Id")(v ? String(v) : "")}
                disabled={saving || !form.subGroupId}
                placeholder={
                  !form.subGroupId
                    ? "Select Sub Group first"
                    : subGroups1.length === 0
                    ? "No Sub Group 1 found"
                    : "Select Sub Group 1"
                }
                labelKey="subGroupName"
                valueKey="subGroupId"
                searchKeys={["subGroupName"]}
                className={!form.subGroup1Id ? "[&>button]:border-red-400" : ""}
              />
            </Field>
          )}

          {/* Auto-filled Group display (Sub Group 1 / 2) */}
          {autoGroupName && (
            <Field label="Group">
              <div className="px-2 py-1.5 text-sm text-gray-700 bg-gray-50 border rounded">
                {autoGroupName}
              </div>
            </Field>
          )}

          {/* Auto code hint */}
          {autoCode && form.type !== "Group" && (
            <p className="text-xs text-gray-500 pl-1">
              Auto code: <span className="font-mono font-medium">{autoCode}</span>
            </p>
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-1 border rounded cursor-pointer text-sm"
            >
              Cancel
            </button>
            <SaveButton onClick={handleSave} disabled={!isValid || saving}>
              Save
            </SaveButton>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
