"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { toast } from "sonner";

import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import SearchableSelect   from "@/components/common/SearchableSelect";
import { usePageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import { formatAmount }   from "@/helper/numberFormatter";
import { getLocalStorage } from "@/lib/localStorage";

import AccountingTable from "@/components/finance/report/accounting/AccountingTable";
import {
  FilterLabel, SummaryBox, fmt, fmtDate, getNarrationHint,
} from "@/components/finance/report/accounting/shared";
import { exportPDF, exportExcel } from "@/components/finance/report/accounting/exportAccounting";

function fmtBalDrCr(val) {
  if (val == null || val === 0) return "—";
  const abs = Math.abs(val);
  const side = val > 0 ? "Dr" : "Cr";
  return `${formatAmount(abs)} ${side}`;
}

const COLUMNS = [
  { key: "sl",          label: "#",         className: "w-[40px]" },
  { key: "date",        label: "Date",      className: "w-[90px]" },
  { key: "sourceType",  label: "Source",     className: "w-[120px]" },
  { key: "docNo",       label: "Doc No",     className: "w-[140px]" },
  { key: "narration",   label: "Narration",  className: "min-w-[200px]" },
  { key: "debit",       label: "Debit (Dr)", type: "amount", align: "right", className: "w-[110px]" },
  { key: "credit",      label: "Credit (Cr)", type: "amount", align: "right", className: "w-[110px]" },
  { key: "balance",     label: "Balance",    align: "right", className: "w-[130px]" },
];
const PROJECT_COL = { key: "projectCode", label: "Project", className: "w-[90px]" };

export default function GeneralLedgerPage() {
  const access = getPageAccess({ pageCode: "accounting_ledger", pageType: "LIST" });
  const router  = useRouter();
  const actions = usePageActions({ router });

  const defaultProject = getLocalStorage("projectInfo")?.projectCode || "";
  const [projectCode, setProjectCode] = useState(defaultProject);
  const [accountType, setAccountType] = useState("CC");
  const [accountId, setAccountId]     = useState("");
  const [fromDate, setFromDate]       = useState("");
  const [toDate, setToDate]           = useState("");
  const [searchText, setSearchText]   = useState("");

  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [fetched, setFetched]         = useState(false);

  const [ccList, setCcList]           = useState([]);
  const [vendorList, setVendorList]   = useState([]);
  const [bankList, setBankList]       = useState([]);
  const [projectList, setProjectList] = useState([]);

  useEffect(() => {
    Promise.all([
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.BANK_CASH.LIST, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" }),
    ]).then(([cc, v, b, p]) => {
      setCcList(cc?.data || []);
      setVendorList(v?.data || []);
      setBankList(b?.data || []);
      setProjectList(p?.data || []);
    }).catch(() => {});
  }, []);

  const accountOptions = accountType === "CC" ? ccList
    : accountType === "Vendor" ? vendorList : bankList;

  const accountLabelKey = accountType === "CC" ? ["ccCode", "ccName"]
    : accountType === "Vendor" ? ["ledgerCode", "ledgerName"]
    : ["bankCode", "bankName"];

  const accountValueKey = accountType === "CC" ? "ccId"
    : accountType === "Vendor" ? "ledgerId" : "id";

  const showProject = !projectCode;

  const handleFetch = useCallback(async () => {
    if (!accountId) { toast.error("Please select an account"); return; }
    setLoading(true); setFetched(false);
    try {
      const params = new URLSearchParams();
      params.set("account_type", accountType);
      params.set("account_id", accountId);
      if (projectCode) params.set("project_code", projectCode);
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
  }, [accountType, accountId, projectCode, fromDate, toDate]);

  const handleReset = () => {
    setProjectCode(defaultProject);
    setAccountId(""); setFromDate(""); setToDate(""); setSearchText("");
    setData(null); setFetched(false);
  };

  const period = fromDate && toDate ? `${fromDate} to ${toDate}` : "";

  const onPDF = useCallback(() => {
    if (!data?.entries) return;
    const bodyRows = data.entries.map((e) => [
      fmtDate(e.date), (e.sourceType || "").replace(/_/g, " "),
      e.narration || "", formatAmount(e.debit || 0), formatAmount(e.credit || 0),
      fmtBalDrCr(e.closingBalance),
    ]);
    exportPDF({
      title: `General Ledger — ${data.accountName || ""}`,
      period, project: projectCode || "All",
      filename: "general_ledger",
      head: [["Date", "Source", "Narration", "Debit", "Credit", "Balance"]],
      body: bodyRows,
      foot: data.closingBalance != null
        ? [["", "", "Closing Balance", formatAmount(data.totalDebit || 0), formatAmount(data.totalCredit || 0), fmtBalDrCr(data.closingBalance)]]
        : [],
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      amountColumns: [3, 4, 5],
    });
  }, [data, period, projectCode]);

  const onExcel = useCallback(() => {
    if (!data?.entries) return;
    const excelRows = data.entries.map((e) => [
      fmtDate(e.date), (e.sourceType || "").replace(/_/g, " "),
      e.narration || "", e.debit || 0, e.credit || 0, fmtBalDrCr(e.closingBalance),
    ]);
    if (data.closingBalance != null) {
      excelRows.push(["", "", "Closing Balance", data.totalDebit || 0, data.totalCredit || 0, fmtBalDrCr(data.closingBalance)]);
    }
    exportExcel({
      title: `General Ledger — ${data.accountName || ""}`,
      period, project: projectCode || "All",
      filename: "general_ledger",
      sheetName: "Ledger",
      headers: ["Date", "Source", "Narration", "Debit", "Credit", "Balance"],
      rows: excelRows,
      colWidths: [12, 15, 35, 15, 15, 18],
    });
  }, [data, period, projectCode]);

  const entries = data?.entries || [];

  const columns = useMemo(
    () => (showProject ? [COLUMNS[0], PROJECT_COL, ...COLUMNS.slice(1)] : COLUMNS),
    [showProject],
  );

  const rows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return entries
      .map((e, i) => {
        const row = {
          _key: i,
          sl: i + 1,
          ...(showProject && { projectCode: e.projectCode || "" }),
          date: fmtDate(e.date),
          sourceType: (e.sourceType || "").replace(/_/g, " "),
          docNo: e.voucherNo || "",
          narration: e.narration || "",
          _narrationHint: getNarrationHint(e.narration),
          debit: e.debit,
          credit: e.credit,
          balance: fmtBalDrCr(e.balance),
        };
        if (q) {
          const haystack = `${row.docNo} ${row.sourceType} ${row.date} ${row.narration} ${row.projectCode || ""}`.toLowerCase();
          if (!haystack.includes(q)) return null;
        }
        return row;
      })
      .filter(Boolean);
  }, [entries, showProject, searchText]);


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — General Ledger</h2>

        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          {/* Project */}
          <div className="flex items-center gap-2">
            <FilterLabel>Project</FilterLabel>
            <div className="w-[200px]">
              <SearchableSelect
                options={projectList}
                value={projectCode}
                onChange={(val) => setProjectCode(val)}
                labelKey={["projectCode", "projectName"]}
                labelSeparator=" : "
                valueKey="projectCode"
                placeholder="All Projects"
                clearLabel="— All Projects —"
                searchKeys={["projectCode", "projectName"]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FilterLabel>Account Type</FilterLabel>
            <select
              value={accountType}
              onChange={(e) => { setAccountType(e.target.value); setAccountId(""); }}
              className="h-7 border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors"
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
              className="h-[28px] w-[130px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>To</FilterLabel>
            <input type="date" value={toDate} min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="h-[28px] w-[130px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors" />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={handleFetch} disabled={loading}
              className="flex items-center gap-1 px-3 py-[5px] bg-[#1b2f3a] hover:bg-[#263f4d] text-white text-[12px] font-medium disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Fetch
            </button>
            {fetched && (
              <>
                <button onClick={handleReset}
                  className="flex items-center gap-1 px-2.5 py-[5px] border border-[#d1d5db] text-[12px] text-[#4b5563] hover:bg-[#f3f4f6] transition-colors">
                  <RefreshCw size={12} /> Reset
                </button>
                <button onClick={onPDF}
                  className="flex items-center gap-1 px-2.5 py-[5px] border border-[#d1d5db] text-[12px] text-[#4b5563] hover:bg-[#f3f4f6] transition-colors">
                  PDF
                </button>
                <button onClick={onExcel}
                  className="flex items-center gap-1 px-2.5 py-[5px] border border-[#d1d5db] text-[12px] text-[#4b5563] hover:bg-[#f3f4f6] transition-colors">
                  Excel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search bar (after fetch) */}
        {fetched && !loading && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 max-w-[300px]">
              <Search size={13} className="text-[#9ca3af] shrink-0" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search voucher, narration..."
                className="w-full h-[28px] px-2 text-[12px] border border-[#d1d5db] bg-white text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1b2f3a] focus:outline-none transition-colors"
              />
            </div>
            <span className="ml-auto text-[11.5px] text-[#6b7280]">
              {rows.length} entr{rows.length !== 1 ? "ies" : "y"}
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
            Select an account type and account, then press Fetch
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
            <AccountingTable
              columns={columns}
              rows={rows}
              emptyMessage="No ledger entries found"
              narrationTooltip
            />
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
