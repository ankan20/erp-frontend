"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {  Search } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";

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
import { exportPDF, exportExcel } from "@/components/finance/report/accounting/exportAccounting";

export default function AccountingProfitLossPage() {
  const access = getPageAccess({ pageCode: "accounting_profit_loss", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.PROFIT_LOSS);

  const [reconcile, setReconcile] = useState(null);

  const onReconcile = useCallback((accountType, accountId, accountName) => {
    setReconcile({ accountType, accountId, accountName });
  }, []);

  const period = fromDate && toDate ? `${fromDate} to ${toDate}` : "";

  const onPDF = useCallback(() => {
    if (!data) return;
    const bodyRows = [];
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let sectionIdx = 0;
    const flattenSection = (label, groups, total) => {
      const sLetter = LETTERS[sectionIdx++] || String(sectionIdx);
      bodyRows.push([`${sLetter}. ${label}`, "", "", ""]);
      let grpIdx = 0;
      (groups || []).forEach((grp) => {
        grpIdx++;
        const grpNum = `${sLetter}.${grpIdx}`;
        bodyRows.push([`  ${grpNum}  ${grp.groupName}`, "", "", formatAmount(grp.total || 0)]);
        let accIdx = 0;
        (grp.accounts || []).forEach((acc) => {
          accIdx++;
          bodyRows.push([`      ${grpNum}.${accIdx}  ${acc.ccCode} - ${acc.ccName}`, formatAmount(acc.debit || 0), formatAmount(acc.credit || 0), formatAmount(acc.net || 0)]);
        });
        let sgIdx = 0;
        (grp.subGroups || []).forEach((sg) => {
          sgIdx++;
          const sgNum = `${grpNum}.${accIdx + sgIdx}`;
          bodyRows.push([`    ${sgNum}  ${sg.subGroupName}`, "", "", formatAmount(sg.total || 0)]);
          let sgAccIdx = 0;
          (sg.accounts || []).forEach((acc) => {
            sgAccIdx++;
            bodyRows.push([`        ${sgNum}.${sgAccIdx}  ${acc.ccCode} - ${acc.ccName}`, formatAmount(acc.debit || 0), formatAmount(acc.credit || 0), formatAmount(acc.net || 0)]);
          });
        });
      });
      bodyRows.push([`  Total ${label}`, "", "", formatAmount(total)]);
    };
    flattenSection("Income / Revenue", data.income, data.totalIncome || 0);
    bodyRows.push(["", "", "", ""]);
    flattenSection("Expenses", data.expense, data.totalExpense || 0);
    const net = (data.totalIncome || 0) - (data.totalExpense || 0);
    bodyRows.push(["", "", "", ""]);
    bodyRows.push([net >= 0 ? "Net Profit" : "Net Loss", "", "", formatAmount(Math.abs(net))]);
    exportPDF({
      title: "Profit & Loss Statement",
      period, project: projectCode || "All",
      filename: "profit_loss",
      head: [["Particulars", "Debit", "Credit", "Amount"]],
      body: bodyRows,
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      amountColumns: [1, 2, 3],
    });
  }, [data, period, projectCode]);

  const onExcel = useCallback(() => {
    if (!data) return;
    const excelRows = [];
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let sectionIdx = 0;
    const flattenSection = (label, groups, total) => {
      const sLetter = LETTERS[sectionIdx++] || String(sectionIdx);
      excelRows.push([`${sLetter}. ${label}`, "", "", ""]);
      let grpIdx = 0;
      (groups || []).forEach((grp) => {
        grpIdx++;
        const grpNum = `${sLetter}.${grpIdx}`;
        excelRows.push([`  ${grpNum}  ${grp.groupName}`, "", "", grp.total || 0]);
        let accIdx = 0;
        (grp.accounts || []).forEach((acc) => {
          accIdx++;
          excelRows.push([`    ${grpNum}.${accIdx}  ${acc.ccCode} - ${acc.ccName}`, acc.debit || 0, acc.credit || 0, acc.net || 0]);
        });
        let sgIdx = 0;
        (grp.subGroups || []).forEach((sg) => {
          sgIdx++;
          const sgNum = `${grpNum}.${accIdx + sgIdx}`;
          excelRows.push([`    ${sgNum}  ${sg.subGroupName}`, "", "", sg.total || 0]);
          let sgAccIdx = 0;
          (sg.accounts || []).forEach((acc) => {
            sgAccIdx++;
            excelRows.push([`      ${sgNum}.${sgAccIdx}  ${acc.ccCode} - ${acc.ccName}`, acc.debit || 0, acc.credit || 0, acc.net || 0]);
          });
        });
      });
      excelRows.push([`  Total ${label}`, "", "", total]);
    };
    flattenSection("Income / Revenue", data.income, data.totalIncome || 0);
    excelRows.push(["", "", "", ""]);
    flattenSection("Expenses", data.expense, data.totalExpense || 0);
    const net = (data.totalIncome || 0) - (data.totalExpense || 0);
    excelRows.push(["", "", "", ""]);
    excelRows.push([net >= 0 ? "Net Profit" : "Net Loss", "", "", Math.abs(net)]);
    exportExcel({
      title: "Profit & Loss Statement",
      period, project: projectCode || "All",
      filename: "profit_loss",
      sheetName: "P&L",
      headers: ["Particulars", "Debit", "Credit", "Amount"],
      rows: excelRows,
      colWidths: [45, 18, 18, 18],
    });
  }, [data, period, projectCode]);

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
            <EdoxMark size={32} />
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
