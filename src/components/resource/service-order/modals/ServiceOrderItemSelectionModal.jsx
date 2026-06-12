"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass } from "@/lib/formStyles";
import ExpandableTextField from "@/components/common/ExpandableTextField";

export default function ServiceOrderItemSelectionModal({ open, onClose, form }) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tempRows, setTempRows] = useState([]);

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode;

  const subCategoryCodes = form.watch("subCategoryCodes") || [];
  const costHead = form.watch("costHead");
  const existingItems = form.watch("items") || [];

  // LOAD ITEMS
  useEffect(() => {
    if (!open) return;

    // Guard: sub category must be selected
    if (!subCategoryCodes.length) {
      toast.error("Please select at least one sub category first");
      onClose?.();
      return;
    }

    // Guard: cost head must be selected before fetching items
    if (!costHead) {
      toast.error("Please select Cost Head first");
      onClose?.();
      return;
    }

    const fetchItems = async () => {
      try {
        setLoading(true);

        const subCodesParam = subCategoryCodes.join(",");
        // FIXED: assetOnly driven by costHead selection, not hardcoded by category
        const assetOnly = costHead === "Fixed_Asset";

        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.PROJECT_WORK.GET_ITEM_LIST}?projectCode=${projectCode}&subCodes=${subCodesParam}&assetOnly=${assetOnly}`,
          method: "GET",
        });

        const apiItems = res.data || [];

        const merged = apiItems.map((item) => {
          const existing = existingItems.find(
            (ex) => String(ex.itemCode) === String(item.itemCode)
          );
          const balanceQty =
            item.maxQty !== null && item.maxQty !== undefined
              ? Number(item.maxQty) - Number(item.orderedQty || 0)
              : null;

          return {
            ...item,
            balanceQty,
            selected: !!existing,
            orderQty: existing?.qty ?? item.orderQty ?? "",
          };
        });

        setTempRows(merged);
      } catch {
        toast.error("Failed to load items");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredItems = useMemo(() => {
    if (!search) return tempRows;
    return tempRows.filter((item) =>
      Object.values(item).some((v) =>
        String(v).toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, tempRows]);

  const allSelected = filteredItems.length > 0 && filteredItems.every((i) => i.selected);

  const handleSelectAll = (checked) => {
    setTempRows((prev) => prev.map((i) => ({ ...i, selected: checked })));
  };

  const handleSelect = (itemCode, checked) => {
    setTempRows((prev) =>
      prev.map((i) =>
        String(i.itemCode) === String(itemCode) ? { ...i, selected: checked } : i
      )
    );
  };

  const handleQtyChange = (itemCode, value) => {
    setTempRows((prev) =>
      prev.map((i) =>
        String(i.itemCode) === String(itemCode) ? { ...i, orderQty: value } : i
      )
    );
  };

  const getQtyError = (item) => {
    if (!item.selected) return false;
    const qty = Number(item.orderQty);
    if (!qty || qty <= 0) return true;
    if (item.balanceQty !== null && qty > item.balanceQty) return true;
    return false;
  };

  const handleSubmit = () => {
    const selectedRows = tempRows.filter((i) => i.selected);

    for (const item of selectedRows) {
      const qty = Number(item.orderQty);
      if (!qty || qty <= 0) {
        toast.error(`${item.itemName}: Qty must be greater than 0`);
        return;
      }
      if (item.balanceQty !== null && qty > item.balanceQty) {
        toast.error(`${item.itemName}: Qty exceeds balance qty (${item.balanceQty})`);
        return;
      }
    }

    const formatted = selectedRows.map((item) => {
      const existing = existingItems.find(
        (ex) => String(ex.itemCode) === String(item.itemCode)
      );
      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemUnit: item.itemUnit || "",
        qty: Number(item.orderQty),
        rate: existing?.rate ?? "",
        gstPercent: existing?.gstPercent ?? "",
        amount: Number(
          (Number(item.orderQty) * Number(existing?.rate || 0)).toFixed(3)
        ),
        gstAmount: Number(
          ((Number(item.orderQty) * Number(existing?.rate || 0) * Number(existing?.gstPercent || 0)) / 100).toFixed(3)
        ),
        note: existing?.note || "",
        location: existing?.location || "",
      };
    });

    const untouched = existingItems.filter(
      (ex) => !tempRows.some((r) => String(r.itemCode) === String(ex.itemCode))
    );

    form.setValue("items", [...untouched, ...formatted], {
      shouldValidate: true,
      shouldDirty: true,
    });

    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose?.(); }}>
      <DialogContent className="min-w-[95vw] max-w-[95vw] lg:min-w-[1100px] lg:max-w-[1100px] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-slate-50">
          <DialogTitle className="text-lg font-semibold">Select Service Order Items</DialogTitle>
        </DialogHeader>

        <div className="p-4 border-b">
          <div className="relative w-full max-w-[350px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Items" className="pl-9" />
          </div>
        </div>

        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr>
                <th className="border p-2 min-w-[60px]">
                  <div className="flex justify-center">
                    <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                  </div>
                </th>
                <th className="border p-2 min-w-[120px] text-sm">Item Code</th>
                <th className="border p-2 min-w-[220px] text-sm">Item Name</th>
                <th className="border p-2 min-w-[80px] text-sm">Unit</th>
                <th className="border p-2 min-w-[110px] text-sm">Sub Category</th>
                <th className="border p-2 min-w-[110px] text-sm">Ordered Qty</th>
                <th className="border p-2 min-w-[110px] text-sm">Max Qty</th>
                <th className="border p-2 min-w-[110px] text-sm">Balance Qty</th>
                <th className="border p-2 min-w-[140px] text-sm">Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="h-[200px] text-center">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !filteredItems.length && (
                <tr>
                  <td colSpan={9} className="h-[140px] text-center text-gray-500">No Items Found</td>
                </tr>
              )}
              {!loading && filteredItems.map((item) => (
                <tr key={item.itemCode}>
                  <td className="border p-2">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={(checked) => handleSelect(item.itemCode, checked)}
                      />
                    </div>
                  </td>
                  <td className="border p-2 text-sm">{item.itemCode}</td>
                  <td className="border p-2">
                    <ExpandableTextField value={item.itemName} disabled title="Item Name" placeholder="Item Name" minHeight="min-h-[38px]" modalHeight="min-h-[180px]" />
                  </td>
                  <td className="border p-2 text-sm">{item.itemUnit || "-"}</td>
                  <td className="border p-2 text-sm">{item.subCodeName || item.subCode || "-"}</td>
                  <td className="border p-2 text-sm text-center">{item.orderedQty ?? "-"}</td>
                  <td className="border p-2 text-sm text-center">{item.maxQty ?? "Unlimited"}</td>
                  <td className="border p-2 text-sm text-center">
                    {item.balanceQty !== null ? item.balanceQty : "Unlimited"}
                  </td>
                  <td className="border p-2">
                    <Input
                      type="number"
                      step="0.001"
                      value={item.orderQty}
                      disabled={!item.selected}
                      onChange={(e) => handleQtyChange(item.itemCode, e.target.value)}
                      className={getInputClass(getQtyError(item), !item.selected)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleSubmit}>
            <Check className="w-4 h-4 mr-1" />
            Add Selected Items
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
