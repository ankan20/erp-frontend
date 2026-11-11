"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import SearchableSelect   from "@/components/common/SearchableSelect";
import { usePageActions } from "@/components/common/PageActionButtons";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import AccountingTable    from "@/components/finance/report/accounting/AccountingTable";
import { FilterLabel, SummaryBox, fmt, fmtDate } from "@/components/finance/report/accounting/shared";

const COLUMNS = [
  { key: "sl",       label: "#",          className: "w-[40px]" },
  { key: "date",     label: "Date",       className: "w-[90px]" },
  { key: "source",   label: "Source",      className: "w-[120px]" },
  { key: "docNo",    label: "Doc No",      className: "w-[140px]" },
  { key: "narration", label: "Narration",  className: "min-w-[200px]" },
  { key: "debit",    label: "Debit (Dr)",  type: "amount", align: "right", className: "w-[110px]" },
  { key: "credit",   label: "Credit (Cr)", type: "amount", align: "right", className: "w-[110px]" },
  { key: "balance",  label: "Balance",     type: "amount", align: "right", className: "w-[130px]" },
];

export default function CCLedgerPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router  = useRouter();
  const actions = usePageActions({ router });

  const [ccId, setCcId]           = useState("");
  const [fromDate, setFromDate]   = useState("");
  const [toDate, setToDate]       = useState("");
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [fetched, setFetched]     = useState(false);
  const [ccList, setCcList]       = useState([]);

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE, method: "GET" })
      .then((res) => setCcList(res?.data || []))
      .catch(() => {});
  }, []);

  const handleFetch = useCallback(async () => {
    if (!ccId) { toast.error("Please select a CC code"); return; }
    setLoading(true); setFetched(false);
    try {
      const params = new URLSearchParams();
      params.set("cc_id", ccId);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate)   params.set("to_date", toDate);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.CC_LEDGER}?${params}`,
        method: "GET",
      });
      setData(res?.data ?? null); setFetched(true);
    } catch (err) {
      setData(null); toast.error(err?.message || "Failed to fetch CC ledger");
    } finally { setLoading(false); }
  }, [ccId, fromDate, toDate]);

  const handleReset = () => {
    setCcId(""); setFromDate(""); setToDate("");
    setData(null); setFetched(false);
  };

  const entries = data?.entries || [];
  const rows = entries.map((e, i) => ({
    _key: i, sl: i + 1,
    date: fmtDate(e.date),
    source: (e.sourceType || "").replace(/_/g, " "),
    docNo: e.voucherNo || "",
    narration: e.narration || "",
    debit: e.debit, credit: e.credit,
    balance: e.balance,
  }));


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — CC Code Ledger</h2>
        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <FilterLabel>CC Code</FilterLabel>
            <div className="w-[280px]">
              <SearchableSelect options={ccList} value={ccId} onChange={setCcId}
                labelKey={["ccCode", "ccName"]} labelSeparator=" : " valueKey="ccId"
                placeholder="Select CC code…" searchKeys={["ccCode", "ccName"]} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>From</FilterLabel>
            <input type="date" value={fromDate} max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm" />
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>To</FilterLabel>
            <input type="date" value={toDate} min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleFetch} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Fetch
            </button>
            {fetched && (
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1 border border-[#8f8f8f] text-[13px] rounded-sm hover:bg-gray-100 transition-colors">
                <RefreshCw size={13} /> Reset
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[300px]"><Loader2 className="animate-spin w-6 h-6 text-[#144664]" /></div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" /> Select a CC code and press Fetch
          </div>
        ) : (
          <>
            {(data?.openingBalance != null || data?.totalDebit != null) && (
              <SummaryBox items={[
                { label: "Opening", value: fmt(data?.openingBalance), bg: "bg-[#e8eaff]", vBg: "bg-[#d0d4ff]", text: "text-[#3030a3]" },
                { label: "Total Debit", value: fmt(data?.totalDebit), bg: "bg-[#fce8e8]", vBg: "bg-[#f5d0d0]", text: "text-[#a32020]" },
                { label: "Total Credit", value: fmt(data?.totalCredit), bg: "bg-[#e8f4e8]", vBg: "bg-[#ccebcc]", text: "text-[#2d7a2d]" },
                { label: "Closing", value: fmt(data?.closingBalance), bg: "bg-[#DCE8D2]", vBg: "bg-[#F2B07E]", text: "text-[#6b3000] font-bold" },
              ]} />
            )}
            <AccountingTable columns={COLUMNS} rows={rows} emptyMessage="No CC code ledger entries" />
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
