"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { toast } from "sonner";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import { usePageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { fmtDate } from "@/components/finance/report/accounting/shared";

export default function FinancialYearPage() {
  const access = getPageAccess({ pageCode: "accounting_financial_year", pageType: "LIST" });
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
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — Financial Years</h2>

        <div className="flex items-center gap-3 border-b pb-3">
          <input
            type="number"
            placeholder="Start Year (e.g. 2024)"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            className="h-[28px] w-[180px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1 px-3 py-[5px] bg-[#1b2f3a] hover:bg-[#263f4d] text-white text-[12px] font-medium disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Create FY
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <EdoxMark size={32} />
          </div>
        ) : !years.length ? (
          <div className="text-center text-[#9ca3af] text-[12px] py-10">No financial years configured</div>
        ) : (
          <div className="border border-[#d1d5db] overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#1b2f3a]">
                  <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">Label</th>
                  <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">Start Date</th>
                  <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">End Date</th>
                  <th className="px-2 py-[6px] text-center font-medium text-white text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {years.map((fy, i) => (
                  <tr key={fy.id || i} className={`border-b border-[#e5e7eb] ${i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f4f8] transition-colors`}>
                    <td className="px-2 py-[4px] font-medium text-[#374151] border-r border-[#f0f0f0]">{fy.fyCode || `FY ${fy.startDate?.slice(0, 4)}`}</td>
                    <td className="px-2 py-[4px] text-[#374151] border-r border-[#f0f0f0]">{fmtDate(fy.startDate)}</td>
                    <td className="px-2 py-[4px] text-[#374151] border-r border-[#f0f0f0]">{fmtDate(fy.endDate)}</td>
                    <td className="px-2 py-[4px] text-center border-r border-[#f0f0f0]">
                      {fy.isCurrent ? (
                        <span className="px-2 py-0.5 bg-[#e8f4e8] text-[#2d7a2d] text-[10px] font-semibold">Active</span>
                      ) : (
                        <span className="text-[#9ca3af]">—</span>
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
