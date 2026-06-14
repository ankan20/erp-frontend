"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass } from "@/lib/formStyles";

export default function BVSGRNItemSelectionModal({ open, onClose, form }) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tempRows, setTempRows] = useState([]);

  const orderId = form.watch("orderId");
  const existingItems = form.watch("items") || [];

  useEffect(() => {
    if (!open) return;

    const orderIdNum = Number(orderId);
    if (!orderId || isNaN(orderIdNum) || orderIdNum <= 0) {
      toast.error("Please select an order first");
      onClose?.();
      return;
    }

    const fetchGRNItems = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.VENDOR_BILLING.BVS.GET_GRNS_BY_ORDER}/${orderIdNum}`,
          method: "GET",
        });

        // API returns { data: { grns: [...], ... } }
        const grns = res.data?.grns || [];
        const rows = [];
        for (const grn of grns) {
          for (const item of grn.items || []) {
            const existing = existingItems.find(
              (ex) => String(ex.grnItemId) === String(item.grnItemId),
            );
            const effectiveAvailableQty = existing
              ? Number(item.availableQty ?? 0) + Number(existing.billingQty ?? 0)
              : Number(item.availableQty ?? 0);

            rows.push({
              ...item,
              grnId: grn.grnId,
              grnNo: grn.grnNo,
              grnDate: grn.grnDate,
              effectiveAvailableQty,
              selected: !!existing,
              billingQty: existing ? existing.billingQty : "",
            });
          }
        }

        setTempRows(rows);
      } catch {
        toast.error("Failed to load GRN items");
      } finally {
        setLoading(false);
      }
    };

    fetchGRNItems();
  }, [open, orderId]);

  const filteredRows = useMemo(() => {
    if (!search) return tempRows;
    return tempRows.filter((row) =>
      Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search.toLowerCase()),
      ),
    );
  }, [search, tempRows]);

  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => r.selected);

  const handleSelectAll = (checked) => {
    setTempRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const handleSelect = (grnItemId, checked) => {
    setTempRows((prev) =>
      prev.map((r) =>
        String(r.grnItemId) === String(grnItemId) ? { ...r, selected: checked } : r,
      ),
    );
  };

  const handleBillingQtyChange = (grnItemId, value) => {
    setTempRows((prev) =>
      prev.map((r) =>
        String(r.grnItemId) === String(grnItemId) ? { ...r, billingQty: value } : r,
      ),
    );
  };

  const handleSubmit = () => {
    const selected = tempRows.filter((r) => r.selected);

    for (const row of selected) {
      const qty = Number(row.billingQty);
      if (!qty || qty <= 0) {
        toast.error(`${row.itemName}: billing qty must be greater than 0`);
        return;
      }
      if (qty > row.effectiveAvailableQty) {
        toast.error(`${row.itemName}: billing qty exceeds available qty (${row.effectiveAvailableQty})`);
        return;
      }
    }

    const formatted = selected.map((row) => ({
      grnItemId: row.grnItemId,
      grnId: row.grnId,
      grnNo: row.grnNo,
      grnDate: row.grnDate,
      grnl: row.grnl,
      itemCode: row.itemCode,
      itemName: row.itemName,
      itemUnit: row.itemUnit,
      note: row.note || "",
      useLocation: row.useLocation || "",
      storeLocation: row.storeLocation || "",
      receivedQty: Number(row.receivedQty ?? 0),
      alreadyBilled: Number(row.alreadyBilled ?? 0),
      availableQty: Number(row.availableQty ?? 0),
      effectiveAvailableQty: row.effectiveAvailableQty,
      billingQty: row.billingQty,
      rate: Number(row.rate ?? 0),
      amount: Number(row.amount ?? 0),
      gstPercent: Number(row.gstPercent ?? 0),
      gstAmount: Number(row.gstAmount ?? 0),
    }));

    // Keep existing items not in this selection + merge/replace selected
    const nonSelected = existingItems.filter(
      (ex) => !formatted.some((f) => String(f.grnItemId) === String(ex.grnItemId)),
    );

    form.setValue("items", [...nonSelected, ...formatted], {
      shouldValidate: true,
      shouldDirty: true,
    });

    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="min-w-[95vw] max-w-[95vw] lg:min-w-[1300px] lg:max-w-[1300px] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-slate-50">
          <DialogTitle className="text-lg font-semibold">Select GRN Items</DialogTitle>
        </DialogHeader>

        {/* SEARCH */}
        <div className="p-4 border-b">
          <div className="relative w-full max-w-[350px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="pl-9"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr>
                <th className="border p-2 min-w-[60px]">
                  <div className="flex justify-center">
                    <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                  </div>
                </th>
                <th className="border p-2 min-w-[120px] text-sm">GRN No</th>
                <th className="border p-2 min-w-[100px] text-sm">GRN Date</th>
                <th className="border p-2 min-w-[80px] text-sm">GRNL</th>
                <th className="border p-2 min-w-[120px] text-sm">Item Code</th>
                <th className="border p-2 min-w-[220px] text-sm">Item Name</th>
                <th className="border p-2 min-w-[160px] text-sm">Note</th>
                <th className="border p-2 min-w-[70px] text-sm">Unit</th>
                <th className="border p-2 min-w-[100px] text-sm">Received Qty</th>
                <th className="border p-2 min-w-[100px] text-sm">Already Billed</th>
                <th className="border p-2 min-w-[100px] text-sm">Available Qty</th>
                <th className="border p-2 min-w-[120px] text-sm">Billing Qty</th>
                <th className="border p-2 min-w-[90px] text-sm">Rate</th>
                <th className="border p-2 min-w-[90px] text-sm">GST %</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={14} className="h-[200px] text-center">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !filteredRows.length && (
                <tr>
                  <td colSpan={14} className="h-[140px] text-center text-gray-500">
                    No Items Found
                  </td>
                </tr>
              )}
              {!loading && filteredRows.map((row) => {
                const qty = Number(row.billingQty);
                const qtyError = row.selected && (qty <= 0 || qty > row.effectiveAvailableQty);

                return (
                  <tr key={row.grnItemId}>
                    <td className="border p-2">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={(checked) => handleSelect(row.grnItemId, checked)}
                        />
                      </div>
                    </td>
                    <td className="border p-2 text-sm">{row.grnNo}</td>
                    <td className="border p-2 text-sm">{row.grnDate}</td>
                    <td className="border p-2 text-sm">{row.grnl}</td>
                    <td className="border p-2 text-sm">{row.itemCode}</td>
                    <td className="border p-2">
                      <ExpandableTextField
                        value={row.itemName}
                        disabled
                        title="Item Name"
                        minHeight="min-h-[38px]"
                        modalHeight="min-h-[180px]"
                      />
                    </td>
                    <td className="border p-2">
                      <ExpandableTextField
                        value={row.note || ""}
                        disabled
                        title="Note"
                        minHeight="min-h-[38px]"
                        modalHeight="min-h-[180px]"
                      />
                    </td>
                    <td className="border p-2 text-sm">{row.itemUnit}</td>
                    <td className="border p-2 text-sm text-center">{row.receivedQty}</td>
                    <td className="border p-2 text-sm text-center">{row.alreadyBilled}</td>
                    <td className="border p-2 text-sm text-center">{row.effectiveAvailableQty}</td>
                    <td className="border p-2">
                      <div>
                        <Input
                          type="number"
                          step="0.001"
                          value={row.billingQty ?? ""}
                          disabled={!row.selected}
                          onChange={(e) => handleBillingQtyChange(row.grnItemId, e.target.value)}
                          className={getInputClass(qtyError, !row.selected)}
                        />
                        {qtyError && (
                          <p className="text-red-500 text-[10px] mt-1">
                            Max {row.effectiveAvailableQty}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="border p-2 text-sm text-center">{row.rate}</td>
                    <td className="border p-2 text-sm text-center">{row.gstPercent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
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
