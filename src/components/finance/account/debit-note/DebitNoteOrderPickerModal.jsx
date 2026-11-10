"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { ACC } from "@/components/finance/account/common/accountTheme";

/**
 * DebitNoteOrderPickerModal
 * Shows approved material orders for the project.
 * On select: returns { orderId, orderNo, orderDate, vendorId, vendorName, vendorGstin, partyBillNo, partyDate }
 */
export default function DebitNoteOrderPickerModal({ open, onClose, onSelect, projectCode }) {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState("");
  const [selected, setSelected] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open || !projectCode) return;
    setSearch("");
    setSelected(null);
    setLoading(true);
    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.DEBIT_NOTE.ORDER_PICKER}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((r) => setOrders(r.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [open, projectCode]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 80);
  }, [open]);

  if (!open) return null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? orders.filter(
        (o) =>
          o.orderNo?.toLowerCase().includes(q) ||
          o.vendorName?.toLowerCase().includes(q) ||
          o.category?.toLowerCase().includes(q) ||
          o.partyBillNo?.toLowerCase().includes(q),
      )
    : orders;

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-md shadow-2xl w-[820px] max-w-[96vw] flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${ACC.basicHeader} rounded-t-md`}>
          <span className={`font-semibold text-[13px] ${ACC.sectionTitle}`}>Select Order</span>
          <button type="button" onClick={onClose} className="text-[#888] hover:text-[#333]">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order no, vendor, category, bill no…"
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-sm outline-none focus:border-[#3b6ea5]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-[11px] min-w-[700px]">
            <thead className="sticky top-0 z-10">
              <tr className={ACC.tableHead}>
                <th className="border border-[#b0b0b0] px-2 py-1.5 w-[32px]" />
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[110px]">Order No</th>
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">Date</th>
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold">Category</th>
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold">Vendor</th>
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[120px]">Party Bill No</th>
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">Bill Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    <Loader2 className="inline animate-spin w-4 h-4 mr-1" />Loading orders…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#bbb] italic">
                    {q ? "No matching orders" : "No approved orders found"}
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const isSelected = selected?.orderId === o.orderId;
                  return (
                    <tr
                      key={o.orderId}
                      onClick={() => setSelected(o)}
                      className={`cursor-pointer transition ${
                        isSelected ? "bg-[#e8f0fa]" : "hover:bg-[#f5f8ff]"
                      }`}
                    >
                      <td className="border border-[#e0e0e0] px-2 py-1.5 text-center">
                        {isSelected
                          ? <CheckCircle2 size={13} className="text-[#3b6ea5] mx-auto" />
                          : <div className="w-3 h-3 rounded-full border border-gray-300 mx-auto" />
                        }
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1.5 font-semibold text-[#1c3a5e]">{o.orderNo}</td>
                      <td className="border border-[#e0e0e0] px-2 py-1.5 text-gray-600">{o.orderDate || "—"}</td>
                      <td className="border border-[#e0e0e0] px-2 py-1.5 text-gray-700">{o.category || "—"}</td>
                      <td className="border border-[#e0e0e0] px-2 py-1.5 text-gray-700">{o.vendorName || "—"}</td>
                      <td className="border border-[#e0e0e0] px-2 py-1.5 text-gray-700">{o.partyBillNo || <span className="text-[#bbb] italic">—</span>}</td>
                      <td className="border border-[#e0e0e0] px-2 py-1.5 text-gray-600">{o.partyDate || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <span className="text-[11px] text-gray-400">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""}
            {selected ? ` — selected: ${selected.orderNo}` : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-[12px] border border-gray-300 rounded hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selected}
              className="px-5 py-1.5 text-[12px] bg-[#3b6ea5] text-white rounded hover:brightness-110 disabled:opacity-40 transition"
            >
              Select
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
