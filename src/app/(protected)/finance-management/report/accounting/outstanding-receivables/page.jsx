"use client";

import { useMemo } from "react";
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
import AccountingTable from "@/components/finance/report/accounting/AccountingTable";
import useAccountingFetch from "@/components/finance/report/accounting/useAccountingFetch";

const COLUMNS = [
  { key: "customerCode", label: "Customer Code" },
  { key: "customerName", label: "Customer Name", className: "min-w-[200px]" },
  { key: "balance", label: "Outstanding", type: "amount", align: "right" },
];

export default function OutstandingReceivablesPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.OUTSTANDING_RECEIVABLES);

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    const result = data.rows.map((c, i) => ({
      _key: i,
      customerCode: c.ledgerCode || "",
      customerName: c.ledgerName || "",
      balance: c.outstanding,
    }));
    if (data.total != null) {
      result.push({
        _key: "total", _highlight: true,
        customerCode: "", customerName: "GRAND TOTAL",
        balance: data.total,
      });
    }
    return result;
  }, [data]);

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
            Press Fetch to view Outstanding Receivables
          </div>
        ) : (
          <>
            {data?.total != null && (
              <div className="flex gap-3 text-[12px]">
                <span className="px-3 py-1 bg-[#e8f4e8] rounded border border-[#b0d4b0] font-semibold">
                  Total Receivable: {formatAmount(Math.abs(data.total))}
                </span>
              </div>
            )}
            <AccountingTable columns={COLUMNS} rows={rows} emptyMessage="No outstanding receivables" />
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
