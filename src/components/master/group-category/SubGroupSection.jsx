"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/apiClient";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ChevronRight, ChevronDown } from "lucide-react";
import SaveButton from "@/components/common/SaveButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import { useColumnResize } from "@/hooks/useColumnResize";
import { API_ENDPOINTS } from "@/config/api.config";

const LEVEL_LABELS = ["Sub Group", "Sub Group 1", "Sub Group 2"];

const EMPTY_FORM = {
  groupId: "",
  parentId: "",
  subGroupName: "",
  subGroupCode: "",
  status: "Active",
};

// Typed code: trim, spaces -> "_", CAPITALS
const normalizeCode = (v) => (v || "").replace(/\s+/g, "_").toUpperCase();

function Label({ children }) {
  return <div className="px-3 py-1 bg-[#d6e6f2] border w-[150px] shrink-0">{children}</div>;
}

// Sub Group tree: Group -> Sub Group -> Sub Group 1 -> Sub Group 2.
// Category is chosen on the CC code, not here.
export default function SubGroupSection() {
  const [data, setData] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterGroupId, setFilterGroupId] = useState("");

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [parentOptions, setParentOptions] = useState([]);
  const [saving, setSaving] = useState(false);

  // collapsible tree: ids of open rows
  const [expanded, setExpanded] = useState(() => new Set());

  // delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // live code check: idle | checking | ok | taken | invalid
  const [codeState, setCodeState] = useState({ status: "idle", message: "" });
  const [autoCode, setAutoCode] = useState("");
  const checkId = useRef(0);
  const suggestId = useRef(0);

  const { tableRef } = useColumnResize();

  const fetchList = async (groupId = filterGroupId) => {
    try {
      setLoading(true);
      const res = await apiRequest({
        url: API_ENDPOINTS.MASTER.GET_ALL_SUB_GROUP,
        params: groupId ? { groupId } : undefined,
      });
      setData(res?.data || []);
    } catch (e) {
      toast.error(e.message || "Failed to load sub groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_GROUP })
      .then((g) => setGroups(g?.data || []))
      .catch(() => toast.error("Failed to load groups"));
    fetchList("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Under" options = sub groups of the chosen group that can still have children
  useEffect(() => {
    if (!open || !form.groupId) {
      setParentOptions([]);
      return;
    }
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_SUB_GROUP, params: { groupId: form.groupId } })
      .then((r) => {
        const blocked = new Set();
        // when editing, the item itself and its children cannot be its parent
        if (editingItem) {
          (r?.data || []).forEach((s) => {
            if (s.pathIds?.includes(editingItem.subGroupId)) blocked.add(s.subGroupId);
          });
        }
        setParentOptions((r?.data || []).filter((s) => s.canHaveChildren && !blocked.has(s.subGroupId)));
      })
      .catch(() => setParentOptions([]));
  }, [open, form.groupId, editingItem]);

  // Live check of a typed code (waits 400 ms after typing stops)
  useEffect(() => {
    if (!open) return;
    const code = normalizeCode(form.subGroupCode);
    if (!code) {
      setCodeState({ status: "idle", message: "" });
      return;
    }
    if (editingItem && code === editingItem.subGroupCode) {
      setCodeState({ status: "ok", message: "Current code" });
      return;
    }
    const myId = ++checkId.current;
    setCodeState({ status: "checking", message: "Checking..." });
    const t = setTimeout(async () => {
      try {
        const r = await apiRequest({
          url: API_ENDPOINTS.MASTER.CHECK_SUB_GROUP_CODE,
          params: { code, ...(editingItem && { excludeId: editingItem.subGroupId }) },
        });
        if (myId !== checkId.current) return;
        const d = r?.data?.[0] || {};
        if (!d.valid) setCodeState({ status: "invalid", message: r.message });
        else if (d.exists) setCodeState({ status: "taken", message: `${code} already exists` });
        else setCodeState({ status: "ok", message: `${code} is available` });
      } catch {
        if (myId === checkId.current) setCodeState({ status: "idle", message: "" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.subGroupCode, open, editingItem]);

  // Preview of the auto code when code is left empty (new sub group only)
  useEffect(() => {
    if (!open || editingItem || normalizeCode(form.subGroupCode) || !form.subGroupName.trim()) {
      setAutoCode("");
      return;
    }
    const myId = ++suggestId.current;
    const t = setTimeout(async () => {
      try {
        const r = await apiRequest({
          url: API_ENDPOINTS.MASTER.SUGGEST_SUB_GROUP_CODE,
          params: { name: form.subGroupName.trim(), ...(form.parentId && { parentId: form.parentId }) },
        });
        if (myId === suggestId.current) setAutoCode(r?.data?.[0]?.code || "");
      } catch {
        if (myId === suggestId.current) setAutoCode("");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.subGroupName, form.subGroupCode, form.parentId, open, editingItem]);

  const openForm = (item, preset = {}) => {
    setEditingItem(item);
    setForm(
      item
        ? {
            groupId: String(item.groupId),
            parentId: item.parentId ? String(item.parentId) : "",
            subGroupName: item.subGroupName || "",
            subGroupCode: item.subGroupCode || "",
            status: item.status || "Active",
          }
        : { ...EMPTY_FORM, groupId: filterGroupId, ...preset }
    );
    setCodeState({ status: "idle", message: "" });
    setAutoCode("");
    setOpen(true);
  };

  const handleFilter = (groupId) => {
    setFilterGroupId(groupId);
    fetchList(groupId);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await apiRequest({
        url: `${API_ENDPOINTS.MASTER.DELETE_SUB_GROUP_BY_ID}/${deleteTarget.subGroupId}`,
        method: "DELETE",
      });
      toast.success("Sub Group deleted");
      setDeleteTarget(null);
      fetchList();
    } catch (e) {
      toast.error(e.message || "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---- tree (parent > child > grand child) ----
  const childrenByParent = useMemo(() => {
    const map = new Map();
    const ids = new Set(data.map((d) => d.subGroupId));
    data.forEach((d) => {
      // if the parent is not in the list, show the row at top level
      const key = d.parentId && ids.has(d.parentId) ? d.parentId : "root";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    return map;
  }, [data]);

  const parentIds = useMemo(
    () => data.filter((d) => childrenByParent.has(d.subGroupId)).map((d) => d.subGroupId),
    [data, childrenByParent]
  );

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const expandAll = () => setExpanded(new Set(parentIds));
  const collapseAll = () => setExpanded(new Set());

  const renderRows = (parentKey) =>
    (childrenByParent.get(parentKey) || []).map((item) => {
      const kids = childrenByParent.get(item.subGroupId) || [];
      const isOpen = expanded.has(item.subGroupId);
      return (
        <Fragment key={item.subGroupId}>
          <tr className={item.level > 0 ? "bg-gray-50" : ""}>
            <td className="border p-2" title={item.path}>
              <div className="flex items-center gap-1" style={{ paddingLeft: item.level * 22 }}>
                {kids.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggle(item.subGroupId)}
                    className="cursor-pointer text-gray-600 hover:text-black"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                ) : (
                  <span className="inline-block w-[15px]" />
                )}
                <span className={item.level === 0 ? "font-medium" : ""}>{item.subGroupName}</span>
                {kids.length > 0 && <span className="text-xs text-gray-500">({kids.length})</span>}
              </div>
            </td>
            <td className="border p-2">{item.levelLabel}</td>
            <td className="border p-2">{item.subGroupCode}</td>
            <td className="border p-2">{item.groupName}</td>
            <td className="border p-2">{item.headUnder}</td>
            <td className="border p-2">{item.status}</td>
            <td className="border">
              <div className="flex items-center justify-center gap-3 h-full">
                {item.canHaveChildren && (
                  <Plus
                    size={15}
                    className="cursor-pointer text-blue-600"
                    aria-label={`Add ${LEVEL_LABELS[item.level + 1]} under ${item.subGroupName}`}
                    onClick={() => openForm(null, { groupId: String(item.groupId), parentId: String(item.subGroupId) })}
                  />
                )}
                <Pencil size={14} className="cursor-pointer" onClick={() => openForm(item)} />
                <Trash2 size={14} className="cursor-pointer text-red-600" onClick={() => setDeleteTarget(item)} />
              </div>
            </td>
          </tr>
          {isOpen && renderRows(item.subGroupId)}
        </Fragment>
      );
    });

  const parent = parentOptions.find((p) => String(p.subGroupId) === form.parentId);
  const newLevel = parent ? parent.level + 1 : 0;

  const codeBlocked = ["checking", "taken", "invalid"].includes(codeState.status);
  const isFormValid = form.subGroupName.trim() !== "" && form.groupId !== "" && !codeBlocked;

  const handleSave = async () => {
    if (!isFormValid) {
      toast.warning(codeBlocked ? codeState.message || "Fix the code" : "Group and Sub Group name are required");
      return;
    }
    const payload = {
      subGroupName: form.subGroupName.trim(),
      subGroupCode: normalizeCode(form.subGroupCode) || null, // empty -> auto code
      groupId: Number(form.groupId),
      parentId: form.parentId ? Number(form.parentId) : null,
      ...(editingItem && { status: form.status }),
    };
    let toastId;
    try {
      setSaving(true);
      toastId = toast.loading("Saving...");
      const r = await apiRequest({
        url: editingItem
          ? `${API_ENDPOINTS.MASTER.UPDATE_SUB_GROUP_BY_ID}/${editingItem.subGroupId}`
          : API_ENDPOINTS.MASTER.CREATE_SUB_GROUP,
        method: editingItem ? "PUT" : "POST",
        data: payload,
      });
      const saved = r?.data?.[0];
      toast.success(saved ? `Saved with code ${saved.subGroupCode}` : "Saved", { id: toastId });
      if (saved?.pathIds?.length > 1) {
        setExpanded((prev) => new Set([...prev, ...saved.pathIds.slice(0, -1)]));
      }
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e.message || "Failed", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => {
    const value = key === "subGroupCode" ? normalizeCode(e.target.value) : e.target.value;
    setForm((p) => ({
      ...p,
      [key]: value,
      // changing group resets the parent
      ...(key === "groupId" && { parentId: "" }),
    }));
  };

  // for SearchableSelect (gives the value, not an event)
  const setSelect = (key) => (value) => set(key)({ target: { value: value ? String(value) : "" } });

  const codeColor = {
    ok: "text-green-700",
    taken: "text-red-600",
    invalid: "text-red-600",
    checking: "text-gray-500",
  }[codeState.status];

  return (
    <div className="w-full">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <button onClick={() => openForm(null)} className="bg-[#8ed1fc] px-5 py-1 rounded-md cursor-pointer">
          + Add Sub Group
        </button>

        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={expandAll} className="px-2 py-0.5 border rounded cursor-pointer">
            Expand all
          </button>
          <button type="button" onClick={collapseAll} className="px-2 py-0.5 border rounded cursor-pointer">
            Collapse all
          </button>
          <span>Group</span>
          <div className="w-[220px]">
            <SearchableSelect
              options={groups}
              value={filterGroupId}
              onChange={(v) => handleFilter(v ? String(v) : "")}
              placeholder="All"
              clearLabel="All"
              labelKey="groupName"
              valueKey="groupId"
              searchKeys={["groupName", "headUnder"]}
            />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="border max-h-100 overflow-y-auto">
        <table ref={tableRef} className="w-full text-sm">
          <thead className="bg-green-200 sticky top-0">
            <tr>
              <th className="border p-2 text-left">Sub Group</th>
              <th className="border p-2 text-left">Level</th>
              <th className="border p-2 text-left">Code</th>
              <th className="border p-2 text-left">Group</th>
              <th className="border p-2 text-left">Head Under</th>
              <th className="border p-2 text-left">Status</th>
              <th className="border p-2 w-24">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center p-4">Loading...</td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-4">No sub groups</td>
              </tr>
            ) : (
              renderRows("root")
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit" : "Add"} {LEVEL_LABELS[newLevel] || "Sub Group"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <Label>Group</Label>
              <SearchableSelect
                options={groups}
                value={form.groupId}
                onChange={setSelect("groupId")}
                disabled={saving}
                placeholder="Select Group"
                labelKey={["groupName", "headUnder"]}
                labelSeparator=" - "
                valueKey="groupId"
                searchKeys={["groupName", "headUnder"]}
                className={!form.groupId ? "[&>button]:border-red-500" : ""}
              />
            </div>

            <div className="flex gap-2 items-center">
              <Label>Under</Label>
              <SearchableSelect
                options={parentOptions}
                value={form.parentId}
                onChange={setSelect("parentId")}
                disabled={saving || !form.groupId}
                placeholder="— None (top Sub Group) —"
                clearLabel="— None (top Sub Group) —"
                labelKey={["path", "subGroupCode"]}
                labelSeparator=" : "
                valueKey="subGroupId"
                searchKeys={["path", "subGroupCode"]}
              />
            </div>

            <div className="flex gap-2 items-center">
              <Label>{LEVEL_LABELS[newLevel] || "Sub Group"}</Label>
              <Input
                value={form.subGroupName}
                onChange={set("subGroupName")}
                disabled={saving}
                className={`${!form.subGroupName && "border-red-500"}`}
              />
            </div>

            <div className="flex gap-2 items-start">
              <Label>Code</Label>
              <div className="w-full">
                <Input
                  value={form.subGroupCode}
                  onChange={set("subGroupCode")}
                  placeholder="Leave empty for auto code"
                  maxLength={50}
                  disabled={saving}
                  className={codeState.status === "taken" || codeState.status === "invalid" ? "border-red-500" : ""}
                />
                <div className="text-xs mt-1 min-h-4">
                  {codeState.message ? (
                    <span className={codeColor}>
                      {codeState.status === "ok" ? "✓ " : codeState.status === "taken" || codeState.status === "invalid" ? "✗ " : ""}
                      {codeState.message}
                    </span>
                  ) : editingItem ? (
                    <span className="text-gray-500">Empty keeps current code</span>
                  ) : autoCode ? (
                    <span className="text-gray-500">Auto code: {autoCode}</span>
                  ) : (
                    <span className="text-gray-500">Empty = auto code</span>
                  )}
                </div>
              </div>
            </div>

            {editingItem && (
              <div className="flex gap-2 items-center">
                <Label>Status</Label>
                <select value={form.status} onChange={set("status")} disabled={saving} className="border w-full p-2">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setOpen(false)} disabled={saving} className="px-4 py-1 border rounded cursor-pointer">
                Cancel
              </button>
              <SaveButton onClick={handleSave} disabled={!isFormValid || saving}>
                Save
              </SaveButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deleteLoading) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">Delete {deleteTarget?.levelLabel || "Sub Group"}</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-black">&quot;{deleteTarget?.path}&quot;</span>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteLoading}
              className="text-[12px] h-8"
              onClick={() => setDeleteTarget(null)}
            >
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
