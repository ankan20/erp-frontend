"use client";

import { useCallback, useMemo } from "react";
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
import AccountingTable from "@/components/finance/report/accounting/AccountingTable";
import useAccountingFetch from "@/components/finance/report/accounting/useAccountingFetch";

const COLUMNS = [
  { key: "accountCode", label: "Account Code" },
  { key: "accountName", label: "Account Name", className: "min-w-[220px]" },
  { key: "groupName", label: "Group" },
  { key: "debit", label: "Debit", type: "amount", align: "right" },
  { key: "credit", label: "Credit", type: "amount", align: "right" },
];

export default function TrialBalancePage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset, handleExport,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.TRIAL_BALANCE);

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    const result = data.rows.map((a, i) => ({
      _key: i,
      accountCode: a.accountType || "",
      accountName: a.accountName || "",
      groupName: a.groupName || "",
      debit: a.closingDebit,
      credit: a.closingCredit,
    }));
    if (data.grandTotalDebit != null) {
      result.push({
        _key: "total",
        _highlight: true,
        accountCode: "",
        accountName: "TOTAL",
        groupName: "",
        debit: data.grandTotalDebit,
        credit: data.grandTotalCredit,
      });
    }
    return result;
  }, [data]);

  const onPDF = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.TRIAL_BALANCE, "pdf"),
    [handleExport],
  );
  const onExcel = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.TRIAL_BALANCE, "excel"),
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
            Choose filters and press Fetch to view the Trial Balance
          </div>
        ) : (
          <>
            {data?.grandTotalDebit != null && (
              <div className="flex flex-wrap gap-3 text-[12px]">
                <span className="px-3 py-1 bg-[#e8f4e8] rounded border border-[#b0d4b0]">
                  Total Debit: <strong>{formatAmount(data.grandTotalDebit)}</strong>
                </span>
                <span className="px-3 py-1 bg-[#fce8e8] rounded border border-[#f0b0b0]">
                  Total Credit: <strong>{formatAmount(data.grandTotalCredit)}</strong>
                </span>
                {data.grandTotalDebit !== data.grandTotalCredit && (
                  <span className="px-3 py-1 bg-[#fff3e0] rounded border border-[#ffcc80] text-[#e65100] font-semibold">
                    Difference: {formatAmount(Math.abs(data.grandTotalDebit - data.grandTotalCredit))}
                  </span>
                )}
              </div>
            )}
            <AccountingTable columns={COLUMNS} rows={rows} emptyMessage="No accounts found" />
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
