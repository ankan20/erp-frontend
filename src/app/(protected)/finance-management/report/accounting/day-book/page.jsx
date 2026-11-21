"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import { usePageActions } from "@/components/common/PageActionButtons";
import { API_ENDPOINTS } from "@/config/api.config";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

import AccountingFilterBar from "@/components/finance/report/accounting/AccountingFilterBar";
import AccountingTable from "@/components/finance/report/accounting/AccountingTable";
import useAccountingFetch from "@/components/finance/report/accounting/useAccountingFetch";
import { SourceTypeBadge, getNarrationHint, ShowCancelledToggle, cancelRowProps } from "@/components/finance/report/accounting/shared";

const SOURCE_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "purchase_bill", label: "Purchase Bill" },
  { value: "payment_voucher", label: "Payment Voucher" },
  { value: "bill_payment", label: "Bill Payment" },
  { value: "sale_bill", label: "Sale Bill" },
  { value: "sale_receipt_billing", label: "Sale Receipt" },
  { value: "journal_entry", label: "Journal Entry" },
  { value: "contra_entry", label: "Contra Entry" },
  { value: "debit_note", label: "Debit Note" },
  { value: "credit_note", label: "Credit Note" },
  { value: "petty_cash_docket", label: "Petty Cash Docket" },
  { value: "grn", label: "GRN" },
  { value: "gin", label: "GIN" },
  { value: "sale_claim_bill", label: "Claim Bill" },
  { value: "sale_certified_bill", label: "Certified Bill" },
  { value: "uncertified_statement", label: "Uncertified Statement" },
];

const BASE_COLUMNS = [
  { key: "voucherNo", label: "Voucher No" },
  { key: "sourceType", label: "Type" },
  { key: "date", label: "Date" },
  { key: "accountCode", label: "Account" },
  { key: "accountName", label: "Account Name", className: "min-w-[180px]" },
  { key: "narration", label: "Narration", className: "min-w-[200px]" },
  { key: "debit", label: "Debit", type: "amount", align: "right" },
  { key: "credit", label: "Credit", type: "amount", align: "right" },
];
const PROJECT_COL = { key: "projectCode", label: "Project", className: "w-[100px]" };

export default function DayBookPage() {
  const access = getPageAccess({ pageCode: "accounting_day_book", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, extraParams, setExtraParams,
    handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.DAY_BOOK);

  const [searchText, setSearchText] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const sourceType = extraParams.source_type || "";
  const showCancelled = extraParams.include_cancelled === "true";
  const toggleCancelled = (v) => {
    const val = v ? "true" : "";
    setExtraParams((prev) => ({ ...prev, include_cancelled: val }));
    handleFetch({ include_cancelled: val });
  };

  const setSourceType = (val) => {
    setExtraParams((prev) => ({ ...prev, source_type: val || "" }));
  };

  const showProject = !projectCode;
  const columns = useMemo(
    () => (showProject ? [PROJECT_COL, ...BASE_COLUMNS] : BASE_COLUMNS),
    [showProject],
  );

  const rows = useMemo(() => {
    if (!data?.entries) return [];
    const q = searchText.trim().toLowerCase();
    const entries = sortOrder === "asc" ? [...data.entries].reverse() : data.entries;
    const flat = [];
    entries.forEach((e) => {
      (e.lines || []).forEach((line, li) => {
        const narration = line.narration || (li === 0 ? e.remarks || "" : "");
        const row = {
          _key: `${e.postingId}-${li}`,
          ...cancelRowProps(e),
          ...(showProject && { projectCode: li === 0 ? (e.projectCode || "") : "" }),
          voucherNo: li === 0 ? (e.voucherNo || "") : "",
          sourceType: li === 0 ? (e.sourceTypeLabel || e.sourceType || "").replace(/_/g, " ") : "",
          date: li === 0 ? (e.date ? getfmtDisplaydate(e.date) : "") : "",
          accountCode: line.accountType || "",
          accountName: line.accountName || "",
          narration,
          _narrationHint: getNarrationHint(narration),
          debit: line.drCr === "Dr" ? line.amount : null,
          credit: line.drCr === "Cr" ? line.amount : null,
        };

        if (q) {
          const haystack = `${row.voucherNo} ${row.sourceType} ${row.date} ${row.accountCode} ${row.accountName} ${row.narration} ${row.projectCode || ""}`.toLowerCase();
          if (!haystack.includes(q)) return;
        }

        flat.push(row);
      });
    });
    return flat;
  }, [data, showProject, searchText, sortOrder]);

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
          onReset={() => { handleReset(); setSearchText(""); setSortOrder("desc"); }}
          sortOrder={sortOrder}
          onSortToggle={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
          extraFilters={
            <div className="flex items-center gap-1.5">
              <label className="text-[11.5px] font-medium text-[#6b7280] whitespace-nowrap">Type</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="h-[28px] w-[160px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors"
              >
                {SOURCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          }
        />

        {fetched && !loading && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 max-w-[300px]">
              <Search size={13} className="text-[#9ca3af] shrink-0" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search voucher, account, narration..."
                className="w-full h-[28px] px-2 text-[12px] border border-[#d1d5db] bg-white text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1b2f3a] focus:outline-none transition-colors"
              />
            </div>
            <span className="ml-auto"><ShowCancelledToggle checked={showCancelled}
              count={data?.cancelledCount} onChange={toggleCancelled} /></span>
            <span className="text-[11.5px] text-[#6b7280]">
              {rows.length} line{rows.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <EdoxMark size={32} />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Choose a date range and press Fetch to view the Day Book
          </div>
        ) : (
          <AccountingTable
            columns={columns}
            rows={rows}
            emptyMessage="No entries for this date"
            narrationTooltip
          />
        )}
      </div>
    </HeaderWrapper>
  );
}
