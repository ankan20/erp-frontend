"use client";

import React, { useEffect, useMemo, useState } from "react";
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

export default function SRNItemSelectionModal({ open, onClose, form, brrId, initialData = null, onFetched }) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");
  const [groups, setGroups]   = useState([]);

  const existingItems = form.watch("items") || [];

  useEffect(() => {
    if (!open) return;
    if (!brrId) { toast.error("BRR ID not found"); onClose?.(); return; }

    const fetchItems = async () => {
      try {
        setLoading(true);
        let srns;
        if (initialData?.srns) {
          srns = initialData.srns;
        } else {
          const res = await apiRequest({
            url: `${API_ENDPOINTS.RESOURCE.BRB.ITEMS_BY_BRR}/${brrId}`,
            method: "GET",
          });
          srns = res.data?.srns || [];
          onFetched?.(res.data);
        }

        setGroups(
          srns.map((srn) => ({
            srnId:   srn.srnId,
            srnNo:   srn.srnNo,
            srnDate: srn.srnDate,
            items:   (srn.items || [])
              .map((item) => {
                const existing = existingItems.find(
                  (ex) => String(ex.srnItemId) === String(item.srnItemId)
                );
                const effectiveAvailableQty = existing
                  ? Number(item.availableQty ?? 0) + Number(existing.billingQty ?? 0)
                  : Number(item.availableQty ?? 0);
                return {
                  ...item,
                  srnId:   srn.srnId,
                  srnNo:   srn.srnNo,
                  srnDate: srn.srnDate,
                  effectiveAvailableQty,
                  selected:   !!existing,
                  billingQty: existing ? existing.billingQty : "",
                };
              })
              .filter((item) => item.effectiveAvailableQty > 0),
          }))
          .filter((srn) => srn.items.length > 0)
        );
      } catch (err) {
        toast.error(err.message || "Failed to load SRN items");
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [open, brrId]);

  const handleSelectItem = (srnId, srnItemId, checked) =>
    setGroups((prev) => prev.map((g) =>
      g.srnId !== srnId ? g : {
        ...g,
        items: g.items.map((item) =>
          String(item.srnItemId) === String(srnItemId)
            ? { ...item, selected: checked, billingQty: checked ? item.effectiveAvailableQty : "" }
            : item
        ),
      }
    ));

  const handleSelectGroup = (srnId, checked) =>
    setGroups((prev) => prev.map((g) =>
      g.srnId !== srnId ? g : {
        ...g,
        items: g.items.map((item) => ({
          ...item,
          selected:   checked,
          billingQty: checked ? item.effectiveAvailableQty : "",
        })),
      }
    ));

  const handleSelectAll = (checked) =>
    setGroups((prev) => prev.map((g) => ({
      ...g,
      items: g.items.map((item) => ({
        ...item,
        selected:   checked,
        billingQty: checked ? item.effectiveAvailableQty : "",
      })),
    })));

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) =>
          [item.itemCode, item.itemName, item.srnl, item.itemUnit, item.useLocation, item.storeLocation, g.srnNo]
            .some((v) => String(v ?? "").toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.items.length > 0 || String(g.srnNo).toLowerCase().includes(q));
  }, [search, groups]);

  const allFlatItems  = filteredGroups.flatMap((g) => g.items);
  const totalSelected = groups.flatMap((g) => g.items).filter((i) => i.selected).length;
  const allSelected   = allFlatItems.length > 0 && allFlatItems.every((i) => i.selected);
  const someSelected  = allFlatItems.some((i) => i.selected);

  const handleSubmit = () => {
    const allItems = groups.flatMap((g) => g.items);
    const selected = allItems.filter((r) => r.selected);
    for (const row of selected) {
      const qty = Number(row.billingQty);
      if (!qty || qty <= 0) { toast.error(`${row.itemName}: billing qty must be > 0`); return; }
      if (qty > row.effectiveAvailableQty) {
        toast.error(`${row.itemName}: billing qty exceeds available (${row.effectiveAvailableQty})`);
        return;
      }
    }
    const formatted = selected.map((row) => ({
      srnItemId:            row.srnItemId,
      srnId:                row.srnId,
      srnNo:                row.srnNo,
      srnDate:              row.srnDate,
      srnl:                 row.srnl,
      itemCode:             row.itemCode,
      itemName:             row.itemName,
      itemUnit:             row.itemUnit,
      receivedQty:          Number(row.receivedQty ?? 0),
      alreadyBilled:        Number(row.alreadyBilled ?? 0),
      availableQty:         Number(row.availableQty ?? 0),
      effectiveAvailableQty: row.effectiveAvailableQty,
      billingQty:           row.billingQty,
      rate:                 Number(row.rate ?? 0),
      gstPercent:           Number(row.gstPercent ?? 0),
      useLocation:          row.useLocation || "",
      storeLocation:        row.storeLocation || "",
    }));
    const nonSelected = existingItems.filter(
      (ex) => !formatted.some((f) => String(f.srnItemId) === String(ex.srnItemId))
    );
    form.setValue("items", [...nonSelected, ...formatted], { shouldValidate: true, shouldDirty: true });
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="w-[95vw] max-w-[95vw] lg:max-w-[1100px] p-0 gap-0 max-h-[95vh] flex flex-col">
        <DialogHeader className="px-6 py-3 border-b bg-slate-50">
          <DialogTitle className="text-[15px] font-semibold">Select SRN Items</DialogTitle>
        </DialogHeader>

        {/* Search + global select */}
        <div className="px-4 py-3 border-b bg-white flex items-center gap-4">
          <div className="relative w-full max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item, SRN No, location…"
              className="pl-9 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(c) => handleSelectAll(!!c)}
            />
            <span className="text-sm text-gray-600">Select All</span>
            {totalSelected > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-medium">
                {totalSelected} selected
              </span>
            )}
          </div>
        </div>

        <div className="overflow-auto flex-1 min-h-0">
          {loading && (
            <div className="h-[200px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}
          {!loading && !filteredGroups.length && (
            <div className="h-[140px] flex items-center justify-center text-gray-400 text-sm">
              No items found
            </div>
          )}

          {!loading && filteredGroups.length > 0 && (
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-[#d9d9d9]">
                <tr>
                  <th className="border border-[#bbb] p-2 w-[44px]" />
                  <th className="border border-[#bbb] p-2 min-w-[80px]  text-left font-semibold">SRNL</th>
                  <th className="border border-[#bbb] p-2 min-w-[110px] text-left font-semibold">Item Code</th>
                  <th className="border border-[#bbb] p-2 min-w-[190px] text-left font-semibold">Item Name</th>
                  <th className="border border-[#bbb] p-2 min-w-[65px]  text-center font-semibold">Unit</th>
                  <th className="border border-[#bbb] p-2 min-w-[85px]  text-center font-semibold">Rcvd Qty</th>
                  <th className="border border-[#bbb] p-2 min-w-[75px]  text-center font-semibold">Rate</th>
                  <th className="border border-[#bbb] p-2 min-w-[90px]  text-center font-semibold">Amount</th>
                  <th className="border border-[#bbb] p-2 min-w-[65px]  text-center font-semibold">GST %</th>
                  <th className="border border-[#bbb] p-2 min-w-[140px] text-left font-semibold">Use Location</th>
                  <th className="border border-[#bbb] p-2 min-w-[140px] text-left font-semibold">Store Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((srn) => {
                  const groupAllSelected  = srn.items.every((i) => i.selected);
                  const groupSomeSelected = srn.items.some((i) => i.selected);
                  const groupChecked = groupAllSelected ? true : groupSomeSelected ? "indeterminate" : false;
                  return (
                    <React.Fragment key={`srn-group-${srn.srnId}`}>
                      {/* ── SRN parent header row ── */}
                      <tr key={`srn-hdr-${srn.srnId}`} className="bg-sky-100">
                        <td className="border border-[#bbb] p-2">
                          <div className="flex justify-center">
                            <div className="bg-white rounded p-[2px] shadow-sm">
                              <Checkbox
                                checked={groupChecked}
                                onCheckedChange={(c) => handleSelectGroup(srn.srnId, !!c)}
                              />
                            </div>
                          </div>
                        </td>
                        <td colSpan={10} className="border border-[#bbb] px-3 py-[6px]">
                          <div className="flex items-center gap-6 flex-wrap">
                            <span className="font-bold text-[13px] text-gray-800">
                              SRN No:&nbsp;
                              <span className="text-blue-700">{srn.srnNo}</span>
                            </span>
                            <span className="text-[12px] text-gray-600">
                              SRN Date:&nbsp;<span className="font-medium">{srn.srnDate}</span>
                            </span>
                            <span className="ml-auto text-[11px] text-gray-500">
                              {srn.items.filter((i) => i.selected).length} / {srn.items.length} selected
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* ── Child item rows ── */}
                      {srn.items.map((item) => (
                        <tr
                          key={`item-${item.srnItemId}`}
                          className={item.selected ? "bg-blue-50" : "bg-white hover:bg-gray-50"}
                        >
                          <td className="border border-[#ddd] p-2 border-l-[3px] border-l-sky-300">
                            <div className="flex justify-center pl-2">
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={(c) => handleSelectItem(srn.srnId, item.srnItemId, !!c)}
                              />
                            </div>
                          </td>
                          <td className="border border-[#ddd] p-2 pl-7">{item.srnl}</td>
                          <td className="border border-[#ddd] p-2">{item.itemCode}</td>
                          <td className="border border-[#ddd] p-1">
                            <ExpandableTextField value={item.itemName || ""} disabled title="Item Name" minHeight="min-h-[30px]" modalHeight="min-h-[180px]" />
                          </td>
                          <td className="border border-[#ddd] p-2 text-center">{item.itemUnit}</td>
                          <td className="border border-[#ddd] p-2 text-center font-medium">{item.receivedQty}</td>
                          <td className="border border-[#ddd] p-2 text-center">{item.rate}</td>
                          <td className="border border-[#ddd] p-2 text-center font-medium">
                            {(Number(item.rate ?? 0) * Number(item.receivedQty ?? 0)).toFixed(2)}
                          </td>
                          <td className="border border-[#ddd] p-2 text-center">{item.gstPercent}</td>
                          <td className="border border-[#ddd] p-1">
                            <ExpandableTextField value={item.useLocation || ""} disabled title="Use Location" minHeight="min-h-[30px]" modalHeight="min-h-[180px]" />
                          </td>
                          <td className="border border-[#ddd] p-1">
                            <ExpandableTextField value={item.storeLocation || ""} disabled title="Store Location" minHeight="min-h-[30px]" modalHeight="min-h-[180px]" />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-3 bg-slate-50">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={totalSelected === 0}>
            <Check className="w-4 h-4 mr-1" />
            Add {totalSelected > 0 ? `${totalSelected} ` : ""}Selected
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
