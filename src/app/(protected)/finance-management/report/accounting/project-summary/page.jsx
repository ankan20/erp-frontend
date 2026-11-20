"use client";

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

function fmtBalDrCr(val) {
  if (val == null || val === 0) return "—";
  const abs = Math.abs(val);
  const side = val > 0 ? "Dr" : "Cr";
  return `${formatAmount(abs)} ${side}`;
}

function SummaryCard({ label, debit, credit }) {
  const net = (debit || 0) - (credit || 0);
  return (
    <div className="border border-[#d1d5db] bg-[#f8f9fb] p-3">
      <div className="text-[11px] text-[#6b7280] font-medium">{label}</div>
      <div className="flex items-baseline gap-3 mt-1">
        <div>
          <span className="text-[10px] text-[#6b7280]">Dr </span>
          <span className="text-[14px] font-bold tabular-nums text-[#374151]">{formatAmount(debit || 0)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#6b7280]">Cr </span>
          <span className="text-[14px] font-bold tabular-nums text-[#374151]">{formatAmount(credit || 0)}</span>
        </div>
      </div>
      <div className="mt-1 text-[12px] font-semibold tabular-nums text-[#144664]">
        Net: {fmtBalDrCr(net)}
      </div>
    </div>
  );
}

export default function ProjectSummaryPage() {
  const access = getPageAccess({ pageCode: "accounting_project_summary", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.PROJECT_SUMMARY);

  const actions = usePageActions({ router });

  const ccDr = data?.ccDebit || 0;
  const ccCr = data?.ccCredit || 0;
  const credDr = data?.creditorDebit || 0;
  const credCr = data?.creditorCredit || 0;
  const debtDr = data?.debtorDebit || 0;
  const debtCr = data?.debtorCredit || 0;
  const bankDr = data?.bankDebit || 0;
  const bankCr = data?.bankCredit || 0;

  // fallback: if backend hasn't been updated yet, use vendorDebit/Credit for creditors
  const hasDebtorCreditorSplit = data && ("creditorDebit" in data || "debtorDebit" in data);

  const rows = hasDebtorCreditorSplit
    ? [
        { label: "CC Codes (Expenses / Revenue)", dr: ccDr, cr: ccCr },
        { label: "Sundry Creditors (Vendors)", dr: credDr, cr: credCr },
        { label: "Sundry Debtors (Customers)", dr: debtDr, cr: debtCr },
        { label: "Bank / Cash", dr: bankDr, cr: bankCr },
      ]
    : [
        { label: "CC Codes (Expenses / Revenue)", dr: ccDr, cr: ccCr },
        { label: "Vendors / Customers", dr: data?.vendorDebit || 0, cr: data?.vendorCredit || 0 },
        { label: "Bank / Cash", dr: bankDr, cr: bankCr },
      ];

  const totalDr = rows.reduce((s, r) => s + r.dr, 0);
  const totalCr = rows.reduce((s, r) => s + r.cr, 0);

  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — Project Summary</h2>

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
            Select filters and press Fetch to view the Financial Summary
          </div>
        ) : (
          <div className="space-y-3">
            {data?.projectCode && (
              <div className="text-[12px] text-[#6b7280]">
                Project: <span className="font-semibold text-[#144664]">{data.projectCode}</span>
              </div>
            )}

            {/* Summary Cards */}
            <div className={`grid gap-3 ${hasDebtorCreditorSplit ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
              <SummaryCard label="CC Codes" debit={ccDr} credit={ccCr} />
              {hasDebtorCreditorSplit ? (
                <>
                  <SummaryCard label="Sundry Creditors" debit={credDr} credit={credCr} />
                  <SummaryCard label="Sundry Debtors" debit={debtDr} credit={debtCr} />
                </>
              ) : (
                <SummaryCard label="Vendors / Customers" debit={data?.vendorDebit} credit={data?.vendorCredit} />
              )}
              <SummaryCard label="Bank / Cash" debit={bankDr} credit={bankCr} />
            </div>

            {/* Detail Table */}
            <div className="border border-[#d1d5db] overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#1b2f3a]">
                    <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">Account Type</th>
                    <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[130px]">Total Debit</th>
                    <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[130px]">Total Credit</th>
                    <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] w-[140px]">Net Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const net = r.dr - r.cr;
                    return (
                      <tr key={i} className={`border-b border-[#e5e7eb] ${i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f4f8] transition-colors`}>
                        <td className="px-2 py-[5px] font-medium text-[#374151] border-r border-[#f0f0f0]">{r.label}</td>
                        <td className="px-2 py-[5px] text-right tabular-nums text-[#374151] border-r border-[#f0f0f0]">{formatAmount(r.dr)}</td>
                        <td className="px-2 py-[5px] text-right tabular-nums text-[#374151] border-r border-[#f0f0f0]">{formatAmount(r.cr)}</td>
                        <td className="px-2 py-[5px] text-right tabular-nums font-medium text-[#374151]">{fmtBalDrCr(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1b2f3a] text-white text-[11.5px] font-medium">
                    <td className="px-2 py-[5px] border-r border-[#2a4a5a]">Grand Total</td>
                    <td className="px-2 py-[5px] text-right tabular-nums border-r border-[#2a4a5a]">{formatAmount(totalDr)}</td>
                    <td className="px-2 py-[5px] text-right tabular-nums border-r border-[#2a4a5a]">{formatAmount(totalCr)}</td>
                    <td className="px-2 py-[5px] text-right tabular-nums">{fmtBalDrCr(totalDr - totalCr)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
