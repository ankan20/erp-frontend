"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { usePageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";

import AccountingFilterBar from "@/components/finance/report/accounting/AccountingFilterBar";
import useAccountingFetch from "@/components/finance/report/accounting/useAccountingFetch";

function Section({ title, items, total, bgHeader, bgTotal }) {
  return (
    <div className="border border-[#ccc] rounded-sm overflow-hidden">
      <div className={`${bgHeader} px-4 py-2 font-semibold text-[13px] border-b border-[#bbb]`}>{title}</div>
      <table className="w-full text-[12.5px]">
        <tbody>
          {(items || []).map((item, i) => (
            <tr key={i} className="border-b border-[#eee] hover:bg-[#f8f8ff]">
              <td className="px-4 py-1.5">{item.name || item.code || ""}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAmount(item.balance || 0)}</td>
            </tr>
          ))}
          <tr className={`${bgTotal} font-semibold`}>
            <td className="px-4 py-2">Total</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatAmount(total || 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function AccountingBalanceSheetPage() {
  const access = getPageAccess({ pageCode: "accounting_balance_sheet", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset, handleExport,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.BALANCE_SHEET);

  const onPDF = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.BALANCE_SHEET, "pdf"),
    [handleExport],
  );
  const onExcel = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.BALANCE_SHEET, "excel"),
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
            Choose filters and press Fetch to view the Balance Sheet
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <AccountingTreeTable
                title="Assets"
                headerBg="#1e3a5f"
                groups={data?.assetGroups || []}
                columns={["debit", "credit", "net"]}
                columnLabels={{ net: "Balance", debit: "Debit", credit: "Credit" }}
                grandTotal={data?.totalAssets}
                grandTotalLabel="Total Assets"
                onReconcile={onReconcile}
                extraRows={assetExtras}
                zeroDisplay="zero"
                side="asset"
              />

              <AccountingTreeTable
                title="Equity & Liabilities"
                headerBg="#6b2121"
                groups={data?.liabilityGroups || []}
                columns={["debit", "credit", "net"]}
                columnLabels={{ net: "Balance", debit: "Debit", credit: "Credit" }}
                grandTotal={data?.totalLiabilities}
                grandTotalLabel="Total Equity & Liabilities"
                onReconcile={onReconcile}
                extraRows={liabilityExtras}
                zeroDisplay="zero"
                side="liability"
              />
            </div>
            {data?.difference != null && data.difference !== 0 && (
              <div className="px-4 py-2 bg-[#fff3e0] rounded-sm border border-[#ffcc80] text-[13px] text-[#e65100] font-semibold">
                Difference (Assets − Liabilities): {formatAmount(data.difference)}
              </div>
            )}
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
