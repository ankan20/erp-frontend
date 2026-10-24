"use client";

import { useEffect, useState } from "react";
import { X, Package, ArrowDownCircle, ArrowUpCircle, FileDown } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useColumnResize } from "@/hooks/useColumnResize";

function downloadExcel(rows, item) {
  import("xlsx").then((XLSX) => {
    const sheetData = [
      ["#", "Date", "Type", "Reference No", "Rate (₹)", "GRN Qty", "GIN Qty", "Bal Qty", "Amount (₹)", "Bal Amt (₹)", "Store Location", "Used To"],
      ...rows.map((r, i) => [
        i + 1,
        r.date,
        r.type,
        r.no,
        r.rate,
        r.qtyIn > 0 ? r.qtyIn : "",
        r.qtyOut > 0 ? r.qtyOut : "",
        r.balQty,
        r.type === "GRN" ? r.amount : -r.amount,
        r.balAmt,
        r.storeLocation ?? "",
        r.useLocation ?? "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Ledger");
    XLSX.writeFile(wb, `Stock_Ledger_${item?.itemCode || "export"}.xlsx`);
  });
}


const ENTRIES_LIMIT = 500;

export default function StockItemDetailModal({ item, projectCode, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // ─── LEDGER FILTERS
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo]     = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [ledgerPage, setLedgerPage] = useState(1);
  const { tableRef } = useColumnResize();

  const doFetch = async ({ from = "", to = "", page = 1, isInitial = false } = {}) => {
    isInitial ? setLoading(true) : setLedgerLoading(true);
    try {
      let url = `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.STOCK.ITEM_DETAIL}?project_code=${projectCode}&item_code=${item.itemCode}&is_asset=${item.isAsset ?? false}&entries_limit=${ENTRIES_LIMIT}&grn_page=${page}&gin_page=${page}`;
      if (from) url += `&from_date=${from}`;
      if (to)   url += `&to_date=${to}`;
      const res = await apiRequest({ url, method: "GET" });
      setDetail(res.data);
    } catch {
      toast.error("Failed to fetch item detail");
    } finally {
      setLoading(false);
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (!item || !projectCode) return;
    doFetch({ isInitial: true });
  }, [item, projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when date filters change — reset to page 1
  useEffect(() => {
    if (!item || !projectCode || loading) return;
    setLedgerPage(1);
    doFetch({ from: filterFrom, to: filterTo, page: 1 });
  }, [filterFrom, filterTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when page changes
  useEffect(() => {
    if (!item || !projectCode || loading) return;
    doFetch({ from: filterFrom, to: filterTo, page: ledgerPage });
  }, [ledgerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDate = (d) => {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const fmtNum = (n) =>
    n === null || n === undefined
      ? "-"
      : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-b from-[#f4f4f4] to-[#e3e3e3] border-b border-[#c4d1df]">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Item Detail</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {item?.itemCode} — {item?.itemName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-[#4d8ea3]" size={28} />
          </div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center py-12 text-sm text-gray-400">
            No detail available
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard label="Unit" value={detail.summary.unit || "-"} icon={<Package size={14} />} />
              <SummaryCard label="Total Received" value={`${fmtNum(detail.summary.totalReceivedQty)} ${detail.summary.unit || ""}`} sub={`₹ ${fmtNum(detail.summary.totalReceivedAmount)}`} color="text-green-700" />
              <SummaryCard label="Total Issued" value={`${fmtNum(detail.summary.totalIssuedQty)} ${detail.summary.unit || ""}`} sub={`₹ ${fmtNum(detail.summary.totalIssuedAmount)}`} color="text-red-600" />
              <SummaryCard label="Stock" value={`${fmtNum(detail.summary.stockQty)} ${detail.summary.unit || ""}`} sub={`₹ ${fmtNum(detail.summary.stockAmount)}`} color="text-blue-700" highlight />
            </div>

            {/* DATE-WISE LEDGER */}
            {(() => {
              // Merge GRN and GIN into a single chronological ledger
              const grns = (detail.grnEntries?.entries || []).map((g) => ({
                date: g.grnDate, no: g.grnNo, type: "GRN",
                qtyIn: g.receivedQty, qtyOut: 0, rate: g.rate, amount: g.amount,
                storeLocation: g.storeLocation ?? null, useLocation: null,
              }));
              const gins = (detail.ginEntries?.entries || []).map((g) => ({
                date: g.ginDate, no: g.ginNo, type: "GIN",
                qtyIn: 0, qtyOut: g.issuedQty, rate: g.rate, amount: g.amount,
                storeLocation: null, useLocation: g.useLocation ?? null,
              }));
              const ledger = [...grns, ...gins].sort((a, b) => new Date(a.date) - new Date(b.date));

              // Compute running balance on the API-returned ledger (date-filtered by server)
              let runQty = 0, runAmt = 0;
              const allRows = ledger.map((e) => {
                runQty += e.qtyIn - e.qtyOut;
                runAmt += e.type === "GRN" ? e.amount : -e.amount;
                return { ...e, balQty: runQty, balAmt: runAmt };
              });

              // Apply only type filter client-side (date filter is handled by API)
              const rows = typeFilter === "ALL"
                ? allRows
                : allRows.filter((r) => r.type === typeFilter);

              const hasActiveFilter = typeFilter !== "ALL" || filterFrom || filterTo;

              // Pagination — use whichever side has more pages
              const grnTotalPages = detail.grnEntries?.totalPages ?? 1;
              const ginTotalPages = detail.ginEntries?.totalPages ?? 1;
              const totalLedgerPages = Math.max(grnTotalPages, ginTotalPages);
              const totalEntries = (detail.grnEntries?.total ?? 0) + (detail.ginEntries?.total ?? 0);

              return (
                <div className="space-y-2">
                {/* LEDGER FILTERS */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Date range */}
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-xs rounded-sm whitespace-nowrap">From</span>
                    <input type="date" value={filterFrom} disabled={ledgerLoading} onChange={(e) => setFilterFrom(e.target.value)}
                      className="h-6.5 w-34 border border-[#8f8f8f] px-2 text-xs rounded-sm outline-none disabled:opacity-50" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-xs rounded-sm whitespace-nowrap">To</span>
                    <input type="date" value={filterTo} disabled={ledgerLoading} onChange={(e) => setFilterTo(e.target.value)}
                      className="h-6.5 w-34 border border-[#8f8f8f] px-2 text-xs rounded-sm outline-none disabled:opacity-50" />
                  </div>

                  {/* Type toggle + Excel download */}
                  <div className="flex items-center rounded-sm border border-[#8f8f8f] overflow-hidden text-xs">
                    {["ALL", "GRN", "GIN"].map((t) => (
                      <button key={t} onClick={() => setTypeFilter(t)}
                        className={`px-3 py-0.5 transition cursor-pointer ${
                          typeFilter === t
                            ? t === "GRN" ? "bg-green-600 text-white" : t === "GIN" ? "bg-red-500 text-white" : "bg-[#7fc3d4] text-black font-semibold"
                            : "bg-white text-gray-600 hover:bg-gray-100"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => downloadExcel(rows, item)}
                    title="Download visible rows as Excel"
                    className="flex items-center gap-1 px-2 py-0.5 border border-[#4d8ea3] rounded-sm bg-white hover:bg-[#eef6fa] text-[#4d8ea3] transition text-xs cursor-pointer"
                  >
                    <FileDown size={13} />
                    Excel
                  </button>

                  {/* Clear */}
                  {hasActiveFilter && (
                    <button onClick={() => { setFilterFrom(""); setFilterTo(""); setTypeFilter("ALL"); setLedgerPage(1); }}
                      className="text-xs text-blue-500 hover:text-blue-700 underline">
                      Clear filters
                    </button>
                  )}

                  <span className="ml-auto text-xs text-gray-400">
                    {rows.length} of {totalEntries} entries
                  </span>
                </div>

                <div className="border border-[#9e9e9e] overflow-x-auto relative">
                  {ledgerLoading && (
                    <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center">
                      <Loader2 className="animate-spin w-5 h-5 text-[#4d8ea3]" />
                    </div>
                  )}
                  <table ref={tableRef} className="w-full min-w-max border-collapse text-xs">
                    <thead className="bg-[#b7cfa5] sticky top-0 z-10">
                      <tr>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-left font-semibold w-[40px]">#</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-left font-semibold">Date</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-center font-semibold w-[50px]">Type</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-left font-semibold">Reference No</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-right font-semibold">Rate (₹)</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-right font-semibold text-green-700">GRN Qty</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-right font-semibold text-red-600">GIN Qty</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-right font-semibold text-blue-700">Bal Qty</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-right font-semibold">Amount (₹)</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-right font-semibold text-blue-700">Bal Amt (₹)</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-left font-semibold">Store Location</th>
                        <th className="border border-[#9e9e9e] px-2 py-1.5 text-left font-semibold">Used To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && !ledgerLoading && (
                        <tr>
                          <td colSpan={12} className="text-center py-6 text-xs text-gray-400">
                            {hasActiveFilter ? "No entries found for the selected filters" : "No movement entries found"}
                          </td>
                        </tr>
                      )}
                      {rows.map((r, i) => {
                        const isGRN = r.type === "GRN";
                        return (
                          <tr key={i} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-center text-gray-500">{i + 1}</td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 whitespace-nowrap">{fmtDate(r.date)}</td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-center">
                              <span className={`inline-flex items-center gap-0.5 font-semibold ${isGRN ? "text-green-700" : "text-red-600"}`}>
                                {isGRN
                                  ? <ArrowDownCircle size={11} className="shrink-0" />
                                  : <ArrowUpCircle size={11} className="shrink-0" />}
                                {r.type}
                              </span>
                            </td>
                            <td className={`border border-[#e6e4e4] px-2 py-1.5 font-medium ${isGRN ? "text-green-800" : "text-red-700"}`}>{r.no}</td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-right">{fmtNum(r.rate)}</td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-right font-medium text-green-700">
                              {r.qtyIn > 0 ? fmtNum(r.qtyIn) : "-"}
                            </td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-right font-medium text-red-600">
                              {r.qtyOut > 0 ? fmtNum(r.qtyOut) : "-"}
                            </td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-right font-semibold text-blue-700">{fmtNum(r.balQty)}</td>
                            <td className={`border border-[#e6e4e4] px-2 py-1.5 text-right font-medium ${isGRN ? "text-green-700" : "text-red-600"}`}>
                              {isGRN ? "" : "−"}{fmtNum(r.amount)}
                            </td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-right font-semibold text-blue-700">{fmtNum(r.balAmt)}</td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-gray-600">{r.storeLocation ?? "-"}</td>
                            <td className="border border-[#e6e4e4] px-2 py-1.5 text-gray-600">{r.useLocation ?? "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* LEDGER PAGINATION */}
                {totalLedgerPages > 1 && (
                  <div className="flex items-center justify-between px-1 py-1 text-xs text-gray-600">
                    <span>Page {ledgerPage} of {totalLedgerPages}</span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={ledgerPage === 1 || ledgerLoading}
                        onClick={() => setLedgerPage((p) => p - 1)}
                        className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition"
                      >
                        ‹ Prev
                      </button>
                      {Array.from({ length: totalLedgerPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalLedgerPages || Math.abs(p - ledgerPage) <= 1)
                        .reduce((acc, p, i, arr) => {
                          if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === "..." ? (
                            <span key={`e-${i}`} className="px-1">…</span>
                          ) : (
                            <button
                              key={p}
                              disabled={ledgerLoading}
                              onClick={() => setLedgerPage(p)}
                              className={`px-2 py-0.5 border rounded transition ${
                                p === ledgerPage
                                  ? "bg-[#7fc3d4] border-[#4d8ea3] text-black font-semibold"
                                  : "border-[#9e9e9e] hover:bg-[#e6e6e6]"
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )}
                      <button
                        disabled={ledgerPage === totalLedgerPages || ledgerLoading}
                        onClick={() => setLedgerPage((p) => p + 1)}
                        className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition"
                      >
                        Next ›
                      </button>
                    </div>
                  </div>
                )}
                </div>
              );
            })()}

          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color = "text-gray-800", icon, highlight }) {
  return (
    <div className={`rounded-md border px-3 py-2.5 text-xs ${highlight ? "border-[#4d8ea3] bg-[#eef6fa]" : "border-gray-200 bg-gray-50"}`}>
      <div className="flex items-center gap-1 text-gray-500 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`font-semibold text-sm ${color}`}>{value}</div>
      {sub && <div className="text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
