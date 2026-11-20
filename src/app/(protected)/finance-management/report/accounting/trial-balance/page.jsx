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
import { exportPDF, exportExcel } from "@/components/finance/report/accounting/exportAccounting";

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
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.TRIAL_BALANCE);

  const [reconcile, setReconcile] = useState(null);

  const { rows, footerRow } = useMemo(() => {
    if (!data?.rows) return { rows: [], footerRow: null };
    const rows = data.rows.map((a, i) => ({
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
    const footerRow = data.grandTotalDebit != null ? {
      accountCode: "", accountName: "Total", groupName: "", headUnder: "",
      debit: data.grandTotalDebit, credit: data.grandTotalCredit, action: null,
    } : null;
    return { rows, footerRow };
  }, [data]);

  const period = fromDate && toDate ? `${fromDate} to ${toDate}` : "";

  const onPDF = useCallback(() => {
    if (!data?.rows) return;
    const bodyRows = data.rows.map((a) => [
      a.accountType || "", a.accountName || "", a.groupName || "", a.headUnder || "",
      formatAmount(a.closingDebit || 0), formatAmount(a.closingCredit || 0),
    ]);
    exportPDF({
      title: "Trial Balance",
      period, project: projectCode || "All",
      filename: "trial_balance",
      head: [["Type", "Account Name", "Group", "Head Under", "Debit", "Credit"]],
      body: bodyRows,
      foot: data.grandTotalDebit != null
        ? [["", "Total", "", "", formatAmount(data.grandTotalDebit), formatAmount(data.grandTotalCredit)]]
        : [],
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
      amountColumns: [4, 5],
    });
  }, [data, period, projectCode]);

  const onExcel = useCallback(() => {
    if (!data?.rows) return;
    const excelRows = data.rows.map((a) => [
      a.accountType || "", a.accountName || "", a.groupName || "", a.headUnder || "",
      a.closingDebit || 0, a.closingCredit || 0,
    ]);
    if (data.grandTotalDebit != null) {
      excelRows.push(["", "Total", "", "", data.grandTotalDebit, data.grandTotalCredit]);
    }
    exportExcel({
      title: "Trial Balance",
      period, project: projectCode || "All",
      filename: "trial_balance",
      sheetName: "Trial Balance",
      headers: ["Type", "Account Name", "Group", "Head Under", "Debit", "Credit"],
      rows: excelRows,
      colWidths: [10, 30, 20, 15, 18, 18],
    });
  }, [data, period, projectCode]);

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
            <AccountingTable columns={COLUMNS} rows={rows} footerRow={footerRow} emptyMessage="No accounts found" />
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
