"use client";

/**
 * CertifiedBillPickerModal
 *
 * ERP modal for selecting Certified Bills to include in a Sale Invoice.
 *
 * Rules enforced:
 *  - Only Approved OG Sale Orders are shown.
 *  - Multiple Certified Bills may be selected, but only from ONE Sale Order.
 *  - Switching to a different Sale Order requires confirming the existing selection is cleared.
 *  - Individual item selection inside a bill is NOT allowed here.
 *
 * Props
 *   isOpen          bool
 *   onClose         () => void
 *   projectCode     string
 *   currentSources  []  — existing selection (for pre-check on edit)
 *   onConfirm       (sources[]) => void
 *   saleBillId      number|null  — current invoice id when editing
 */

import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronDown, Loader2, Search, CheckSquare, Square, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

export default function CertifiedBillPickerModal({
  isOpen,
  onClose,
  projectCode,
  currentSources = [],
  onConfirm,
  saleBillId = null,
}) {
  const [orders,       setOrders]       = useState([]);  // each order has .certifiedBills[]
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError,  setOrdersError]  = useState(null);

  const [expandedId,   setExpandedId]   = useState(null);

  // Controlled selection
  const [selectedOrderMeta, setSelectedOrderMeta] = useState(null);
  const [selectedBillIds,   setSelectedBillIds]   = useState(new Set());

  // Confirm dialog when user tries to switch sale orders
  const [pendingSwitch, setPendingSwitch] = useState(null);

  const [search, setSearch] = useState("");

  // ── Restore existing selection on open ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen || currentSources.length === 0) return;
    const first = currentSources[0];
    setSelectedOrderMeta({
      id:                     first.saleOrderId,
      orderNo:                first.saleOrderNo,
      erpNo:                  first.saleOrderErpNo || "",
      debtorName:             first.debtorName || "",
      debtorCorporateAddress: first.debtorCorporateAddress || "",
    });
    setSelectedBillIds(new Set(currentSources.map((s) => s.certifiedBillId)));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Single API: fetch orders + their pending bills ────────────────────────────
  useEffect(() => {
    if (!isOpen || !projectCode) return;
    setOrdersLoading(true);
    setOrdersError(null);
    let url = `${API_ENDPOINTS.FINANCE.SALE_BILL.ORDERS_WITH_PENDING_BILLS}?projectCode=${projectCode}`;
    if (saleBillId) url += `&excludeSaleBillId=${saleBillId}`;
    apiRequest({ url, method: "GET" })
      .then((res) => setOrders(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setOrdersError(err.message || "Failed to load Sale Orders"))
      .finally(() => setOrdersLoading(false));
  }, [isOpen, projectCode, saleBillId]);

  // ── Reset local state when closed ────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setSearch("");
    setPendingSwitch(null);
    onClose();
  }, [onClose]);

  // ── Expand / collapse order ──────────────────────────────────────────────────
  const handleExpandOrder = useCallback((order) => {
    setExpandedId((prev) => (prev === order.id ? null : order.id));
  }, []);

  // ── Select all bills for an order ────────────────────────────────────────────
  const handleSelectAllBills = useCallback((order, e) => {
    e.stopPropagation();
    const bills = order.certifiedBills || [];
    if (bills.length === 0) return;

    if (selectedOrderMeta && selectedOrderMeta.id !== order.id && selectedBillIds.size > 0) {
      setPendingSwitch({ order, bill: null, selectAll: true, bills });
      return;
    }

    setSelectedOrderMeta({
      id:                     order.id,
      orderNo:                order.orderNo,
      erpNo:                  order.erpDocNumber,
      debtorName:             order.debtorName || "",
      debtorCorporateAddress: order.debtorCorporateAddress || "",
    });

    setSelectedBillIds((prev) => {
      const allIds = new Set(bills.map((b) => b.id));
      const allSelected = bills.length > 0 && bills.every((b) => prev.has(b.id));
      if (allSelected) {
        setSelectedOrderMeta(null);
        return new Set();
      }
      return allIds;
    });
  }, [selectedOrderMeta, selectedBillIds]);

  // ── Toggle a certified bill checkbox ──────────────────────────────────────────
  const handleToggleBill = useCallback((order, bill) => {
    // Block selecting fully-billed bills, but allow deselecting them
    if (Number(bill.remaining) <= 0 && !selectedBillIds.has(bill.id)) return;

    // If selecting from a different sale order than currently selected
    if (selectedOrderMeta && selectedOrderMeta.id !== order.id && selectedBillIds.size > 0) {
      setPendingSwitch({ order, bill });
      return;
    }

    setSelectedOrderMeta({
      id:                     order.id,
      orderNo:                order.orderNo,
      erpNo:                  order.erpDocNumber,
      debtorName:             order.debtorName || "",
      debtorCorporateAddress: order.debtorCorporateAddress || "",
    });

    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(bill.id)) {
        next.delete(bill.id);
      } else {
        next.add(bill.id);
      }
      // If all unchecked, clear the order meta too
      if (next.size === 0) setSelectedOrderMeta(null);
      return next;
    });
  }, [selectedOrderMeta, selectedBillIds]);

  // ── Confirm switch order ───────────────────────────────────────────────────────
  const handleConfirmSwitch = useCallback(() => {
    if (!pendingSwitch) return;
    const { order, bill, selectAll, bills } = pendingSwitch;
    setSelectedOrderMeta({
      id:                     order.id,
      orderNo:                order.orderNo,
      erpNo:                  order.erpDocNumber,
      debtorName:             order.debtorName || "",
      debtorCorporateAddress: order.debtorCorporateAddress || "",
    });
    if (selectAll && bills?.length > 0) {
      setSelectedBillIds(new Set(bills.map((b) => b.id)));
    } else {
      setSelectedBillIds(new Set([bill.id]));
    }
    setPendingSwitch(null);
  }, [pendingSwitch]);

  // ── Confirm selection ──────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!selectedOrderMeta || selectedBillIds.size === 0) return;
    const order = orders.find((o) => o.id === selectedOrderMeta.id);
    const orderBills = order?.certifiedBills || [];
    const sources = [...selectedBillIds]
      .map((billId) => {
        const b = orderBills.find((x) => x.id === billId);
        if (!b) {
          const existing = currentSources.find((s) => s.certifiedBillId === billId);
          if (existing) return existing;
          return null;
        }
        return {
          saleOrderId:            selectedOrderMeta.id,
          saleOrderNo:            selectedOrderMeta.orderNo,
          saleOrderErpNo:         selectedOrderMeta.erpNo,
          debtorName:             selectedOrderMeta.debtorName,
          debtorCorporateAddress: selectedOrderMeta.debtorCorporateAddress || "",
          certifiedBillId:        b.id,
          certifiedBillNo:  b.billingNo,
          billingDate:      b.billingDate,
          basicAmount:      Number(b.remaining) || 0,
        };
      })
      .filter(Boolean);

    onConfirm(sources);
    handleClose();
  }, [selectedOrderMeta, selectedBillIds, orders, currentSources, onConfirm, handleClose]);

  // ── Filtered orders ────────────────────────────────────────────────────────────
  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (o.erpDocNumber || "").toLowerCase().includes(q) ||
      (o.orderNo      || "").toLowerCase().includes(q) ||
      (o.orderTitle   || "").toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <Overlay onClose={handleClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Select Certified Bills</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Only bills from one Sale Order can be selected per invoice.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
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
              placeholder="Search by ERP No or Order No..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Selected order badge */}
        {selectedOrderMeta && (
          <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 shrink-0 flex items-center gap-2 text-[12px]">
            <CheckSquare className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="text-blue-700">
              <strong>{selectedBillIds.size}</strong> bill{selectedBillIds.size !== 1 ? "s" : ""} selected from{" "}
              <strong>{selectedOrderMeta.erpNo || selectedOrderMeta.orderNo}</strong>
              {selectedOrderMeta.debtorName ? ` — ${selectedOrderMeta.debtorName}` : ""}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {ordersLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading Sale Orders...
            </div>
          ) : ordersError ? (
            <div className="flex items-center gap-2 text-red-600 text-sm py-6">
              <AlertCircle className="h-4 w-4" />
              {ordersError}
            </div>
          ) : filteredOrders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">
              No approved Sale Orders found{search ? " matching your search" : " for this project"}.
            </p>
          ) : (
            <div className="space-y-1">
              {filteredOrders.map((order) => {
                const isExpanded    = expandedId === order.id;
                const bills         = order.certifiedBills || [];
                const isActiveSO    = selectedOrderMeta?.id === order.id;
                const isDifferentSO = selectedOrderMeta && selectedOrderMeta.id !== order.id && selectedBillIds.size > 0;
                const allSelected   = isActiveSO && bills.length > 0 && bills.every((b) => selectedBillIds.has(b.id));

                return (
                  <div
                    key={order.id}
                    className={`border rounded-md overflow-hidden ${isActiveSO ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}
                  >
                    {/* Order row */}
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleExpandOrder(order)}
                        className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                        )}
                        <span className="text-[12px] font-semibold text-[#1c3a5e] min-w-[100px]">
                          {order.erpDocNumber}
                        </span>
                        <span className="text-[12px] text-gray-600 mr-2">
                          {order.orderNo ? `| ${order.orderNo}` : ""}
                        </span>
                        <span className="text-[11px] text-gray-400 truncate flex-1">
                          {order.orderTitle}
                        </span>
                        {order.debtorName && (
                          <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">
                            {order.debtorName}
                          </span>
                        )}
                        {isDifferentSO && (
                          <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded shrink-0">
                            different order
                          </span>
                        )}
                      </button>
                      {bills.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => handleSelectAllBills(order, e)}
                          title="Select / deselect all bills in this order"
                          className={`mx-2 px-2 py-1 text-[10px] font-medium rounded border transition shrink-0 ${
                            allSelected
                              ? "bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200"
                              : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {allSelected ? "Deselect All" : "Select All"}
                        </button>
                      )}
                    </div>

                    {/* Certified Bills */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-white">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="pl-6 pr-2 py-1.5 text-left font-semibold text-gray-600 w-8"></th>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Bill No</th>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Date</th>
                              <th className="px-2 py-1.5 text-right font-semibold text-gray-600">Bill Amount</th>
                              <th className="px-2 py-1.5 text-right font-semibold text-gray-600">Already Billed</th>
                              <th className="px-2 py-1.5 text-right font-semibold text-gray-600">Remaining</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bills
                              .sort((a, b) => (b.billingDate || "").localeCompare(a.billingDate || ""))
                              .map((bill) => {
                              const isChecked = selectedBillIds.has(bill.id);
                              return (
                                <tr
                                  key={bill.id}
                                  className={`border-b border-gray-100 transition cursor-pointer hover:bg-blue-50 ${isChecked ? "bg-blue-50" : ""}`}
                                  onClick={() => handleToggleBill(order, bill)}
                                >
                                  <td className="pl-6 pr-2 py-1.5 w-8">
                                    {isChecked ? (
                                      <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                                    ) : (
                                      <Square className="h-3.5 w-3.5 text-gray-400" />
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 font-medium text-[#1c3a5e]">
                                    {bill.billingNo}
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-500">
                                    {getfmtDisplaydate(bill.billingDate) || "—"}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-semibold text-gray-700">
                                    {formatAmount(bill.thisBillClaim)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-orange-600 font-semibold">
                                    {formatAmount(bill.alreadyBilled)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-semibold text-green-700">
                                    {formatAmount(bill.remaining)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 shrink-0">
          <span className="text-[12px] text-gray-500">
            {selectedBillIds.size > 0
              ? `${selectedBillIds.size} bill${selectedBillIds.size !== 1 ? "s" : ""} selected`
              : "No bills selected"}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedBillIds.size === 0}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>

      {/* Switch-order confirmation dialog */}
      {pendingSwitch && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Switch Sale Order?</p>
                <p className="text-sm text-gray-600 mt-1">
                  This will clear{" "}
                  <strong>
                    {selectedBillIds.size} selected bill{selectedBillIds.size !== 1 ? "s" : ""}
                  </strong>{" "}
                  from{" "}
                  <strong>
                    {selectedOrderMeta?.erpNo || selectedOrderMeta?.orderNo}
                  </strong>
                  . You can only invoice bills from one Sale Order at a time.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingSwitch(null)}
                className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-medium transition"
              >
                Keep Current
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitch}
                className="px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium transition"
              >
                Switch &amp; Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}
