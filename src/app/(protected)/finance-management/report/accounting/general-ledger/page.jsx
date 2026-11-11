"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw, FileText, FileSpreadsheet } from "lucide-react";
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

import AccountingTable from "@/components/finance/report/accounting/AccountingTable";
import {
  FilterLabel, SummaryBox, SourceTypeBadge, fmt, fmtDate,
} from "@/components/finance/report/accounting/shared";

const COLUMNS = [
  { key: "sl",          label: "#",         className: "w-[40px]" },
  { key: "date",        label: "Date",      className: "w-[90px]" },
  { key: "sourceType",  label: "Source",     className: "w-[120px]" },
  { key: "docNo",       label: "Doc No",     className: "w-[140px]" },
  { key: "narration",   label: "Narration",  className: "min-w-[200px]" },
  { key: "debit",       label: "Debit (Dr)", type: "amount", align: "right", className: "w-[110px]" },
  { key: "credit",      label: "Credit (Cr)", type: "amount", align: "right", className: "w-[110px]" },
  { key: "balance",     label: "Balance",    type: "amount", align: "right", className: "w-[130px]" },
];

export default function GeneralLedgerPage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router  = useRouter();
  const actions = usePageActions({ router });

  const [accountType, setAccountType] = useState("CC");
  const [accountId, setAccountId]     = useState("");
  const [fromDate, setFromDate]       = useState("");
  const [toDate, setToDate]           = useState("");

  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [fetched, setFetched]         = useState(false);

  const [ccList, setCcList]           = useState([]);
  const [vendorList, setVendorList]   = useState([]);
  const [bankList, setBankList]       = useState([]);

  useEffect(() => {
    Promise.all([
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.BANK_CASH.LIST, method: "GET" }),
    ]).then(([cc, v, b]) => {
      setCcList(cc?.data || []);
      setVendorList(v?.data || []);
      setBankList(b?.data || []);
    }).catch(() => {});
  }, []);

  const accountOptions = accountType === "CC" ? ccList
    : accountType === "Vendor" ? vendorList : bankList;

  const accountLabelKey = accountType === "CC" ? ["ccCode", "ccName"]
    : accountType === "Vendor" ? ["ledgerCode", "ledgerName"]
    : ["bankCode", "bankName"];

  const accountValueKey = accountType === "CC" ? "ccId"
    : accountType === "Vendor" ? "ledgerId" : "id";

  const handleFetch = useCallback(async () => {
    if (!accountId) { toast.error("Please select an account"); return; }
    setLoading(true); setFetched(false);
    try {
      const params = new URLSearchParams();
      params.set("account_type", accountType);
      params.set("account_id", accountId);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate)   params.set("to_date", toDate);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.LEDGER}?${params}`,
        method: "GET",
      });
      setData(res?.data ?? null);
      setFetched(true);
    } catch (err) {
      setData(null);
      toast.error(err?.message || "Failed to fetch ledger");
    } finally { setLoading(false); }
  }, [accountType, accountId, fromDate, toDate]);

  const handleReset = () => {
    setAccountId(""); setFromDate(""); setToDate("");
    setData(null); setFetched(false);
  };

  const handleExport = useCallback(async (format) => {
    if (!accountId) return;
    try {
      const params = new URLSearchParams();
      params.set("account_type", accountType);
      params.set("account_id", accountId);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      params.set("format", format);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.EXPORT.LEDGER}?${params}`,
        method: "GET",
        responseType: "blob",
      });
      if (res instanceof Blob) {
        const url = URL.createObjectURL(res);
        const a = document.createElement("a");
        a.href = url;
        a.download = `general_ledger.${format === "pdf" ? "pdf" : "xlsx"}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast.error(err?.message || `Export failed`);
    }
  }, [accountType, accountId, fromDate, toDate]);

  const entries = data?.entries || [];

  const rows = entries.map((e, i) => ({
    _key: i,
    sl: i + 1,
    date: fmtDate(e.date),
    sourceType: (e.sourceType || "").replace(/_/g, " "),
    docNo: e.voucherNo || "",
    narration: e.narration || "",
    debit: e.debit,
    credit: e.credit,
    balance: e.balance,
  }));


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — General Ledger</h2>

        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <FilterLabel>Account Type</FilterLabel>
            <select
              value={accountType}
              onChange={(e) => { setAccountType(e.target.value); setAccountId(""); }}
              className="h-7 border border-[#8f8f8f] px-2 text-sm rounded-sm"
            >
              <option value="CC">CC Code</option>
              <option value="Vendor">Vendor / Party</option>
              <option value="BankCash">Bank / Cash</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <FilterLabel>Account</FilterLabel>
            <div className="w-[260px]">
              <SearchableSelect
                options={accountOptions}
                value={accountId}
                onChange={setAccountId}
                labelKey={accountLabelKey}
                labelSeparator=" : "
                valueKey={accountValueKey}
                placeholder="Select account…"
                searchKeys={accountLabelKey}
              />
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
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Fetch
            </button>
            {fetched && (
              <>
                <button onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#8f8f8f] text-[13px] rounded-sm hover:bg-gray-100 transition-colors">
                  <RefreshCw size={13} /> Reset
                </button>
                <button onClick={() => handleExport("pdf")}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#a33] text-[#a33] text-[13px] rounded-sm hover:bg-red-50 transition-colors">
                  <FileText size={13} /> PDF
                </button>
                <button onClick={() => handleExport("excel")}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#2d7a2d] text-[#2d7a2d] text-[13px] rounded-sm hover:bg-green-50 transition-colors">
                  <FileSpreadsheet size={13} /> Excel
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Select an account type and account, then press Fetch
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
            <AccountingTable columns={COLUMNS} rows={rows} emptyMessage="No ledger entries found" />
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
