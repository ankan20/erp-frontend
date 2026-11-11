"use client";

import { useCallback, useMemo } from "react";
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

export default function AccountingProfitLossPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset, handleExport,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.PROFIT_LOSS);

  const { incomeGroups, expenseGroups, totalIncome, totalExpense, netResult } = useMemo(() => {
    if (!data) return { incomeGroups: [], expenseGroups: [], totalIncome: 0, totalExpense: 0, netResult: 0 };
    const mapGroups = (arr) => (arr || []).map((g) => ({ groupName: g.group, amount: g.total }));
    return {
      incomeGroups: mapGroups(data.income),
      expenseGroups: mapGroups(data.expense),
      totalIncome: data.totalIncome || 0,
      totalExpense: data.totalExpense || 0,
      netResult: data.netProfit || 0,
    };
  }, [data]);

  const onPDF = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.PROFIT_LOSS, "pdf"),
    [handleExport],
  );
  const onExcel = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.PROFIT_LOSS, "excel"),
    [handleExport],
  );

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
          onPDF={onPDF}
          onExcel={onExcel}
        />

        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Choose filters and press Fetch to view the Profit &amp; Loss
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Income */}
            <div className="border border-[#ccc] rounded-sm overflow-hidden">
              <div className="bg-[#e8f4e8] px-4 py-2 font-semibold text-[13px] border-b border-[#b0d4b0]">Income / Revenue</div>
              <table className="w-full text-[12.5px]">
                <tbody>
                  {incomeGroups.map((g, i) => (
                    <tr key={i} className="border-b border-[#eee] hover:bg-[#f5fff5]">
                      <td className="px-4 py-1.5">{g.groupName}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{formatAmount(g.amount || 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#d4ecd4] font-semibold">
                    <td className="px-4 py-2">Total Income</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatAmount(totalIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expenses */}
            <div className="border border-[#ccc] rounded-sm overflow-hidden">
              <div className="bg-[#fce8e8] px-4 py-2 font-semibold text-[13px] border-b border-[#f0b0b0]">Expenses</div>
              <table className="w-full text-[12.5px]">
                <tbody>
                  {expenseGroups.map((g, i) => (
                    <tr key={i} className="border-b border-[#eee] hover:bg-[#fff5f5]">
                      <td className="px-4 py-1.5">{g.groupName}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{formatAmount(g.amount || 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#f0c0c0] font-semibold">
                    <td className="px-4 py-2">Total Expenses</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatAmount(totalExpense)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Result */}
            <div className="lg:col-span-2">
              <div className={`flex items-center justify-between px-4 py-3 rounded-sm border ${netResult >= 0 ? "bg-[#e8f4e8] border-[#b0d4b0]" : "bg-[#fce8e8] border-[#f0b0b0]"}`}>
                <span className="font-bold text-[14px]">
                  {netResult >= 0 ? "Net Profit" : "Net Loss"}
                </span>
                <span className="font-bold text-[16px] tabular-nums">
                  {formatAmount(Math.abs(netResult))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
