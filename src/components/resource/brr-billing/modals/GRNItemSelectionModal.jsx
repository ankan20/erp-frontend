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

const inr = (n) =>
  n > 0
    ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

function itemAmounts(item) {
  const amount   = Number(item.rate ?? 0) * Number(item.receivedQty ?? 0);
  const gstAmt   = amount * Number(item.gstPercent ?? 0) / 100;
  const totalAmt = amount + gstAmt;
  return { amount, gstAmt, totalAmt };
}

export default function GRNItemSelectionModal({ open, onClose, form, brrId, initialData = null, onFetched }) {
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
        let grns;
        if (initialData?.grns) {
          grns = initialData.grns;
        } else {
          const res = await apiRequest({
            url: `${API_ENDPOINTS.RESOURCE.BRB.ITEMS_BY_BRR}/${brrId}`,
            method: "GET",
          });
          grns = res.data?.grns || [];
          onFetched?.(res.data);
        }

        setGroups(
          grns.map((grn) => ({
            grnId:   grn.grnId,
            grnNo:   grn.grnNo,
            grnDate: grn.grnDate,
            items:   (grn.items || [])
              .map((item) => {
                const existing = existingItems.find(
                  (ex) => String(ex.grnItemId) === String(item.grnItemId)
                );
                const effectiveAvailableQty = existing
                  ? Number(item.availableQty ?? 0) + Number(existing.billingQty ?? 0)
                  : Number(item.availableQty ?? 0);
                return {
                  ...item,
                  grnId:  grn.grnId,
                  grnNo:  grn.grnNo,
                  grnDate: grn.grnDate,
                  effectiveAvailableQty,
                  selected:   !!existing,
                  billingQty: existing ? existing.billingQty : "",
                };
              })
              .filter((item) => item.effectiveAvailableQty > 0),
          }))
          .filter((grn) => grn.items.length > 0)
        );
      } catch (err) {
        toast.error(err.message || "Failed to load GRN items");
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [open, brrId]);

  const updateItem = (grnId, grnItemId, patch) =>
    setGroups((prev) => prev.map((g) =>
      g.grnId !== grnId ? g : {
        ...g,
        items: g.items.map((item) =>
          String(item.grnItemId) === String(grnItemId) ? { ...item, ...patch } : item
        ),
      }
    ));

  const handleSelectItem = (grnId, grnItemId, checked) =>
    updateItem(grnId, grnItemId, {
      selected:   checked,
      billingQty: checked
        ? groups.find((g) => g.grnId === grnId)?.items.find((i) => String(i.grnItemId) === String(grnItemId))?.effectiveAvailableQty ?? ""
        : "",
    });

  const handleSelectGroup = (grnId, checked) =>
    setGroups((prev) => prev.map((g) =>
      g.grnId !== grnId ? g : {
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
          [item.itemCode, item.itemName, item.grnl, item.itemUnit, item.useLocation, item.storeLocation, item.note, g.grnNo]
            .some((v) => String(v ?? "").toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.items.length > 0 || String(g.grnNo).toLowerCase().includes(q));
  }, [search, groups]);

  const allFlatItems  = filteredGroups.flatMap((g) => g.items);
  const totalSelected = groups.flatMap((g) => g.items).filter((i) => i.selected).length;
  const allSelected   = allFlatItems.length > 0 && allFlatItems.every((i) => i.selected);
  const someSelected  = allFlatItems.some((i) => i.selected);

  // Summary totals (computed from all groups, not filtered)
  const summary = useMemo(() => {
    const allItems = groups.flatMap((g) => g.items);
    const selectedItems = allItems.filter((i) => i.selected);
    const sum = (items) => items.reduce(
      (acc, item) => {
        const { amount, gstAmt, totalAmt } = itemAmounts(item);
        acc.amount   += amount;
        acc.gstAmt   += gstAmt;
        acc.totalAmt += totalAmt;
        return acc;
      },
      { amount: 0, gstAmt: 0, totalAmt: 0 },
    );
    return { all: sum(allItems), selected: sum(selectedItems) };
  }, [groups]);

  const fmt = (n) => inr(n);

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
      grnItemId:            row.grnItemId,
      grnId:                row.grnId,
      grnNo:                row.grnNo,
      grnDate:              row.grnDate,
      grnl:                 row.grnl,
      itemCode:             row.itemCode,
      itemName:             row.itemName,
      itemUnit:             row.itemUnit,
      note:                 row.note || "",
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
      (ex) => !formatted.some((f) => String(f.grnItemId) === String(ex.grnItemId))
    );
    form.setValue("items", [...nonSelected, ...formatted], { shouldValidate: true, shouldDirty: true });
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="w-[95vw] max-w-[95vw] lg:max-w-[1200px] p-0 gap-0 max-h-[95vh] flex flex-col">
        <DialogHeader className="px-6 py-3 border-b bg-slate-50">
          <DialogTitle className="text-[15px] font-semibold">Select GRN Items</DialogTitle>
        </DialogHeader>

        {/* Search + global select */}
        <div className="px-4 py-3 border-b bg-white flex items-center gap-4">
          <div className="relative w-full max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item, GRN No, location…"
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
                  <th className="border border-[#bbb] p-2 min-w-[80px]  text-left font-semibold">GRNL</th>
                  <th className="border border-[#bbb] p-2 min-w-[110px] text-left font-semibold">Item Code</th>
                  <th className="border border-[#bbb] p-2 min-w-[190px] text-left font-semibold">Item Name</th>
                  <th className="border border-[#bbb] p-2 min-w-[150px] text-left font-semibold">Note</th>
                  <th className="border border-[#bbb] p-2 min-w-[65px]  text-center font-semibold">Unit</th>
                  <th className="border border-[#bbb] p-2 min-w-[85px]  text-center font-semibold">Rcvd Qty</th>
                  <th className="border border-[#bbb] p-2 min-w-[75px]  text-center font-semibold">Rate</th>
                  <th className="border border-[#bbb] p-2 min-w-[90px]  text-center font-semibold">Amount</th>
                  <th className="border border-[#bbb] p-2 min-w-[65px]  text-center font-semibold">GST %</th>
                  <th className="border border-[#bbb] p-2 min-w-[90px]  text-center font-semibold">GST Amt</th>
                  <th className="border border-[#bbb] p-2 min-w-[95px]  text-center font-semibold">Total Amt</th>
                  <th className="border border-[#bbb] p-2 min-w-[140px] text-left font-semibold">Use Location</th>
                  <th className="border border-[#bbb] p-2 min-w-[140px] text-left font-semibold">Store Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((grn) => {
                  const groupAllSelected  = grn.items.every((i) => i.selected);
                  const groupSomeSelected = grn.items.some((i) => i.selected);
                  const groupChecked = groupAllSelected ? true : groupSomeSelected ? "indeterminate" : false;
                  return (
                    <React.Fragment key={`grn-group-${grn.grnId}`}>
                      {/* ── GRN parent header row ── */}
                      <tr key={`grn-hdr-${grn.grnId}`} className="bg-sky-100">
                        <td className="border border-[#bbb] p-2">
                          <div className="flex justify-center">
                            <div className="bg-white rounded p-[2px] shadow-sm">
                              <Checkbox
                                checked={groupChecked}
                                onCheckedChange={(c) => handleSelectGroup(grn.grnId, !!c)}
                              />
                            </div>
                          </div>
                        </td>
                        <td colSpan={13} className="border border-[#bbb] px-3 py-[6px]">
                          <div className="flex items-center gap-6 flex-wrap">
                            <span className="font-bold text-[13px] text-gray-800">
                              GRN No:&nbsp;
                              <span className="text-blue-700">{grn.grnNo}</span>
                            </span>
                            <span className="text-[12px] text-gray-600">
                              GRN Date:&nbsp;<span className="font-medium">{grn.grnDate}</span>
                            </span>
                            <span className="ml-auto text-[11px] text-gray-500">
                              {grn.items.filter((i) => i.selected).length} / {grn.items.length} selected
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* ── Child item rows ── */}
                      {grn.items.map((item) => {
                        const { amount, gstAmt, totalAmt } = itemAmounts(item);
                        return (
                          <tr
                            key={`item-${item.grnItemId}`}
                            className={item.selected ? "bg-blue-50" : "bg-white hover:bg-gray-50"}
                          >
                            <td className="border border-[#ddd] p-2 border-l-[3px] border-l-sky-300">
                              <div className="flex justify-center pl-2">
                                <Checkbox
                                  checked={item.selected}
                                  onCheckedChange={(c) => handleSelectItem(grn.grnId, item.grnItemId, !!c)}
                                />
                              </div>
                            </td>
                            <td className="border border-[#ddd] p-2 pl-7">{item.grnl}</td>
                            <td className="border border-[#ddd] p-2">{item.itemCode}</td>
                            <td className="border border-[#ddd] p-1">
                              <ExpandableTextField value={item.itemName || ""} disabled title="Item Name" minHeight="min-h-[30px]" modalHeight="min-h-[180px]" />
                            </td>
                            <td className="border border-[#ddd] p-1">
                              <ExpandableTextField value={item.note || ""} disabled title="Note" minHeight="min-h-[30px]" modalHeight="min-h-[180px]" />
                            </td>
                            <td className="border border-[#ddd] p-2 text-center">{item.itemUnit}</td>
                            <td className="border border-[#ddd] p-2 text-center font-medium">{item.receivedQty}</td>
                            <td className="border border-[#ddd] p-2 text-center">{item.rate}</td>
                            <td className="border border-[#ddd] p-2 text-center font-medium">
                              {inr(amount)}
                            </td>
                            <td className="border border-[#ddd] p-2 text-center">{item.gstPercent}</td>
                            <td className="border border-[#ddd] p-2 text-center font-medium">
                              {inr(gstAmt)}
                            </td>
                            <td className="border border-[#ddd] p-2 text-center font-medium">
                              {inr(totalAmt)}
                            </td>
                            <td className="border border-[#ddd] p-1">
                              <ExpandableTextField value={item.useLocation || ""} disabled title="Use Location" minHeight="min-h-[30px]" modalHeight="min-h-[180px]" />
                            </td>
                            <td className="border border-[#ddd] p-1">
                              <ExpandableTextField value={item.storeLocation || ""} disabled title="Store Location" minHeight="min-h-[30px]" modalHeight="min-h-[180px]" />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t px-6 py-3 bg-slate-50">
          {!loading && groups.length > 0 ? (
            <div className="flex items-center gap-5 text-[12px] text-gray-600">
              <span>Basic :&nbsp;<span className="font-semibold text-gray-900">{fmt(summary.selected.amount)}</span></span>
              <span className="text-gray-300">|</span>
              <span>GST :&nbsp;<span className="font-semibold text-gray-900">{fmt(summary.selected.gstAmt)}</span></span>
              <span className="text-gray-300">|</span>
              <span>Total :&nbsp;<span className="font-semibold text-blue-700">{fmt(summary.selected.totalAmt)}</span></span>
            </div>
          ) : <div />}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={totalSelected === 0}>
              <Check className="w-4 h-4 mr-1" />
              Add {totalSelected > 0 ? `${totalSelected} ` : ""}Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
