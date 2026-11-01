"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/apiClient";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import SaveButton from "@/components/common/SaveButton";
import { useColumnResize } from "@/hooks/useColumnResize";


export default function GroupCategorySection({
  title,
  listApi,
  createApi,
  updateApi,
  nameKey,          // groupName / categoryName
  idKey,            // groupId / categoryId
  headOptions,
  refreshTrigger,
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [form, setForm] = useState({
    name: "",
    headUnder: "",
  });

  const [saving, setSaving] = useState(false);
  const { tableRef } = useColumnResize();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 🔥 FETCH LIST
  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await apiRequest({ url: listApi, method: "GET" });
      setData(res.data || []);
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);
  useEffect(() => { setPage(1); }, [data]);

  // re-fetch when parent signals a new entry was saved
  useEffect(() => {
    if (refreshTrigger > 0) fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // 🔥 OPEN ADD
  const handleAdd = () => {
    setEditingItem(null);
    setForm({ name: "", headUnder: "" });
    setOpen(true);
  };

  // 🔥 OPEN EDIT
  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item[nameKey],
      headUnder: item.headUnder,
    });
    setOpen(true);
  };

  //  SAVE
  const handleSave = async () => {
    if (!form.name.trim() || !form.headUnder) {
    toast.warning("All fields are required");
    return;
  }
    let toastId;
    try {
      setSaving(true);
      toastId = toast.loading("Saving...");

      if (editingItem) {
        await apiRequest({
          url: `${updateApi}/${editingItem[idKey]}`,
          method: "PUT",
          data: {
            [nameKey]: form.name,
            headUnder: form.headUnder,
          },
        });
      } else {
        await apiRequest({
          url: createApi,
          method: "POST",
          data: {
            [nameKey]: form.name,
            headUnder: form.headUnder,
          },
        });
      }

      toast.success("Success", { id: toastId });
      setOpen(false);
      fetchList();

    } catch {
      toast.error("Failed", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = form.name.trim() !== "" && form.headUnder !== "";

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const pagedData = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="w-full">

      {/* TABLE */}
      <div className="border rounded overflow-hidden">
        <table ref={tableRef} className="w-full text-sm">
          <thead className="bg-[#e8f4fd] text-[#1c3a5e]">
            <tr>
              <th className="border-b border-[#c5dbed] px-3 py-2 text-left font-semibold">{title} Name</th>
              <th className="border-b border-[#c5dbed] px-3 py-2 text-left font-semibold">Head Under</th>
              <th className="border-b border-[#c5dbed] px-3 py-2 w-12 text-center font-semibold">Edit</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center py-6 text-gray-400 text-xs">Loading…</td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-6 text-gray-400 text-xs">No {title.toLowerCase()}s yet</td>
              </tr>
            ) : (
              pagedData.map((item) => (
                <tr key={item[idKey]} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-medium text-gray-800">{item[nameKey]}</td>
                  <td className="px-3 py-2 text-gray-500">{item.headUnder}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center">
                      <Pencil
                        size={14}
                        className="cursor-pointer text-gray-400 hover:text-blue-600 transition-colors"
                        onClick={() => handleEdit(item)}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {!loading && data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs"
            >
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>{Math.min((page - 1) * pageSize + 1, data.length)}–{Math.min(page * pageSize, data.length)} of {data.length}</span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >‹</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >›</button>
          </div>
        </div>
      )}

      {/* MODAL */}
      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit" : "Add"} {title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">

            {/* NAME */}
            <div className="flex gap-2 items-center">
              <div className="px-3 py-1 bg-[#d6e6f2] border w-[150px]">
                {title}
              </div>

              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                disabled={saving}
                className={`${!form.name && "border-red-500"}`}
              />
            </div>

            {/* HEAD UNDER */}
            <div className="flex gap-2 items-center">
              <div className="px-3 py-1 bg-[#d6e6f2] border w-[150px]">
                Head Under
              </div>

              <select
                value={form.headUnder}
                onChange={(e) =>
                  setForm((p) => ({ ...p, headUnder: e.target.value }))
                }
                disabled={saving}
                className={`border w-full p-2 ${
    !form.headUnder && "border-red-500"
  }`}
              >
                <option value="">Select</option>
                {headOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* BUTTONS */}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="px-4 py-1 border rounded cursor-pointer"
              >
                Cancel
              </button>

              <SaveButton
                onClick={handleSave}
                disabled={!isFormValid || saving}
                // className="px-4 py-1 bg-[#f6c85f]"
              >
                Save
              </SaveButton>
            </div>

          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}