"use client";

/**
 * BrrPickerModal
 *
 * Flat-list BRR picker — single API call, shows only Free/Pending BRRs
 * (approved BRRs that still have unbilled amount).
 *
 * Props
 *   isOpen        bool
 *   onClose       () => void
 *   vendorId      number
 *   projectCode   string
 *   currentBrrId  number|null  — pre-selected BRR id (edit mode)
 *   onConfirm     (brrData) => void
 *     brrData: { brrId, brrNo, brrDate, orderId, orderNo, orderType, basicAmount }
 */

import { useState, useEffect, useMemo } from "react";
import { X, Loader2, Search, AlertCircle } from "lucide-react";
import { apiRequest }       from "@/lib/apiClient";
import { API_ENDPOINTS }    from "@/config/api.config";
import { formatAmount }     from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_TOOLTIP = {
  Free:    "No purchase bill linked — fully available to bill",
  Pending: "A draft/pending purchase bill exists — can still be selected",
};

function BrrStatusBadge({ status }) {
  const cfg = {
    Free:    "bg-green-100 text-green-700 border-green-300",
    Pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  }[status] || "bg-gray-100 text-gray-600 border-gray-300";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border cursor-help ${cfg}`}>
          {status}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" variant="text">
        {STATUS_TOOLTIP[status] || status}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BrrPickerModal({
  isOpen,
  onClose,
  vendorId,
  projectCode,
  currentBrrId = null,
  onConfirm,
}) {
  const [brrs,        setBrrs]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [selectedId,  setSelectedId]  = useState(null);
  const [search,      setSearch]      = useState("");

  // ── Reset + fetch on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setSelectedId(currentBrrId || null);
    setBrrs([]);
    if (!vendorId || !projectCode) return;

    setLoading(true);
    setError(null);
    apiRequest({
      url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.AVAILABLE_BRRS}?vendorId=${vendorId}&projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => setBrrs(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.message || "Failed to load BRR list"))
      .finally(() => setLoading(false));
  }, [isOpen, vendorId, projectCode, currentBrrId]);

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return brrs;
    const q = search.toLowerCase();
    return brrs.filter(
      (b) =>
        (b.brrNo       || "").toLowerCase().includes(q) ||
        (b.orderNo     || "").toLowerCase().includes(q) ||
        (b.partyBillNo || "").toLowerCase().includes(q),
    );
  }, [brrs, search]);

  const selectedBrr = brrs.find((b) => b.id === selectedId) || null;

  // ── Confirm ─────────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!selectedBrr) return;
    onConfirm({
      brrId:       selectedBrr.id,
      brrNo:       selectedBrr.brrNo,
      brrDate:     selectedBrr.brrDate,
      orderId:     null,
      orderNo:     selectedBrr.orderNo,
      orderType:   selectedBrr.orderType,
      basicAmount: selectedBrr.basicAmount,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <TooltipProvider>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Select BRR</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Showing only BRRs with no active purchase bill (Draft/Submitted also excluded).
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by BRR No, Order No, or Customer Bill No..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Selected badge */}
        {selectedBrr && (
          <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 shrink-0 flex items-center gap-2 text-[12px]">
            <span className="text-blue-700">
              Selected: <strong>{selectedBrr.brrNo}</strong>
              {selectedBrr.brrDate ? ` — ${getfmtDisplaydate(selectedBrr.brrDate)}` : ""}
              <span className="ml-2 text-gray-500">({formatAmount(selectedBrr.basicAmount)})</span>
            </span>
          </div>
        )}

        {/* Table body */}
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-14 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading BRR list...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-600 text-sm py-8 px-5">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px] min-w-[640px]">
              <thead className="sticky top-0 z-10 bg-[#1c3a5e] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold w-[30px]"></th>
                  <th className="px-3 py-2 text-left font-semibold">Order No</th>
                  <th className="px-3 py-2 text-left font-semibold w-[55px]">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">BRR ERP No</th>
                  <th className="px-3 py-2 text-left font-semibold">Customer Bill No</th>
                  <th className="px-3 py-2 text-left font-semibold w-[90px]">Date</th>
                  <th className="px-3 py-2 text-right font-semibold w-[90px]">Amount</th>
                  <th className="px-3 py-2 text-center font-semibold w-[75px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-gray-400 text-[12px] italic"
                    >
                      {search
                        ? "No BRRs match your search."
                        : "No available BRRs found for this vendor."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((brr, idx) => {
                    const isSelected = brr.id === selectedId;
                    return (
                      <tr
                        key={brr.id}
                        onClick={() => setSelectedId(brr.id)}
                        className={`cursor-pointer border-b border-gray-100 transition
                          ${isSelected
                            ? "bg-blue-50 border-blue-200"
                            : idx % 2 === 0
                              ? "bg-white hover:bg-gray-50"
                              : "bg-[#f7f9fc] hover:bg-gray-100"
                          }`}
                      >
                        {/* Radio */}
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-flex h-3.5 w-3.5 rounded-full border-2 items-center justify-center
                              ${isSelected ? "border-blue-500 bg-blue-500" : "border-gray-400 bg-white"}`}
                          >
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                        </td>

                        <td className="px-3 py-2 font-semibold text-[#1c3a5e]">
                          {brr.orderNo || "—"}
                        </td>

                        <td className="px-3 py-2">
                          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {brr.orderType}
                          </span>
                        </td>

                        <td className="px-3 py-2 font-semibold text-gray-800">
                          {brr.brrNo}
                        </td>

                        <td className="px-3 py-2 text-gray-600">
                          {brr.partyBillNo || "—"}
                        </td>

                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {brr.brrDate ? getfmtDisplaydate(brr.brrDate) : "—"}
                        </td>

                        <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                          {formatAmount(brr.basicAmount)}
                        </td>

                        <td className="px-3 py-2 text-center">
                          <BrrStatusBadge status={brr.billingStatus} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
          <p className="text-[12px] text-gray-500">
            {selectedBrr
              ? `BRR selected: ${selectedBrr.brrNo} — ${formatAmount(selectedBrr.basicAmount)}`
              : `${filtered.length} BRR${filtered.length !== 1 ? "s" : ""} available`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-[13px] text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedBrr}
              className="px-4 py-1.5 text-[13px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Confirm
            </button>
          </div>
        </div>

      </div>
    </div>
    </TooltipProvider>
  );
}
