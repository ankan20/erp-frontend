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
import { fmtDate, getNarrationHint } from "@/components/finance/report/accounting/shared";

const BASE_COLUMNS = [
  { key: "date", label: "Date", className: "w-[100px]" },
  { key: "voucherNo", label: "Voucher No", className: "w-[140px]" },
  { key: "sourceType", label: "Type", className: "w-[130px]" },
  { key: "narration", label: "Narration", className: "min-w-[250px]" },
  { key: "totalDebit", label: "Total Debit", type: "amount", align: "right", className: "w-[120px]" },
  { key: "totalCredit", label: "Total Credit", type: "amount", align: "right", className: "w-[120px]" },
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
  { value: "grn", label: "GRN" },
  { value: "gin", label: "GIN" },
  { value: "sale_claim_bill", label: "Claim Bill" },
  { value: "sale_certified_bill", label: "Certified Bill" },
  { value: "uncertified_statement", label: "Uncertified Statement" },
];

export default function VoucherRegisterPage() {
  const access = getPageAccess({ pageCode: "accounting_voucher_register", pageType: "LIST" });
  const router = useRouter();
  const [sourceType, setSourceType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
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
    const q = searchText.trim().toLowerCase();
    const mapped = data.entries.map((v, i) => {
      const narration = v.remarks || "";
      const row = {
        _key: i,
        _rawDate: v.date || "",
        ...(showProject && { projectCode: v.projectCode || "" }),
        date: fmtDate(v.date),
        voucherNo: v.voucherNo || "",
        sourceType: v.sourceTypeLabel || (v.sourceType || "").replace(/_/g, " "),
        narration,
        _narrationHint: getNarrationHint(narration),
        totalDebit: v.totalDebit,
        totalCredit: v.totalCredit,
      };
      if (q) {
        const haystack = `${row.voucherNo} ${row.sourceType} ${row.date} ${row.narration} ${row.projectCode || ""}`.toLowerCase();
        if (!haystack.includes(q)) return null;
      }
      return row;
    }).filter(Boolean);

    if (sortOrder === "desc") {
      mapped.sort((a, b) => (b._rawDate || "").localeCompare(a._rawDate || ""));
    } else {
      mapped.sort((a, b) => (a._rawDate || "").localeCompare(b._rawDate || ""));
    }
    return mapped;
  }, [data, showProject, searchText, sortOrder]);

  const wrappedFetch = () => handleFetch(sourceType ? { source_type: sourceType } : {});

  const typeFilter = (
    <div className="flex items-center gap-1.5">
      <label className="text-[11.5px] font-medium text-[#6b7280] whitespace-nowrap">Type</label>
      <select
        value={sourceType}
        onChange={(e) => setSourceType(e.target.value)}
        className="h-[28px] w-[160px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors"
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
          onReset={() => { setSourceType(""); setSearchText(""); setSortOrder("desc"); handleReset(); }}
          extraFilters={typeFilter}
          sortOrder={sortOrder}
          onSortToggle={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
        />

        {fetched && !loading && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 max-w-[300px]">
              <Search size={13} className="text-[#9ca3af] shrink-0" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search voucher, type, narration..."
                className="w-full h-[28px] px-2 text-[12px] border border-[#d1d5db] bg-white text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1b2f3a] focus:outline-none transition-colors"
              />
            </div>
            <span className="ml-auto text-[11.5px] text-[#6b7280]">
              {rows.length} voucher{rows.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

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
          <AccountingTable
            columns={columns}
            rows={rows}
            emptyMessage="No vouchers found"
            narrationTooltip
          />
        )}
      </div>
    </HeaderWrapper>
  );
}
