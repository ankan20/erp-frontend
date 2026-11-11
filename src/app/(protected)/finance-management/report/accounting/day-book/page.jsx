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

import AccountingFilterBar from "@/components/finance/report/accounting/AccountingFilterBar";
import AccountingTable from "@/components/finance/report/accounting/AccountingTable";
import useAccountingFetch from "@/components/finance/report/accounting/useAccountingFetch";

const COLUMNS = [
  { key: "voucherNo", label: "Voucher No" },
  { key: "sourceType", label: "Type" },
  { key: "date", label: "Date" },
  { key: "accountCode", label: "Account" },
  { key: "accountName", label: "Account Name", className: "min-w-[180px]" },
  { key: "narration", label: "Narration", className: "min-w-[200px]" },
  { key: "debit", label: "Debit", type: "amount", align: "right" },
  { key: "credit", label: "Credit", type: "amount", align: "right" },
];

export default function DayBookPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.DAY_BOOK);

  const rows = useMemo(() => {
    if (!data?.entries) return [];
    const flat = [];
    data.entries.forEach((e) => {
      (e.lines || []).forEach((line, li) => {
        flat.push({
          _key: `${e.postingId}-${li}`,
          voucherNo: li === 0 ? (e.voucherNo || "") : "",
          sourceType: li === 0 ? (e.sourceTypeLabel || e.sourceType || "").replace(/_/g, " ") : "",
          date: li === 0 ? (e.date || "") : "",
          accountCode: line.accountType || "",
          accountName: line.accountName || "",
          narration: line.narration || (li === 0 ? e.remarks || "" : ""),
          debit: line.drCr === "Dr" ? line.amount : null,
          credit: line.drCr === "Cr" ? line.amount : null,
        });
      });
    });
    return flat;
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
            Choose a date range and press Fetch to view the Day Book
          </div>
        ) : (
          <AccountingTable columns={COLUMNS} rows={rows} emptyMessage="No entries for this date" />
        )}
      </div>
    </HeaderWrapper>
  );
}
