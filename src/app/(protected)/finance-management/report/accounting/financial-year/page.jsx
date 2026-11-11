"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import { usePageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

export default function FinancialYearPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newYear, setNewYear] = useState("");

  const fetchYears = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest({ url: API_ENDPOINTS.FINANCE.ACCOUNTING.FINANCIAL_YEAR, method: "GET" });
      setYears(res?.data || []);
    } catch (err) {
      toast.error(err?.message || "Failed to load financial years");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);

  const handleCreate = async () => {
    if (!newYear) { toast.error("Enter a start year (e.g., 2024 for FY 2024-25)"); return; }
    const sy = parseInt(newYear, 10);
    const ey = sy + 1;
    setCreating(true);
    try {
      await apiRequest({
        url: API_ENDPOINTS.FINANCE.ACCOUNTING.FINANCIAL_YEAR,
        method: "POST",
        data: {
          fy_code: `${sy}-${ey}`,
          start_date: `${sy}-04-01`,
          end_date: `${ey}-03-31`,
        },
      });
      toast.success("Financial year created");
      setNewYear("");
      fetchYears();
    } catch (err) {
      toast.error(err?.message || "Failed to create financial year");
    } finally {
      setCreating(false);
    }
  };

  const actions = usePageActions({ router });


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-4 space-y-4">
        <h1 className="text-lg font-bold text-[#1a1a4e]">Financial Years</h1>

        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="Start Year (e.g. 2024)"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            className="h-8 w-[180px] border border-[#8f8f8f] px-3 text-sm rounded-sm"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create FY
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !years.length ? (
          <div className="text-center text-gray-400 text-[13px] py-10">No financial years configured</div>
        ) : (
          <div className="overflow-x-auto border border-[#ccc] rounded-sm">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="bg-[#e8e8f0]">
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Label</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Start Date</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">End Date</th>
                  <th className="px-3 py-2 text-center font-semibold border-b border-[#bbb]">Active</th>
                </tr>
              </thead>
              <tbody>
                {years.map((fy, i) => (
                  <tr key={fy.id || i} className={`border-b border-[#e0e0e0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f0ff]`}>
                    <td className="px-3 py-1.5 font-medium">{fy.fyCode || `FY ${fy.startDate?.slice(0, 4)}`}</td>
                    <td className="px-3 py-1.5">{fy.startDate}</td>
                    <td className="px-3 py-1.5">{fy.endDate}</td>
                    <td className="px-3 py-1.5 text-center">
                      {fy.isCurrent ? (
                        <span className="px-2 py-0.5 bg-[#e8f4e8] text-[#2d7a2d] rounded text-[11px] font-semibold">Active</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
