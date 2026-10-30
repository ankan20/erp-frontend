"use client";

import { useState } from "react";
import { Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MOCK_GRNS } from "../mockData";

export default function GRNSelectModal({ open, onClose, onSelect }) {
  const [search, setSearch] = useState("");
  const [expandedGrn, setExpandedGrn] = useState(null);
  const [selectedGrn, setSelectedGrn] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const filtered = MOCK_GRNS.filter((g) => {
    const q = search.toLowerCase();
    return (
      g.grnNo.toLowerCase().includes(q) ||
      g.partyName.toLowerCase().includes(q) ||
      g.receivedCategory.toLowerCase().includes(q)
    );
  });

  const handleConfirm = () => {
    if (!selectedGrn || !selectedItem) return;
    onSelect({ grn: selectedGrn, item: selectedItem });
    onClose();
    setSearch("");
    setSelectedGrn(null);
    setSelectedItem(null);
    setExpandedGrn(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[680px] p-0 flex flex-col gap-0 max-h-[85dvh]">
        {/* Header */}
        <div className="px-5 py-3 border-b bg-[#e8f2ff] flex items-center justify-between shrink-0">
          <DialogTitle className="text-[17px] font-semibold">Select GRN & Item</DialogTitle>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by GRN No, Party Name, Category..."
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

        {/* GRN List */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-center text-gray-400 py-8">No GRNs found</p>
          )}
          {filtered.map((grn) => {
            const isExpanded = expandedGrn === grn.id;
            return (
              <div key={grn.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* GRN row */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 hover:bg-blue-50 cursor-pointer select-none"
                  onClick={() => setExpandedGrn(isExpanded ? null : grn.id)}
                >
                  <button className="text-gray-500 shrink-0">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-blue-700">{grn.grnNo}</span>
                      <span className="text-xs text-gray-500">{grn.grnDate}</span>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{grn.receivedCategory}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{grn.partyName} · {grn.orderNo}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{grn.items.length} item{grn.items.length > 1 ? "s" : ""}</span>
                </div>

                {/* Items */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {grn.items.map((item) => {
                      const isSelected = selectedGrn?.id === grn.id && selectedItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? "bg-blue-100" : ""}`}
                          onClick={() => { setSelectedGrn(grn); setSelectedItem(item); }}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"}`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-gray-700">{item.itemCode}</span>
                              <span className="text-sm text-gray-800">{item.itemName}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                              <span>Qty: <strong>{item.qty} {item.unit}</strong></span>
                              <span>Rate: ₹{item.rate.toLocaleString("en-IN")}</span>
                              <span>GST: {item.gstPct}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-600">
            {selectedItem
              ? <span>Selected: <strong className="text-blue-700">{selectedGrn?.grnNo}</strong> → {selectedItem.itemName}</span>
              : <span className="text-gray-400">Select a GRN and item above</span>
            }
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedGrn || !selectedItem}
              className="px-4 py-1.5 text-sm bg-[#144664] text-white rounded-md hover:bg-[#1c5a7a] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Select
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
