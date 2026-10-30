"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getAvailableAssets } from "../../shared/mockAssets";
import { AmStatusBadge, AssetPickerRow } from "../../shared/AmFormHelpers";

export default function AssetPickerModal({ open, onClose, onSelect, excludeStatuses }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const assets = getAvailableAssets(excludeStatuses || ["disposed"]);
  const filtered = assets.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.assetId.toLowerCase().includes(q) ||
      a.assetName.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q)
    );
  });

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
    onClose();
    setSearch("");
    setSelected(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[620px] p-0 flex flex-col gap-0 max-h-[85dvh]">
        <div className="px-5 py-3 border-b bg-[#e8f2ff] shrink-0">
          <DialogTitle className="text-[17px] font-semibold">Select Asset</DialogTitle>
        </div>
        <div className="px-4 py-3 border-b shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Asset ID, Name, Category, Location..."
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-md outline-none focus:border-blue-400"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 && <p className="text-sm text-center text-gray-400 py-10">No assets found</p>}
          {filtered.map((a) => (
            <AssetPickerRow
              key={a.id}
              asset={a}
              selected={selected?.id === a.id}
              onClick={() => setSelected(a)}
            />
          ))}
        </div>
        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between shrink-0">
          <span className="text-sm text-gray-500">
            {selected ? <span>Selected: <strong className="text-blue-700">{selected.assetId}</strong> — {selected.assetName}</span> : "Select an asset above"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 cursor-pointer">Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={!selected}
              className="px-4 py-1.5 text-sm bg-[#144664] text-white rounded hover:bg-[#1c5a7a] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Select
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
