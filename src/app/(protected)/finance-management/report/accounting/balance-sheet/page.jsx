"use client";

import { useCallback, useMemo, useState } from "react";
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
import AccountingTreeTable from "@/components/finance/report/accounting/AccountingTreeTable";
import ReconciliationModal from "@/components/finance/report/accounting/ReconciliationModal";

function buildExtraRows(data, side, onReconcile) {
  if (!data) return [];
  const rows = [];

  if (side === "asset") {
    (data.vendorAssets || []).forEach((v) => {
      rows.push({
        label: v.name,
        code: v.code,
        balance: v.balance,
        bgCls: "bg-[#f8fafc]",
        expandable: true,
        details: (v.details || []).map((d) => ({ ...d, accountType: "Vendor" })),
      });
    });
    if (data.bankAssets?.length > 0) {
      data.bankAssets.forEach((b) => {
        rows.push({
          label: b.name,
          code: b.code,
          balance: b.balance,
          bgCls: "bg-[#f8fafc]",
          onReconcile: onReconcile
            ? () => onReconcile("BankCash", b.id, `${b.code} - ${b.name}`)
            : null,
        });
      });
    }
    if (data.plResult && data.plResult.code === "NET_LOSS") {
      rows.push({
        label: data.plResult.name,
        code: "P&L",
        balance: data.plResult.balance,
        bgCls: "bg-[#fef2f2]",
      });
    }
  }

  if (side === "liability") {
    (data.vendorLiabilities || []).forEach((v) => {
      rows.push({
        label: v.name,
        code: v.code,
        balance: v.balance,
        bgCls: "bg-[#f8fafc]",
        expandable: true,
        details: (v.details || []).map((d) => ({ ...d, accountType: "Vendor" })),
      });
    });
    if (data.bankLiabilities?.length > 0) {
      data.bankLiabilities.forEach((b) => {
        rows.push({
          label: b.name,
          code: b.code,
          balance: b.balance,
          bgCls: "bg-[#f8fafc]",
          onReconcile: onReconcile
            ? () => onReconcile("BankCash", b.id, `${b.code} - ${b.name}`)
            : null,
        });
      });
    }
    if (data.plResult && data.plResult.code === "NET_PROFIT") {
      rows.push({
        label: data.plResult.name,
        code: "P&L",
        balance: data.plResult.balance,
        bgCls: "bg-[#f0fdf4]",
      });
    }
  }

  return rows;
}

export default function AccountingBalanceSheetPage() {
  const access = getPageAccess({ pageCode: "accounting_balance_sheet", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset, handleExport,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.BALANCE_SHEET);

  const [reconcile, setReconcile] = useState(null);

  const onReconcile = useCallback((accountType, accountId, accountName) => {
    setReconcile({ accountType, accountId, accountName });
  }, []);

  const onPDF = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.BALANCE_SHEET, "pdf"),
    [handleExport],
  );
  const onExcel = useCallback(
    () => handleExport(API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.BALANCE_SHEET, "excel"),
    [handleExport],
  );

  const actions = usePageActions({ router });

  const assetExtras = useMemo(
    () => buildExtraRows(data, "asset", onReconcile),
    [data, onReconcile],
  );
  const liabilityExtras = useMemo(
    () => buildExtraRows(data, "liability", onReconcile),
    [data, onReconcile],
  );

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

            {data?.difference != null && Math.abs(data.difference) > 0.01 && (
              <div className="px-4 py-2 bg-[#fffbeb] border border-[#fde68a] text-[12px] text-[#92400e] font-medium">
                Difference (Assets − Liabilities): {formatAmount(data.difference)}
              </div>
            )}
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
