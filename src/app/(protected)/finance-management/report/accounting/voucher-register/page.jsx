"use client";

import { useMemo, useState } from "react";
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

const BASE_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "voucherNo", label: "Voucher No" },
  { key: "sourceType", label: "Type" },
  { key: "narration", label: "Narration", className: "min-w-[250px]" },
  { key: "totalDebit", label: "Total Debit", type: "amount", align: "right" },
  { key: "totalCredit", label: "Total Credit", type: "amount", align: "right" },
  { key: "linesCount", label: "Lines", align: "right" },
];
const PROJECT_COL = { key: "projectCode", label: "Project", className: "w-[100px]" };

const SOURCE_TYPES = [
  { value: "", label: "All Types" },
  { value: "purchase_bill", label: "Purchase Bill" },
  { value: "payment_voucher", label: "Payment Voucher" },
  { value: "bill_payment", label: "Bill Payment" },
  { value: "sale_bill", label: "Sale Bill" },
  { value: "sale_receipt_billing", label: "Sale Receipt Billing" },
  { value: "journal_entry", label: "Journal Entry" },
  { value: "contra_entry", label: "Contra Entry" },
  { value: "debit_note", label: "Debit Note" },
  { value: "credit_note", label: "Credit Note" },
  { value: "petty_cash_docket", label: "Petty Cash Docket" },
];

export default function VoucherRegisterPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const [sourceType, setSourceType] = useState("");
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.VOUCHER_REGISTER);

  const showProject = !projectCode;
  const columns = useMemo(
    () => (showProject ? [PROJECT_COL, ...BASE_COLUMNS] : BASE_COLUMNS),
    [showProject],
  );

  const rows = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries.map((v, i) => ({
      _key: i,
      ...(showProject && { projectCode: v.projectCode || "" }),
      date: v.date || "",
      voucherNo: v.voucherNo || "",
      sourceType: v.sourceTypeLabel || (v.sourceType || "").replace(/_/g, " "),
      narration: v.remarks || "",
      totalDebit: v.totalDebit,
      totalCredit: v.totalCredit,
      linesCount: v.isReversal ? "REV" : "",
    }));
  }, [data, showProject]);

  const wrappedFetch = () => handleFetch(sourceType ? { source_type: sourceType } : {});

  const typeFilter = (
    <div className="flex items-center gap-2">
      <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] leading-5 rounded-sm whitespace-nowrap shrink-0">
        Type
      </div>
      <select
        value={sourceType}
        onChange={(e) => setSourceType(e.target.value)}
        className="h-7 border border-[#8f8f8f] px-2 text-sm rounded-sm"
      >
        {SOURCE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </div>
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
          onFetch={wrappedFetch}
          onReset={() => { setSourceType(""); handleReset(); }}
          extraFilters={typeFilter}
        />

        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Choose filters and press Fetch to view the Voucher Register
          </div>
        ) : (
          <AccountingTable columns={columns} rows={rows} emptyMessage="No vouchers found" />
        )}
      </div>
    </HeaderWrapper>
  );
}
