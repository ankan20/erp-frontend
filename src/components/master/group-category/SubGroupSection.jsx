"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/apiClient";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import SaveButton from "@/components/common/SaveButton";
import { useColumnResize } from "@/hooks/useColumnResize";
import { API_ENDPOINTS } from "@/config/api.config";

const EMPTY_FORM = {
  subGroupName: "",
  subGroupCode: "",
  groupId: "",
  status: "Active",
};

function Label({ children }) {
  return <div className="px-3 py-1 bg-[#d6e6f2] border w-[150px] shrink-0">{children}</div>;
}

// Sub Group: many per Group. Category is chosen on the CC code, not here.
export default function SubGroupSection() {
  const [data, setData] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterGroupId, setFilterGroupId] = useState("");

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { tableRef } = useColumnResize();

  const fetchList = async (groupId = filterGroupId) => {
    try {
      setLoading(true);
      const res = await apiRequest({
        url: API_ENDPOINTS.MASTER.GET_ALL_SUB_GROUP,
        method: "GET",
        params: groupId ? { groupId } : undefined,
      });
      setData(res?.data || []);
    } catch (e) {
      toast.error(e.message || "Failed to load sub groups");
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const g = await apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_GROUP, method: "GET" });
      setGroups(g?.data || []);
    } catch {
      toast.error("Failed to load groups");
    }
  };

  useEffect(() => {
    fetchDropdowns();
    fetchList("");
  }, []);

  const handleFilter = (groupId) => {
    setFilterGroupId(groupId);
    fetchList(groupId);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM, groupId: filterGroupId });
    setOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      subGroupName: item.subGroupName || "",
      subGroupCode: item.subGroupCode || "",
      groupId: item.groupId ? String(item.groupId) : "",
      status: item.status || "Active",
    });
    setOpen(true);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete sub group "${item.subGroupName}"?`)) return;
    const toastId = toast.loading("Deleting...");
    try {
      await apiRequest({
        url: `${API_ENDPOINTS.MASTER.DELETE_SUB_GROUP_BY_ID}/${item.subGroupId}`,
        method: "DELETE",
      });
      toast.success("Deleted", { id: toastId });
      fetchList();
    } catch (e) {
      toast.error(e.message || "Failed to delete", { id: toastId });
    }
  };

  const isFormValid =
    form.subGroupName.trim() !== "" &&
    form.subGroupCode.trim() !== "" &&
    form.groupId !== "";

  const handleSave = async () => {
    if (!isFormValid) {
      toast.warning("Sub Group, Code and Group are required");
      return;
    }
    const payload = {
      subGroupName: form.subGroupName.trim(),
      subGroupCode: form.subGroupCode.trim().toUpperCase(),
      groupId: Number(form.groupId),
      ...(editingItem && { status: form.status }),
    };

    let toastId;
    try {
      setSaving(true);
      toastId = toast.loading("Saving...");
      await apiRequest({
        url: editingItem
          ? `${API_ENDPOINTS.MASTER.UPDATE_SUB_GROUP_BY_ID}/${editingItem.subGroupId}`
          : API_ENDPOINTS.MASTER.CREATE_SUB_GROUP,
        method: editingItem ? "PUT" : "POST",
        data: payload,
      });
      toast.success("Success", { id: toastId });
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e.message || "Failed", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div className="w-full">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <button
          onClick={handleAdd}
          className="bg-[#8ed1fc] px-5 py-1 rounded-md cursor-pointer"
        >
          + Add Sub Group
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span>Group</span>
          <select
            value={filterGroupId}
            onChange={(e) => handleFilter(e.target.value)}
            className="border p-1 min-w-[200px]"
          >
            <option value="">All</option>
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.groupName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="border max-h-75 overflow-y-auto">
        <table ref={tableRef} className="w-full text-sm">
          <thead className="bg-green-200 sticky top-0">
            <tr>
              <th className="border p-2 text-left">Sub Group</th>
              <th className="border p-2 text-left">Code</th>
              <th className="border p-2 text-left">Group</th>
              <th className="border p-2 text-left">Head Under</th>
              <th className="border p-2 text-left">Status</th>
              <th className="border p-2 w-20">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center p-4">Loading...</td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-4">No sub groups</td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.subGroupId}>
                  <td className="border p-2">{item.subGroupName}</td>
                  <td className="border p-2">{item.subGroupCode}</td>
                  <td className="border p-2">{item.groupName}</td>
                  <td className="border p-2">{item.headUnder}</td>
                  <td className="border p-2">{item.status}</td>
                  <td className="border">
                    <div className="flex items-center justify-center gap-3 h-full">
                      <Pencil size={14} className="cursor-pointer" onClick={() => handleEdit(item)} />
                      <Trash2 size={14} className="cursor-pointer text-red-600" onClick={() => handleDelete(item)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit" : "Add"} Sub Group</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <Label>Group</Label>
              <select
                value={form.groupId}
                onChange={setField("groupId")}
                disabled={saving}
                className={`border w-full p-2 ${!form.groupId && "border-red-500"}`}
              >
                <option value="">Select</option>
                {groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.groupName}{g.headUnder ? ` (${g.headUnder})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <Label>Sub Group</Label>
              <Input
                value={form.subGroupName}
                onChange={setField("subGroupName")}
                disabled={saving}
                className={`${!form.subGroupName && "border-red-500"}`}
              />
            </div>

            <div className="flex gap-2 items-center">
              <Label>Code</Label>
              <Input
                value={form.subGroupCode}
                onChange={setField("subGroupCode")}
                placeholder="e.g. FIXED_ASSET"
                disabled={saving}
                className={`uppercase ${!form.subGroupCode && "border-red-500"}`}
              />
            </div>


            {editingItem && (
              <div className="flex gap-2 items-center">
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={setField("status")}
                  disabled={saving}
                  className="border w-full p-2"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="px-4 py-1 border rounded cursor-pointer"
              >
                Cancel
              </button>
              <SaveButton onClick={handleSave} disabled={!isFormValid || saving}>
                Save
              </SaveButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
