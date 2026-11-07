"use client";

/**
 * BrrPickerModal
 *
 * Picker modal for selecting a single BRR (Bill Receipt Record) to link
 * to a Purchase Bill. Styled to match CertifiedBillPickerModal (sale bill).
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

import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronDown, Loader2, Search, AlertCircle } from "lucide-react";
import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount }  from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

// ── Status badge ──────────────────────────────────────────────────────────────

function BrrStatusBadge({ status }) {
  const cfg = {
    Free:    "bg-green-100 text-green-700 border-green-300",
    Booked:  "bg-red-100   text-red-700   border-red-300",
    Pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  }[status] || "bg-gray-100 text-gray-600 border-gray-300";

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg}`}>
      {status}
    </span>
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
  const [orders,        setOrders]        = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError,   setOrdersError]   = useState(null);

  // expandedOrderId → BRR rows (fetched lazily)
  const [expandedId, setExpandedId] = useState(null);
  const [brrsMap,    setBrrsMap]    = useState({}); // { [orderId]: { loading, error, data[] } }

  // Single selected BRR
  const [selectedBrr,   setSelectedBrr]   = useState(null); // full BRR row + orderMeta
  const [selectedOrder, setSelectedOrder] = useState(null); // order metadata

  const [search, setSearch] = useState("");

  // ── Reset on open ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setExpandedId(null);
    setBrrsMap({});
    setSelectedBrr(null);
    setSelectedOrder(null);
  }, [isOpen]);

  // ── Fetch orders on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !vendorId || !projectCode) return;
    setOrdersLoading(true);
    setOrdersError(null);
    apiRequest({
      url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.VENDOR_ORDERS}?vendorId=${vendorId}&projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => setOrders(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setOrdersError(err.message || "Failed to load orders"))
      .finally(() => setOrdersLoading(false));
  }, [isOpen, vendorId, projectCode]);

  // ── Expand order and load its BRRs ─────────────────────────────────────────
  const handleExpandOrder = useCallback((order) => {
    const id = order.id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (brrsMap[id]) return; // already fetched

    setBrrsMap((prev) => ({ ...prev, [id]: { loading: true, error: null, data: [] } }));
    apiRequest({
      url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.BRR_LIST}?orderId=${id}&orderType=${order.orderType}&projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const brrs = Array.isArray(res.data) ? res.data : [];
        setBrrsMap((prev) => ({ ...prev, [id]: { loading: false, error: null, data: brrs } }));
      })
      .catch((err) => {
        setBrrsMap((prev) => ({
          ...prev,
          [id]: { loading: false, error: err.message || "Failed to load BRR list", data: [] },
        }));
      });
  }, [expandedId, brrsMap, projectCode]);

  // ── Select a BRR ───────────────────────────────────────────────────────────
  const handleSelectBrr = useCallback((order, brr) => {
    if (brr.billingStatus === "Booked") return; // blocked
    setSelectedOrder(order);
    setSelectedBrr(brr);
  }, []);

  // ── Confirm ─────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!selectedBrr || !selectedOrder) return;
    onConfirm({
      brrId:      selectedBrr.id,
      brrNo:      selectedBrr.brrNo,
      brrDate:    selectedBrr.brrDate,
      orderId:    selectedOrder.id,
      orderNo:    selectedOrder.orderNo,
      orderType:  selectedOrder.orderType,
      basicAmount: selectedBrr.basicAmount,
    });
    onClose();
  }, [selectedBrr, selectedOrder, onConfirm, onClose]);

  // ── Filtered orders ─────────────────────────────────────────────────────────
  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (o.orderNo  || "").toLowerCase().includes(q) ||
      (o.orderType || "").toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Select BRR</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Only one BRR can be linked per purchase bill.
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
              placeholder="Search by order number..."
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

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {ordersLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading Orders...
            </div>
          ) : ordersError ? (
            <div className="flex items-center gap-2 text-red-600 text-sm py-6">
              <AlertCircle className="h-4 w-4" />
              {ordersError}
            </div>
          ) : filteredOrders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">
              No approved orders found{search ? " matching your search" : " for this vendor"}.
            </p>
          ) : (
            <div className="space-y-1">
              {filteredOrders.map((order) => {
                const isExpanded = expandedId === order.id;
                const brrState   = brrsMap[order.id];
                const isActive   = selectedOrder?.id === order.id;

                return (
                  <div
                    key={order.id}
                    className={`border rounded-md overflow-hidden ${isActive ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}
                  >
                    {/* Order row */}
                    <button
                      type="button"
                      onClick={() => handleExpandOrder(order)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                      )}
                      <span className="text-[12px] font-semibold text-[#1c3a5e] min-w-[120px]">
                        {order.orderNo}
                      </span>
                      <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">
                        {order.orderType}
                      </span>
                      <span className="text-[11px] text-gray-400 truncate flex-1">
                        {order.orderDate ? getfmtDisplaydate(order.orderDate) : ""}
                      </span>
                    </button>

                    {/* BRR rows */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-white">
                        {brrState?.loading && (
                          <div className="flex items-center gap-2 px-6 py-3 text-gray-500 text-[12px]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading BRR list...
                          </div>
                        )}
                        {brrState?.error && (
                          <div className="flex items-center gap-2 px-6 py-3 text-red-600 text-[12px]">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {brrState.error}
                          </div>
                        )}
                        {!brrState?.loading && !brrState?.error && (brrState?.data || []).length === 0 && (
                          <p className="px-6 py-3 text-gray-400 text-[12px]">
                            No approved BRRs for this order.
                          </p>
                        )}
                        {(brrState?.data || []).map((brr) => {
                          const isBooked   = brr.billingStatus === "Booked";
                          const isSelected = selectedBrr?.id === brr.id;

                          return (
                            <button
                              key={brr.id}
                              type="button"
                              disabled={isBooked}
                              onClick={() => handleSelectBrr(order, brr)}
                              className={`w-full flex items-center gap-3 px-6 py-2 text-left border-t border-gray-100 transition
                                ${isBooked
                                  ? "opacity-50 cursor-not-allowed bg-gray-50"
                                  : isSelected
                                    ? "bg-blue-100 hover:bg-blue-100"
                                    : "hover:bg-gray-50"
                                }`}
                            >
                              {/* Radio indicator */}
                              <span className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center
                                ${isSelected ? "border-blue-500 bg-blue-500" : "border-gray-400 bg-white"}`}
                              >
                                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </span>

                              <span className="text-[12px] font-semibold text-[#1c3a5e] min-w-[110px]">
                                {brr.brrNo}
                              </span>
                              <span className="text-[11px] text-gray-500 min-w-[90px]">
                                {brr.brrDate ? getfmtDisplaydate(brr.brrDate) : "—"}
                              </span>
                              {brr.partyBillNo && (
                                <span className="text-[11px] text-gray-500 truncate flex-1">
                                  Bill: {brr.partyBillNo}
                                </span>
                              )}
                              <span className="text-[12px] font-semibold text-gray-700 ml-auto mr-3">
                                {formatAmount(brr.basicAmount)}
                              </span>
                              <BrrStatusBadge status={brr.billingStatus} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
          <p className="text-[12px] text-gray-500">
            {selectedBrr
              ? `BRR selected: ${selectedBrr.brrNo}`
              : "No BRR selected"}
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
  );
}
