"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { toast } from "sonner";

import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import SearchableSelect   from "@/components/common/SearchableSelect";
import { usePageActions } from "@/components/common/PageActionButtons";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import { formatAmount }   from "@/helper/numberFormatter";
import AccountingTable    from "@/components/finance/report/accounting/AccountingTable";
import { FilterLabel, SummaryBox, fmt, fmtDate, getNarrationHint, ShowCancelledToggle, cancelRowProps } from "@/components/finance/report/accounting/shared";

function fmtBalDrCr(val) {
  if (val == null || val === 0) return "—";
  const abs = Math.abs(val);
  const side = val > 0 ? "Dr" : "Cr";
  return `${formatAmount(abs)} ${side}`;
}

const COLUMNS = [
  { key: "sl",       label: "#",          className: "w-[40px]" },
  { key: "date",     label: "Date",       className: "w-[90px]" },
  { key: "source",   label: "Source",      className: "w-[120px]" },
  { key: "docNo",    label: "Doc No",      className: "w-[140px]" },
  { key: "narration", label: "Narration",  className: "min-w-[200px]" },
  { key: "debit",    label: "Debit (Dr)",  type: "amount", align: "right", className: "w-[110px]" },
  { key: "credit",   label: "Credit (Cr)", type: "amount", align: "right", className: "w-[110px]" },
  { key: "balance",  label: "Balance",     align: "right", className: "w-[130px]" },
];

export default function CustomerLedgerPage() {
  const access = getPageAccess({ pageCode: "accounting_customer_ledger", pageType: "LIST" });
  const router  = useRouter();
  const actions = usePageActions({ router });

  const [customerId, setCustomerId]   = useState("");
  const [fromDate, setFromDate]       = useState("");
  const [toDate, setToDate]           = useState("");
  const [searchText, setSearchText]   = useState("");
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [fetched, setFetched]         = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [customerList, setCustomerList] = useState([]);

  useEffect(() => {
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_LEDGER}?type=debtor`, method: "GET" })
      .then((res) => setCustomerList(res?.data || []))
      .catch(() => {});
  }, []);

  const handleFetch = useCallback(async (includeCancelled = showCancelled) => {
    if (!customerId) { toast.error("Please select a customer"); return; }
    setLoading(true); setFetched(false);
    try {
      const params = new URLSearchParams();
      params.set("vendor_id", customerId);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate)   params.set("to_date", toDate);
      if (includeCancelled) params.set("include_cancelled", "true");
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.CUSTOMER_LEDGER}?${params}`,
        method: "GET",
      });
      setData(res?.data ?? null); setFetched(true);
    } catch (err) {
      setData(null); toast.error(err?.message || "Failed to fetch customer ledger");
    } finally { setLoading(false); }
  }, [customerId, fromDate, toDate, showCancelled]);

  const handleReset = () => {
    setShowCancelled(false);
    setCustomerId(""); setFromDate(""); setToDate(""); setSearchText("");
    setData(null); setFetched(false);
  };

  const entries = data?.entries || [];
  const rows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return entries
      .map((e, i) => {
        const row = {
          _key: i, sl: i + 1, ...cancelRowProps(e),
          date: fmtDate(e.date),
          source: (e.sourceType || "").replace(/_/g, " "),
          docNo: e.voucherNo || "",
          narration: e.narration || "",
          _narrationHint: getNarrationHint(e.narration),
          debit: e.debit, credit: e.credit,
          balance: fmtBalDrCr(e.balance),
        };
        if (q) {
          const haystack = `${row.docNo} ${row.source} ${row.date} ${row.narration}`.toLowerCase();
          if (!haystack.includes(q)) return null;
        }
        return row;
      })
      .filter(Boolean);
  }, [entries, searchText]);


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — Customer Ledger</h2>

        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <FilterLabel>Customer</FilterLabel>
            <div className="w-[280px]">
              <SearchableSelect options={customerList} value={customerId} onChange={setCustomerId}
                labelKey={["ledgerCode", "ledgerName"]} labelSeparator=" : " valueKey="ledgerId"
                placeholder="Select customer…" searchKeys={["ledgerCode", "ledgerName"]} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>From</FilterLabel>
            <input type="date" value={fromDate} max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-[28px] w-[130px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>To</FilterLabel>
            <input type="date" value={toDate} min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="h-[28px] w-[130px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors" />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => handleFetch()} disabled={loading}
              className="flex items-center gap-1 px-3 py-[5px] bg-[#1b2f3a] hover:bg-[#263f4d] text-white text-[12px] font-medium disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Fetch
            </button>
            {fetched && (
              <button onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-[5px] border border-[#d1d5db] text-[12px] text-[#4b5563] hover:bg-[#f3f4f6] transition-colors">
                <RefreshCw size={12} /> Reset
              </button>
            )}
          </div>
        </div>

        {fetched && !loading && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 max-w-[300px]">
              <Search size={13} className="text-[#9ca3af] shrink-0" />
              <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search voucher, narration..."
                className="w-full h-[28px] px-2 text-[12px] border border-[#d1d5db] bg-white text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1b2f3a] focus:outline-none transition-colors" />
            </div>
            <span className="ml-auto"><ShowCancelledToggle checked={showCancelled} count={data?.cancelledCount}
              onChange={(v) => { setShowCancelled(v); handleFetch(v); }} /></span>
            <span className="text-[11.5px] text-[#6b7280]">
              {rows.length} entr{rows.length !== 1 ? "ies" : "y"}
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-[300px]"><EdoxMark size={32} /></div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" /> Select a customer and press Fetch
          </div>
        ) : (
          <>
            {(data?.openingBalance != null || data?.totalDebit != null) && (
              <SummaryBox items={[
                { label: "Opening", value: fmtBalDrCr(data?.openingBalance), text: "text-[#3030a3]" },
                { label: "Total Debit", value: fmt(data?.totalDebit), text: "text-[#a32020]" },
                { label: "Total Credit", value: fmt(data?.totalCredit), text: "text-[#2d7a2d]" },
                { label: "Closing", value: fmtBalDrCr(data?.closingBalance), text: "text-[#6b3000] font-bold" },
              ]} />
            )}
            <AccountingTable columns={COLUMNS} rows={rows} emptyMessage="No customer ledger entries" narrationTooltip />
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
