"use client";

/**
 * Finance Management → Finance → Profit & Loss
 *
 * View only, like Ledger View: pick a project and a date range, fetch, read the
 * statement, download it as PDF or Excel. Nothing here creates or edits.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable   from "@/components/common/PageNotAvailable";
import SearchableSelect   from "@/components/common/SearchableSelect";
import { usePageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }   from "@/helper/numberFormatter";
import { PL_COLUMNS }     from "@/config/profitLoss.config";

import ProfitLossTable          from "@/components/finance/report/profit-loss/ProfitLossTable";
import { buildProfitLossRows }  from "@/components/finance/report/profit-loss/buildProfitLossRows";
import {
  downloadProfitLossPDF,
  downloadProfitLossExcel,
  printProfitLossPDF,
} from "@/components/finance/report/profit-loss/profitLossExport";

function FilterLabel({ children }) {
  return (
    <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] leading-5 rounded-sm whitespace-nowrap shrink-0">
      {children}
    </div>
  );
}

function SummaryBox({ sale, expenses, result, columnLabel }) {
  const profit = result ?? 0;
  const items = [
    { label: "Total Sale",     value: formatAmount(sale ?? 0),     bg: "bg-[#e8f4e8]", vBg: "bg-[#ccebcc]", text: "text-[#2d7a2d]" },
    { label: "Total Expenses", value: formatAmount(expenses ?? 0), bg: "bg-[#fce8e8]", vBg: "bg-[#f5d0d0]", text: "text-[#a32020]" },
    {
      label: profit < 0 ? "Net Loss" : "Net Profit",
      value: formatAmount(Math.abs(profit)),
      bg: "bg-[#DCE8D2]", vBg: "bg-[#F2B07E]",
      text: `${profit < 0 ? "text-[#a32020]" : "text-[#6b3000]"} font-bold`,
    },
  ];
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
      {columnLabel && (
        <span className="text-[11px] text-gray-500 sm:mr-1">Summary of</span>
      )}
      {items.map((it) => (
        <div key={it.label} className="flex items-stretch rounded-sm overflow-hidden border border-[#9aa9b8]">
          <div className={`${it.bg} px-3 py-1 text-[12px] font-semibold whitespace-nowrap`}>{it.label}</div>
          <div className={`${it.vBg} ${it.text} px-3 py-1 text-[12px] text-right tabular-nums min-w-[120px]`}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Which value column the summary boxes describe */
function ColumnPicker({ columns, value, onChange, hasData }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {columns.map((c) => {
        const active = c.key === value;
        const empty  = !hasData(c.key);
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            title={empty ? `${c.label} — no data in this period` : `Summarise the ${c.label} column`}
            className={`px-2.5 py-1 text-[12px] rounded-sm border transition-colors ${
              active
                ? "bg-[#5a5aaa] border-[#4a4a9a] text-white font-semibold"
                : empty
                ? "bg-white border-[#d0d0d0] text-gray-400 hover:bg-gray-50"
                : "bg-white border-[#8f8f8f] text-gray-700 hover:bg-gray-100"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ProfitLossPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });

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

  const { rows, sale, expenses, result } = useMemo(
    () => buildProfitLossRows(data),
    [data],
  );

  // The summary boxes describe ONE of the five value columns. Default to the
  // first column that actually carries data — pinning it to "actual" showed
  // 0.00 whenever the period only had Order figures.
  const [pickedColumn, setPickedColumn] = useState(null);
  const columnHasData = useCallback(
    (key) => sale?.[key] !== null || expenses?.[key] !== null,
    [sale, expenses],
  );
  const autoColumn = useMemo(
    () => PL_COLUMNS.find((c) => columnHasData(c.key))?.key || "actual",
    [columnHasData],
  );
  const summaryColumn = pickedColumn ?? autoColumn;
  const summaryLabel  = PL_COLUMNS.find((c) => c.key === summaryColumn)?.label || "";

  const handleFetch = useCallback(async () => {
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("From date cannot be after To date");
      return;
    }
    setLoading(true);
    setFetched(false);
    setPickedColumn(null);   // let the new period pick its own default column
    try {
      const params = new URLSearchParams();
      if (projectCode) params.set("projectCode", projectCode);
      if (fromDate)    params.set("fromDate", fromDate);
      if (toDate)      params.set("toDate", toDate);
      const qs  = params.toString();
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.PROFIT_LOSS.GET}${qs ? `?${qs}` : ""}`,
        method: "GET",
      });
      setData(res?.data ?? null);
      setFetched(true);
    } catch (err) {
      setData(null);
      toast.error(err?.message || "Failed to fetch Profit & Loss");
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
    setPickedColumn(null);
  };

  const exportArgs = { rows, projectCode, fromDate, toDate };

  const handlePDF = useCallback(async () => {
    try { await downloadProfitLossPDF(exportArgs); }
    catch (err) { toast.error(err?.message || "Failed to build PDF"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, projectCode, fromDate, toDate]);

  const handleExcel = useCallback(async () => {
    try { await downloadProfitLossExcel(exportArgs); }
    catch (err) { toast.error(err?.message || "Failed to build Excel"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, projectCode, fromDate, toDate]);

  const handlePrint = useCallback(async () => {
    try { await printProfitLossPDF(exportArgs); }
    catch (err) { toast.error(err?.message || "Failed to open print dialog"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, projectCode, fromDate, toDate]);

  const actions = usePageActions({
    router,
    onPrint:    fetched ? handlePrint : undefined,
    onDownload: fetched ? handlePDF   : undefined,
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
          <>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
              <ColumnPicker
                columns={PL_COLUMNS}
                value={summaryColumn}
                onChange={setPickedColumn}
                hasData={columnHasData}
              />
              <SummaryBox
                sale={sale?.[summaryColumn]}
                expenses={expenses?.[summaryColumn]}
                result={result?.[summaryColumn]}
                columnLabel={summaryLabel}
              />
            </div>
            <ProfitLossTable rows={rows} />
            <p className="text-[11px] text-gray-500">
              % of each row is its share of total Sale (row A) within the same column.
            </p>
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
