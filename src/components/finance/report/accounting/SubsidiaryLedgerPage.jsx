"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { usePageActions } from "@/components/common/PageActionButtons";
import { formatAmount } from "@/helper/numberFormatter";

import AccountingFilterBar from "./AccountingFilterBar";
import AccountingTable from "./AccountingTable";
import useAccountingFetch from "./useAccountingFetch";

const LEDGER_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "voucherNo", label: "Voucher No" },
  { key: "sourceType", label: "Type" },
  { key: "accountCode", label: "Account" },
  { key: "accountName", label: "Account Name", className: "min-w-[180px]" },
  { key: "narration", label: "Narration", className: "min-w-[200px]" },
  { key: "debit", label: "Debit", type: "amount", align: "right" },
  { key: "credit", label: "Credit", type: "amount", align: "right" },
  { key: "balance", label: "Balance", type: "amount", align: "right" },
];

export default function SubsidiaryLedgerPage({ endpoint, title, emptyPrompt }) {
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(endpoint);

  const rows = useMemo(() => {
    if (!data?.entries) return [];
    const result = [];
    if (data.openingBalance != null) {
      result.push({
        _key: "ob", _highlight: true,
        date: "", voucherNo: "", sourceType: "", accountCode: "",
        accountName: "Opening Balance", narration: "",
        debit: data.openingBalance > 0 ? data.openingBalance : null,
        credit: data.openingBalance < 0 ? Math.abs(data.openingBalance) : null,
        balance: data.openingBalance,
      });
    }
    data.entries.forEach((e, i) => {
      result.push({
        _key: i,
        date: e.date || "",
        voucherNo: e.voucherNo || "",
        sourceType: (e.sourceType || "").replace(/_/g, " "),
        accountCode: e.accountCode || "",
        accountName: e.accountName || "",
        narration: e.narration || "",
        debit: e.debit,
        credit: e.credit,
        balance: e.runningBalance,
      });
    });
    if (data.closingBalance != null) {
      result.push({
        _key: "cb", _highlight: true,
        date: "", voucherNo: "", sourceType: "", accountCode: "",
        accountName: "Closing Balance", narration: "",
        debit: data.closingBalance > 0 ? data.closingBalance : null,
        credit: data.closingBalance < 0 ? Math.abs(data.closingBalance) : null,
        balance: data.closingBalance,
      });
    }
    return result;
  }, [data]);

  const actions = usePageActions({ router });

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
            {emptyPrompt || `Choose filters and press Fetch to view the ${title}`}
          </div>
        ) : (
          <>
            {data?.totalDebit != null && (
              <div className="flex flex-wrap gap-3 text-[12px]">
                <span className="px-3 py-1 bg-[#e8f4e8] rounded border border-[#b0d4b0]">
                  Total Debit: <strong>{formatAmount(data.totalDebit)}</strong>
                </span>
                <span className="px-3 py-1 bg-[#fce8e8] rounded border border-[#f0b0b0]">
                  Total Credit: <strong>{formatAmount(data.totalCredit)}</strong>
                </span>
              </div>
            )}
            <AccountingTable columns={LEDGER_COLUMNS} rows={rows} emptyMessage={`No ${title.toLowerCase()} entries`} />
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
