"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { useColumnResize } from "@/hooks/useColumnResize";

const GRN_CATEGORIES = ["Purchases_Order", "Site_Transfer_Order", "Customer_Supply_Order"];

const fmt = (v) =>
  Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TH = ({ children, right = false }) => (
  <th className={`sticky top-0 z-10 bg-[#b7cfa5] border border-[#9e9e9e] px-2 py-1 text-[12px] font-semibold whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
    {children}
  </th>
);

const TD = ({ children, right = false, className = "" }) => (
  <td className={`border border-[#e6e4e4] px-2 py-1 text-[12px] ${right ? "text-right" : ""} ${className}`}>
    {children}
  </td>
);

export default function BRRSelector({ onSelect }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { tableRef } = useColumnResize();

  const projectCode = getLocalStorage("projectInfo")?.projectCode;

  useEffect(() => {
    if (!projectCode) {
      setLoading(false);
      return;
    }
    apiRequest({
      url: `${API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.LIST}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const eligible = (res.data || []).filter(
          (item) =>
            item.workflowStatus === "Approved" &&
            Number(item.bookedAmount ?? 0) < Number(item.totalAmount ?? 0)
        );
        setList(eligible);
      })
      .catch((err) => toast.error(err.message || "Failed to load BRR list"))
      .finally(() => setLoading(false));
  }, [projectCode]);

  const filtered = search
    ? list.filter((row) =>
        [row.brrNo, row.partyName, row.orderNo, row.orderCategory].some((v) =>
          String(v || "").toLowerCase().includes(search.toLowerCase())
        )
      )
    : list;

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-black mb-0.5">Select BRR for Billing</h2>
        <p className="text-[12px] text-gray-500">Showing approved BRRs with remaining billing amount</p>
      </div>

      <div className="mb-3 relative max-w-[320px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search BRR No., Party, Order..."
          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-sm text-[12px] outline-none focus:border-blue-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-16 text-[13px]">
          {list.length === 0
            ? "No eligible BRRs found (no approved BRRs with remaining billing amount)"
            : "No results match your search"}
        </div>
      ) : (
        <div className="border border-[#9e9e9e] overflow-x-auto">
          <table ref={tableRef} className="border-collapse text-[12px] min-w-[900px] w-full">
            <thead>
              <tr>
                <TH>BRR No.</TH>
                <TH>Party Name</TH>
                <TH>Order No.</TH>
                <TH>Order Category</TH>
                <TH>Type</TH>
                <TH right>Total Amount</TH>
                <TH right>Booked Amount</TH>
                <TH right>Remaining</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => {
                const billingType = GRN_CATEGORIES.includes(row.orderCategory) ? "grn" : "srn";
                const brrId = row.id ?? row.brrId;
                const total = Number(row.totalAmount || 0);
                const booked = Number(row.bookedAmount || 0);
                const remaining = total - booked;
                return (
                  <tr
                    key={brrId ?? idx}
                    onClick={() => onSelect(brrId, billingType)}
                    className={`cursor-pointer ${idx % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"} hover:bg-blue-50 transition-colors`}
                  >
                    <TD className="text-blue-600 font-medium">{row.brrNo}</TD>
                    <TD>{row.partyName}</TD>
                    <TD>{row.orderNo}</TD>
                    <TD>{row.orderCategory?.replace(/_/g, " ")}</TD>
                    <TD>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${billingType === "grn" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {billingType === "grn" ? "GRN" : "SRN"}
                      </span>
                    </TD>
                    <TD right>{fmt(total)}</TD>
                    <TD right>{fmt(booked)}</TD>
                    <TD right className="text-green-700 font-medium">{fmt(remaining)}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
