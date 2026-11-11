"use client";

import { Loader2, Search, RefreshCw, FileText, FileSpreadsheet } from "lucide-react";
import SearchableSelect from "@/components/common/SearchableSelect";

function FilterLabel({ children }) {
  return (
    <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] leading-5 rounded-sm whitespace-nowrap shrink-0">
      {children}
    </div>
  );
}

export default function AccountingFilterBar({
  projectList = [],
  projectCode,
  setProjectCode,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  loading,
  fetched,
  onFetch,
  onReset,
  onPDF,
  onExcel,
  extraFilters,
}) {
  return (
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

      {extraFilters}

      <div className="flex items-center gap-2">
        <button
          onClick={onFetch}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Fetch
        </button>

        {fetched && (
          <>
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1 border border-[#8f8f8f] text-[13px] rounded-sm hover:bg-gray-100 transition-colors"
            >
              <RefreshCw size={13} /> Reset
            </button>
            {onPDF && (
              <button
                onClick={onPDF}
                className="flex items-center gap-1.5 px-3 py-1 border border-[#a33] text-[#a33] text-[13px] rounded-sm hover:bg-red-50 transition-colors"
              >
                <FileText size={13} /> PDF
              </button>
            )}
            {onExcel && (
              <button
                onClick={onExcel}
                className="flex items-center gap-1.5 px-3 py-1 border border-[#2d7a2d] text-[#2d7a2d] text-[13px] rounded-sm hover:bg-green-50 transition-colors"
              >
                <FileSpreadsheet size={13} /> Excel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
