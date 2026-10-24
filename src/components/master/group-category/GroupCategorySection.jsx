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
  addLabel,
  listApi,
  createApi,
  updateApi,
  nameKey,       // groupName / categoryName
  idKey,         // groupId / categoryId
  headOptions,
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

  useEffect(() => {
    fetchList();
  }, []);

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

  return (
    <div className="w-full">

      {/* HEADER */}
      <div className="flex justify-between mb-3">
        <button
          onClick={handleAdd}
          className="bg-[#8ed1fc] px-5 py-1 rounded-md cursor-pointer"
        >
          {addLabel}
        </button>
      </div>

      {/* TABLE */}
      <div className="border max-h-75 overflow-y-auto">
        <table ref={tableRef} className="w-full text-sm">
          <thead className="bg-green-200">
            <tr>
              <th className="border p-2 text-left">{title}</th>
              <th className="border p-2 text-left">Head Under</th>
              <th className="border p-2 w-15 ">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center p-4">Loading...</td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item[idKey]}>
                  <td className="border p-2">{item[nameKey]}</td>
                  <td className="border p-2">{item.headUnder}</td>
                  <td className="border">
                    <div className="flex items-center justify-center  h-full">
                        <Pencil
                      size={14}
                      className="cursor-pointer"
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