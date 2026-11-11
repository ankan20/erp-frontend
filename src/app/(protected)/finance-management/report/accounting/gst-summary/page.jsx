"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import { usePageActions } from "@/components/common/PageActionButtons";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";

import AccountingFilterBar from "@/components/finance/report/accounting/AccountingFilterBar";
import useAccountingFetch from "@/components/finance/report/accounting/useAccountingFetch";

export default function GstSummaryPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.GST_SUMMARY);

  const actions = usePageActions({ router });


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <AccountingFilterBar
          projectList={projectList}
          projectCode={projectCode}
          setProjectCode={setProjectCode}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          loading={loading}
          fetched={fetched}
          onFetch={handleFetch}
          onReset={handleReset}
        />

        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Choose a period and press Fetch to view the GST Summary
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-[#b0d4b0] rounded-sm bg-[#e8f4e8] p-4">
                <div className="text-[12px] text-gray-600">Input GST (Purchases)</div>
                <div className="text-[18px] font-bold tabular-nums mt-1">{formatAmount(data?.totalInput || 0)}</div>
              </div>
              <div className="border border-[#f0b0b0] rounded-sm bg-[#fce8e8] p-4">
                <div className="text-[12px] text-gray-600">Output GST (Sales)</div>
                <div className="text-[18px] font-bold tabular-nums mt-1">{formatAmount(data?.totalOutput || 0)}</div>
              </div>
              <div className={`border rounded-sm p-4 ${(data?.netPayable || 0) >= 0 ? "border-[#f0b0b0] bg-[#fff0f0]" : "border-[#b0d4b0] bg-[#f0fff0]"}`}>
                <div className="text-[12px] text-gray-600">{(data?.netPayable || 0) >= 0 ? "Net GST Payable" : "Net GST Refundable"}</div>
                <div className="text-[18px] font-bold tabular-nums mt-1">{formatAmount(Math.abs(data?.netPayable || 0))}</div>
              </div>
            </div>

            {(data?.input || data?.output) && (() => {
              const allTypes = [...new Set([...Object.keys(data.input || {}), ...Object.keys(data.output || {})])].sort();
              if (!allTypes.length) return null;
              return (
                <div className="overflow-x-auto border border-[#ccc] rounded-sm">
                  <table className="w-full text-[12.5px] border-collapse">
                    <thead>
                      <tr className="bg-[#e8e8f0]">
                        <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">GST Type</th>
                        <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Input</th>
                        <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Output</th>
                        <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTypes.map((t, i) => {
                        const inp = (data.input || {})[t] || 0;
                        const out = (data.output || {})[t] || 0;
                        return (
                          <tr key={t} className={`border-b border-[#e0e0e0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}>
                            <td className="px-3 py-1.5">{t}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(inp)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(out)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(out - inp)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
