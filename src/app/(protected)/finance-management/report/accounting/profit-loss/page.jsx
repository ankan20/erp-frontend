"use client";

import { useCallback, useState } from "react";
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
import AccountingTreeTable from "@/components/finance/report/accounting/AccountingTreeTable";
import ReconciliationModal from "@/components/finance/report/accounting/ReconciliationModal";

export default function AccountingProfitLossPage() {
  const access = getPageAccess({ pageCode: "accounting_profit_loss", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset, handleExport,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.PROFIT_LOSS);

  const [reconcile, setReconcile] = useState(null);

  const onReconcile = useCallback((accountType, accountId, accountName) => {
    setReconcile({ accountType, accountId, accountName });
  }, []);

  const onPDF = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.PROFIT_LOSS, "pdf"),
    [handleExport],
  );
  const onExcel = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.PROFIT_LOSS, "excel"),
    [handleExport],
  );

  const actions = usePageActions({ router });

  const totalIncome = data?.totalIncome || 0;
  const totalExpense = data?.totalExpense || 0;
  const netResult = data?.netProfit || 0;

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
            <Loader2 className="animate-spin w-5 h-5 text-[#1b2f3a]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-[#9ca3af] text-[12px] gap-1">
            <Search size={20} className="opacity-40" />
            Choose filters and press Fetch to view Profit &amp; Loss
          </div>
        ) : (
          <>
            {/* Net Result summary */}
            <div className={`border px-4 py-3 flex items-start gap-3 ${
              netResult >= 0
                ? "border-[#bbf7d0] bg-[#f0fdf4]"
                : "border-[#fecaca] bg-[#fef2f2]"
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    netResult >= 0 ? "bg-[#16a34a]" : "bg-[#dc2626]"
                  }`} />
                  <span className="text-[12px] font-semibold text-[#1e293b]">
                    {netResult >= 0 ? "Net Profit" : "Net Loss"}: {formatAmount(Math.abs(netResult))}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b] leading-relaxed pl-4">
                  Total Income ({formatAmount(totalIncome)}) − Total Expenses ({formatAmount(totalExpense)})
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Income tree */}
              <AccountingTreeTable
                title="Income / Revenue"
                headerBg="#14532d"
                groups={data?.income || []}
                columns={["debit", "credit", "net"]}
                columnLabels={{ net: "Net", debit: "Debit", credit: "Credit" }}
                grandTotal={totalIncome}
                grandTotalLabel="Total Income"
                onReconcile={onReconcile}
                showPercent
                percentBase={totalIncome}
                zeroDisplay="dash"
              />

              {/* Expense tree */}
              <AccountingTreeTable
                title="Expenses"
                headerBg="#7f1d1d"
                groups={data?.expense || []}
                columns={["debit", "credit", "net"]}
                columnLabels={{ net: "Net", debit: "Debit", credit: "Credit" }}
                grandTotal={totalExpense}
                grandTotalLabel="Total Expenses"
                onReconcile={onReconcile}
                showPercent
                percentBase={totalIncome}
                zeroDisplay="dash"
              />
            </div>
          </>
        )}
      </div>

      <ReconciliationModal
        open={!!reconcile}
        onClose={() => setReconcile(null)}
        accountType={reconcile?.accountType}
        accountId={reconcile?.accountId}
        accountName={reconcile?.accountName}
        fromDate={fromDate}
        toDate={toDate}
        projectCode={projectCode}
      />
    </HeaderWrapper>
  );
}
