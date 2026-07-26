"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveFromItems(items) {
  // Group by category
  const categoryMap = {};
  const locationMap = {};

  items.forEach((row) => {
    if (!row.manId) return;
    const totalWH = parseFloat(row.totalWorkingHr) || 0;

    // Category grouping
    const cat = row.category || "Uncategorized";
    if (!categoryMap[cat]) categoryMap[cat] = 0;
    categoryMap[cat] += totalWH;

    // Location grouping
    const loc = row.jobLocation || "Unknown";
    if (!locationMap[loc]) locationMap[loc] = 0;
    locationMap[loc] += totalWH;
  });

  const categoryRows = Object.entries(categoryMap).map(([category, totalWH], i) => ({
    sl:            i + 1,
    category,
    totalWorkingHr: parseFloat(totalWH.toFixed(2)),
    manday:         parseFloat((totalWH / 8).toFixed(2)),
    rate:           0,
    amount:         0,
  }));

  const locationRows = Object.entries(locationMap).map(([location, totalWH], i) => ({
    sl:            i + 1,
    location,
    totalWorkingHr: parseFloat(totalWH.toFixed(2)),
    amount:         0,
  }));

  return { categoryRows, locationRows };
}

// ── Table styles ──────────────────────────────────────────────────────────────

const th       = "border border-gray-300 px-2 py-1 text-[12px] font-semibold text-left whitespace-nowrap";
const COL_HDR  = "bg-[#d9d9d9]";
const td  = "border border-gray-300 px-2 py-0.5 text-[12px]";
const tft = "border border-gray-300 px-2 py-1 text-[12px] font-semibold bg-gray-200";

const HEADER_BG = "bg-[#d8e0d1]";

// ── Component ─────────────────────────────────────────────────────────────────

export default function DLRSummaryTab({ dlrId, items = [] }) {
  const [serverData, setServerData] = useState(null);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    if (!dlrId) return;
    setLoading(true);
    apiRequest({
      url: `${API_ENDPOINTS.RESOURCE.MANPOWER.DLR.SUMMARY}/${dlrId}`,
      method: "GET",
    })
      .then((res) => setServerData(res?.data || null))
      .catch(() => toast.error("Failed to load summary"))
      .finally(() => setLoading(false));
  }, [dlrId]);

  // Derive data — prefer server when available
  const { categoryRows, locationRows } = useMemo(() => {
    if (serverData) {
      const catRows = (serverData.categoryRows || serverData.mandays || []).map((r, i) => ({
        sl:             i + 1,
        category:       r.category       || r.categoryName || "",
        totalWorkingHr: parseFloat(r.totalWorkingHr || r.totalHours || 0),
        manday:         parseFloat(r.manday || r.mandays || 0),
        rate:           parseFloat(r.rate   || 0),
        amount:         parseFloat(r.amount || 0),
      }));
      const locRows = (serverData.locationRows || serverData.areas || []).map((r, i) => ({
        sl:             i + 1,
        location:       r.location || r.jobLocation || r.area || "",
        totalWorkingHr: parseFloat(r.totalWorkingHr || r.totalHours || 0),
        amount:         parseFloat(r.amount || 0),
      }));
      return { categoryRows: catRows, locationRows: locRows };
    }
    return deriveFromItems(items);
  }, [serverData, items]);

  // Totals
  const catTotalWH     = categoryRows.reduce((s, r) => s + r.totalWorkingHr, 0);
  const catTotalMd     = categoryRows.reduce((s, r) => s + r.manday,         0);
  const catTotalAmt    = categoryRows.reduce((s, r) => s + r.amount,          0);

  const locTotalWH     = locationRows.reduce((s, r) => s + r.totalWorkingHr, 0);
  const locTotalAmt    = locationRows.reduce((s, r) => s + r.amount,          0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[200px]">
        <Loader2 className="animate-spin w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Mandays Summary */}
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className={`${HEADER_BG} border border-gray-300 px-3 py-1 mb-0`}>
          <span className="text-[13px] font-semibold text-[#1a3a5c]">Mandays Summary</span>
        </div>
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className={COL_HDR}>
              <th className={th}>Sl No</th>
              <th className={th}>Category</th>
              <th className={th}>Total Working Hr.</th>
              <th className={th}>Manday</th>
              <th className={th}>Rate</th>
              <th className={th}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {categoryRows.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${td} text-center text-gray-400 py-4`}>
                  No data
                </td>
              </tr>
            ) : (
              categoryRows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? "bg-[#f0f5ff]" : "bg-white"}>
                  <td className={td}>{row.sl}</td>
                  <td className={td}>{row.category}</td>
                  <td className={td}>{parseFloat(row.totalWorkingHr.toFixed(2))}</td>
                  <td className={td}>{parseFloat(row.manday.toFixed(2))}</td>
                  <td className={td}>{parseFloat(row.rate.toFixed(2))}</td>
                  <td className={td}>{parseFloat(row.amount.toFixed(2))}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className={tft} colSpan={2}>TOTAL</td>
              <td className={tft}>{parseFloat(catTotalWH.toFixed(2))}</td>
              <td className={tft}>{parseFloat(catTotalMd.toFixed(2))}</td>
              <td className={tft}>—</td>
              <td className={tft}>{parseFloat(catTotalAmt.toFixed(2))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Area Wise Summary */}
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className={`${HEADER_BG} border border-gray-300 px-3 py-1 mb-0`}>
          <span className="text-[13px] font-semibold text-[#1a3a5c]">Area Wise Summary</span>
        </div>
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className={COL_HDR}>
              <th className={th}>Sl No</th>
              <th className={th}>Location</th>
              <th className={th}>Total Working Hr.</th>
              <th className={th}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {locationRows.length === 0 ? (
              <tr>
                <td colSpan={4} className={`${td} text-center text-gray-400 py-4`}>
                  No data
                </td>
              </tr>
            ) : (
              locationRows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? "bg-[#f0f5ff]" : "bg-white"}>
                  <td className={td}>{row.sl}</td>
                  <td className={td}>{row.location}</td>
                  <td className={td}>{parseFloat(row.totalWorkingHr.toFixed(2))}</td>
                  <td className={td}>{parseFloat(row.amount.toFixed(2))}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className={tft} colSpan={2}>TOTAL</td>
              <td className={tft}>{parseFloat(locTotalWH.toFixed(2))}</td>
              <td className={tft}>{parseFloat(locTotalAmt.toFixed(2))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
