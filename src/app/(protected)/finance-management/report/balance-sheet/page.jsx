"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import SearchableSelect from "@/components/common/SearchableSelect";
import { usePageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

import BalanceSheetTable from "@/components/finance/report/balance-sheet/BalanceSheetTable";
import {
  downloadBalanceSheetPDF,
  downloadBalanceSheetExcel,
} from "@/components/finance/report/balance-sheet/balanceSheetExport";

function FilterLabel({ children }) {
  return (
    <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] leading-5 rounded-sm whitespace-nowrap shrink-0">
      {children}
    </div>
  );
}

export default function BalanceSheetPage() {
  const router  = useRouter();
  const access  = getPageAccess({ pageCode: "balance_sheet", pageType: "LIST" });

  const defaultProject = getLocalStorage("projectInfo")?.projectCode || "";

  const [projectCode, setProjectCode] = useState(defaultProject);
  const [fromDate,    setFromDate]    = useState("");
  const [toDate,      setToDate]      = useState("");

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [fetched,     setFetched]     = useState(false);
  const [projectList, setProjectList] = useState([]);

  useEffect(() => {
    if (!access.allowed) return;
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" })
      .then((res) => setProjectList(res?.data || []))
      .catch(() => {});
  }, [access.allowed]);

  const handleFetch = useCallback(async () => {
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("From date cannot be after To date");
      return;
    }
    setLoading(true);
    setFetched(false);
    try {
      const params = new URLSearchParams();
      if (projectCode) params.set("projectCode", projectCode);
      if (fromDate)    params.set("fromDate", fromDate);
      if (toDate)      params.set("toDate", toDate);
      const qs  = params.toString();
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.BALANCE_SHEET.GET}${qs ? `?${qs}` : ""}`,
        method: "GET",
      });
      setData(res?.data ?? null);
      setFetched(true);
    } catch (err) {
      setData(null);
      toast.error(err?.message || "Failed to fetch Balance Sheet");
    } finally {
      setLoading(false);
    }
  }, [projectCode, fromDate, toDate]);

  const handleReset = () => {
    setProjectCode(defaultProject);
    setFromDate("");
    setToDate("");
    setData(null);
    setFetched(false);
  };

  const exportArgs = { data, projectCode, fromDate, toDate };

  const handlePDF = useCallback(async () => {
    try { await downloadBalanceSheetPDF(exportArgs); }
    catch (err) { toast.error(err?.message || "Failed to build PDF"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, projectCode, fromDate, toDate]);

  const handleExcel = useCallback(async () => {
    try { await downloadBalanceSheetExcel(exportArgs); }
    catch (err) { toast.error(err?.message || "Failed to build Excel"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, projectCode, fromDate, toDate]);

  const actions = usePageActions({
    router,
    onDownload: fetched ? handlePDF : undefined,
  });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">

        {/* ── FILTER BAR ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <FilterLabel>Project</FilterLabel>
            <div className="w-[220px]">
              <SearchableSelect
                options={projectList}
                value={projectCode}
                onChange={(val) => setProjectCode(val)}
                labelKey={["projectCode", "projectName"]}
                labelSeparator=" : "
                valueKey="projectCode"
                placeholder="All Projects"
                clearLabel="— All Projects —"
                searchKeys={["projectCode", "projectName"]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FilterLabel>From</FilterLabel>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>To</FilterLabel>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFetch}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Fetch
            </button>

            {fetched && (
              <>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#8f8f8f] text-[13px] rounded-sm hover:bg-gray-100 transition-colors"
                >
                  <RefreshCw size={13} /> Reset
                </button>
                <button
                  onClick={handlePDF}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#a33] text-[#a33] text-[13px] rounded-sm hover:bg-red-50 transition-colors"
                >
                  <FileText size={13} /> PDF
                </button>
                <button
                  onClick={handleExcel}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#2d7a2d] text-[#2d7a2d] text-[13px] rounded-sm hover:bg-green-50 transition-colors"
                >
                  <FileSpreadsheet size={13} /> Excel
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── RESULT ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Choose a project and period, then press Fetch
          </div>
        ) : (
          <BalanceSheetTable data={data} />
        )}
      </div>
    </HeaderWrapper>
  );
}
