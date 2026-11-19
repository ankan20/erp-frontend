"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, FileSearch } from "lucide-react";

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
import ReconciliationModal from "@/components/finance/report/accounting/ReconciliationModal";

const COLUMNS = [
  { key: "accountCode", label: "Type" },
  { key: "accountName", label: "Account Name", className: "min-w-[220px]" },
  { key: "groupName", label: "Group" },
  { key: "headUnder", label: "Head Under" },
  { key: "debit", label: "Debit", type: "amount", align: "right" },
  { key: "credit", label: "Credit", type: "amount", align: "right" },
  { key: "action", label: "", className: "w-[32px]" },
];

export default function TrialBalancePage() {
  const access = getPageAccess({ pageCode: "accounting_trial_balance", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset, handleExport,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.TRIAL_BALANCE);

  const [reconcile, setReconcile] = useState(null);

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    const result = data.rows.map((a, i) => ({
      _key: i,
      accountCode: a.accountType || "",
      accountName: a.accountName || "",
      groupName: a.groupName || "",
      headUnder: a.headUnder || "",
      debit: a.closingDebit,
      credit: a.closingCredit,
      action: (
        <button
          onClick={() => setReconcile({
            accountType: a.accountType,
            accountId: a.accountId,
            accountName: a.accountName,
          })}
          title="View transactions"
          className="p-0.5 text-[#9ca3af] hover:text-[#1b2f3a] transition-colors"
        >
          <FileSearch size={13} />
        </button>
      ),
    }));
    if (data.grandTotalDebit != null) {
      result.push({
        _key: "total",
        _highlight: true,
        accountCode: "",
        accountName: "Total",
        groupName: "",
        headUnder: "",
        debit: data.grandTotalDebit,
        credit: data.grandTotalCredit,
        action: null,
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
            <Loader2 className="animate-spin w-5 h-5 text-[#1b2f3a]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-[#9ca3af] text-[12px] gap-1">
            <Search size={20} className="opacity-40" />
            Choose filters and press Fetch to view the Trial Balance
          </div>
        ) : (
          <>
            {data?.grandTotalDebit != null && (
              <div className="flex items-center gap-4 text-[11.5px] py-1.5">
                <span className="text-[#374151]">
                  Total Debit: <span className="font-semibold tabular-nums text-[#166534]">{formatAmount(data.grandTotalDebit)}</span>
                </span>
                <span className="text-[#374151]">
                  Total Credit: <span className="font-semibold tabular-nums text-[#991b1b]">{formatAmount(data.grandTotalCredit)}</span>
                </span>
                {data.grandTotalDebit !== data.grandTotalCredit && (
                  <span className="text-[#92400e] font-medium">
                    Difference: {formatAmount(Math.abs(data.grandTotalDebit - data.grandTotalCredit))}
                  </span>
                )}
              </div>
            )}
            <AccountingTable columns={COLUMNS} rows={rows} emptyMessage="No accounts found" />
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
