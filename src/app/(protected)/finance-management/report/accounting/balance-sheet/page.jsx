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
import { exportPDF, exportExcel } from "@/components/finance/report/accounting/exportAccounting";

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
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.BALANCE_SHEET);

  const [reconcile, setReconcile] = useState(null);

  const onReconcile = useCallback((accountType, accountId, accountName) => {
    setReconcile({ accountType, accountId, accountName });
  }, []);

  const period = fromDate && toDate ? `${fromDate} to ${toDate}` : "";

  const flattenBSSection = (sectionLetter, label, groups, total, fmtFn) => {
    const rows = [];
    rows.push([`${sectionLetter}. ${label}`, "", "", ""]);
    let grpIdx = 0;
    (groups || []).forEach((grp) => {
      grpIdx++;
      const grpNum = `${sectionLetter}.${grpIdx}`;
      rows.push([`  ${grpNum}  ${grp.groupName}`, "", "", fmtFn(grp.total || 0)]);
      let accIdx = 0;
      (grp.accounts || []).forEach((acc) => {
        accIdx++;
        rows.push([`      ${grpNum}.${accIdx}  ${acc.ccCode} - ${acc.ccName}`, fmtFn(acc.debit || 0), fmtFn(acc.credit || 0), fmtFn(acc.net || 0)]);
      });
      let sgIdx = 0;
      (grp.subGroups || []).forEach((sg) => {
        sgIdx++;
        const sgNum = `${grpNum}.${accIdx + sgIdx}`;
        rows.push([`    ${sgNum}  ${sg.subGroupName}`, "", "", fmtFn(sg.total || 0)]);
        let sgAccIdx = 0;
        (sg.accounts || []).forEach((acc) => {
          sgAccIdx++;
          rows.push([`        ${sgNum}.${sgAccIdx}  ${acc.ccCode} - ${acc.ccName}`, fmtFn(acc.debit || 0), fmtFn(acc.credit || 0), fmtFn(acc.net || 0)]);
        });
      });
    });
    rows.push([`  Total ${label}`, "", "", fmtFn(total || 0)]);
    return rows;
  };

  const onPDF = useCallback(() => {
    if (!data) return;
    const bodyRows = [
      ...flattenBSSection("A", "Assets", data.assetGroups, data.totalAssets, formatAmount),
      ["", "", "", ""],
      ...flattenBSSection("B", "Equity & Liabilities", data.liabilityGroups, data.totalLiabilities, formatAmount),
    ];
    if (data.difference != null && Math.abs(data.difference) > 0.01) {
      bodyRows.push(["", "", "", ""]);
      bodyRows.push(["Difference", "", "", formatAmount(data.difference)]);
    }
    exportPDF({
      title: "Balance Sheet",
      period, project: projectCode || "All",
      filename: "balance_sheet",
      head: [["Particulars", "Debit", "Credit", "Balance"]],
      body: bodyRows,
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      amountColumns: [1, 2, 3],
    });
  }, [data, period, projectCode]);

  const onExcel = useCallback(() => {
    if (!data) return;
    const raw = (v) => v || 0;
    const excelRows = [
      ...flattenBSSection("A", "Assets", data.assetGroups, data.totalAssets, raw),
      ["", "", "", ""],
      ...flattenBSSection("B", "Equity & Liabilities", data.liabilityGroups, data.totalLiabilities, raw),
    ];
    if (data.difference != null && Math.abs(data.difference) > 0.01) {
      excelRows.push(["", "", "", ""]);
      excelRows.push(["Difference", "", "", data.difference]);
    }
    exportExcel({
      title: "Balance Sheet",
      period, project: projectCode || "All",
      filename: "balance_sheet",
      sheetName: "Balance Sheet",
      headers: ["Particulars", "Debit", "Credit", "Balance"],
      rows: excelRows,
      colWidths: [45, 18, 18, 18],
    });
  }, [data, period, projectCode]);

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
            {data?.difference != null && Math.abs(data.difference) > 0.01 && (
              <div className="border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b]" />
                    <span className="text-[12px] font-semibold text-[#1e293b]">
                      Balance Sheet Difference: {formatAmount(data.difference)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748b] leading-relaxed pl-4">
                    Assets ({formatAmount(data.totalAssets)}) − Equity &amp; Liabilities ({formatAmount(data.totalLiabilities)}).
                    This difference arises because the Net Profit / Loss is included under Equity
                    while the same income &amp; expense accounts are already reflected in their
                    respective Balance Sheet groups. Excluding the P&amp;L figure from Equity would
                    bring the totals into balance.
                  </div>
                </div>
              </div>
            )}

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
