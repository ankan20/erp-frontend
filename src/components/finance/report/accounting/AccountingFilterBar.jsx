"use client";

import { Loader2, Search, RefreshCw, FileText, FileSpreadsheet } from "lucide-react";
import SearchableSelect from "@/components/common/SearchableSelect";

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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 border-b border-[#d1d5db]">
      {/* Project */}
      <div className="flex items-center gap-1.5">
        <label className="text-[11.5px] font-medium text-[#6b7280] whitespace-nowrap">Project</label>
        <div className="w-[200px]">
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

      {/* Date range */}
      <div className="flex items-center gap-1.5">
        <label className="text-[11.5px] font-medium text-[#6b7280]">From</label>
        <input
          type="date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-[28px] w-[130px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-[11.5px] font-medium text-[#6b7280]">To</label>
        <input
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(e) => setToDate(e.target.value)}
          className="h-[28px] w-[130px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors"
        />
      </div>

      {extraFilters}

      {/* Actions */}
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          onClick={onFetch}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-[5px] bg-[#1b2f3a] hover:bg-[#263f4d] text-white text-[12px] font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          Fetch
        </button>

        {fetched && (
          <>
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2.5 py-[5px] border border-[#d1d5db] text-[12px] text-[#4b5563] hover:bg-[#f3f4f6] transition-colors"
            >
              <RefreshCw size={12} /> Reset
            </button>
            {onPDF && (
              <button
                onClick={onPDF}
                className="flex items-center gap-1 px-2.5 py-[5px] border border-[#d1d5db] text-[12px] text-[#9b2c2c] hover:bg-[#fef2f2] transition-colors"
              >
                <FileText size={12} /> PDF
              </button>
            )}
            {onExcel && (
              <button
                onClick={onExcel}
                className="flex items-center gap-1 px-2.5 py-[5px] border border-[#d1d5db] text-[12px] text-[#166534] hover:bg-[#f0fdf4] transition-colors"
              >
                <FileSpreadsheet size={12} /> Excel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
