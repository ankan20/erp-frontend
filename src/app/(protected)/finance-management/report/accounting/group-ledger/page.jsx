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
import { FilterLabel, fmt } from "@/components/finance/report/accounting/shared";

const COLUMNS = [
  { key: "sl",         label: "#",           className: "w-[40px]" },
  { key: "groupName",  label: "Group",       className: "min-w-[200px]" },
  { key: "headUnder",  label: "Head Under",  className: "w-[140px]" },
  { key: "totalDebit", label: "Total Debit",  type: "amount", align: "right", className: "w-[120px]" },
  { key: "totalCredit", label: "Total Credit", type: "amount", align: "right", className: "w-[120px]" },
  { key: "net",        label: "Net Balance",  type: "amount", align: "right", className: "w-[120px]" },
];

export default function GroupLedgerPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router  = useRouter();
  const actions = usePageActions({ router });

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [fetched, setFetched]   = useState(false);

  const handleFetch = useCallback(async () => {
    setLoading(true); setFetched(false);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate)   params.set("to_date", toDate);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.GROUP_LEDGER}?${params}`,
        method: "GET",
      });
      setData(res?.data ?? null); setFetched(true);
    } catch (err) {
      setData(null); toast.error(err?.message || "Failed to fetch group ledger");
    } finally { setLoading(false); }
  }, [fromDate, toDate]);

  const handleReset = () => { setFromDate(""); setToDate(""); setData(null); setFetched(false); };

  const groups = data?.rows || [];
  const rows = groups.map((g, i) => ({
    _key: i, sl: i + 1,
    groupName: g.groupName || "—",
    headUnder: g.headUnder || "—",
    totalDebit: g.debit,
    totalCredit: g.credit,
    net: g.net,
  }));


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — Group Ledger</h2>
        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
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
            <Search size={22} className="opacity-40" /> Select a period and press Fetch
          </div>
        ) : (
          <AccountingTable columns={COLUMNS} rows={rows} emptyMessage="No group data found" />
        )}
      </div>
    </HeaderWrapper>
  );
}
