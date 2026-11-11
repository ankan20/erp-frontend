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

function StatCard({ label, value, bg, border }) {
  return (
    <div className={`${bg} border ${border} rounded-sm p-3`}>
      <div className="text-[11px] text-gray-600">{label}</div>
      <div className="text-[16px] font-bold tabular-nums mt-0.5">{formatAmount(value || 0)}</div>
    </div>
  );
}

export default function ProjectSummaryPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.PROJECT_SUMMARY);

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
        />

        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Select a project and press Fetch to view the Financial Summary
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-[13px] font-semibold text-[#1a1a4e]">
              Project: {data?.projectCode || projectCode}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="CC Code — Debit" value={data?.ccDebit} bg="bg-[#fff3e0]" border="border-[#ffcc80]" />
              <StatCard label="CC Code — Credit" value={data?.ccCredit} bg="bg-[#e8f4e8]" border="border-[#b0d4b0]" />
              <StatCard label="Vendor — Debit" value={data?.vendorDebit} bg="bg-[#fff3e0]" border="border-[#ffcc80]" />
              <StatCard label="Vendor — Credit" value={data?.vendorCredit} bg="bg-[#e8f4e8]" border="border-[#b0d4b0]" />
              <StatCard label="Bank/Cash — Debit" value={data?.bankDebit} bg="bg-[#fff3e0]" border="border-[#ffcc80]" />
              <StatCard label="Bank/Cash — Credit" value={data?.bankCredit} bg="bg-[#e8f4e8]" border="border-[#b0d4b0]" />
            </div>

            <div className="overflow-x-auto border border-[#ccc] rounded-sm">
              <table className="w-full text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-[#e8e8f0]">
                    <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Account Type</th>
                    <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Debit</th>
                    <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Credit</th>
                    <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "CC Codes (Expenses/Revenue)", dr: data?.ccDebit, cr: data?.ccCredit },
                    { label: "Vendors / Customers", dr: data?.vendorDebit, cr: data?.vendorCredit },
                    { label: "Bank / Cash", dr: data?.bankDebit, cr: data?.bankCredit },
                  ].map((r, i) => (
                    <tr key={i} className={`border-b border-[#e0e0e0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}>
                      <td className="px-3 py-1.5">{r.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(r.dr || 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(r.cr || 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount((r.dr || 0) - (r.cr || 0))}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#e8e8f0] font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatAmount((data?.ccDebit || 0) + (data?.vendorDebit || 0) + (data?.bankDebit || 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatAmount((data?.ccCredit || 0) + (data?.vendorCredit || 0) + (data?.bankCredit || 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatAmount(
                        ((data?.ccDebit || 0) + (data?.vendorDebit || 0) + (data?.bankDebit || 0)) -
                        ((data?.ccCredit || 0) + (data?.vendorCredit || 0) + (data?.bankCredit || 0))
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
