"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw, FileSearch } from "lucide-react";
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
import { getLocalStorage } from "@/lib/localStorage";
import AccountingTable    from "@/components/finance/report/accounting/AccountingTable";
import GroupBreakdownModal from "@/components/finance/report/accounting/GroupBreakdownModal";
import { FilterLabel } from "@/components/finance/report/accounting/shared";
import { exportPDF, exportExcel } from "@/components/finance/report/accounting/exportAccounting";

function fmtBalDrCr(val) {
  if (val == null || val === 0) return "—";
  const abs = Math.abs(val);
  const side = val > 0 ? "Dr" : "Cr";
  return `${formatAmount(abs)} ${side}`;
}

const COLUMNS = [
  { key: "sl",         label: "#",            className: "w-[40px]" },
  { key: "groupName",  label: "Group",        className: "min-w-[200px]" },
  { key: "headUnder",  label: "Head Under",   className: "w-[140px]" },
  { key: "totalDebit", label: "Total Debit",  type: "amount", align: "right", className: "w-[120px]" },
  { key: "totalCredit",label: "Total Credit", type: "amount", align: "right", className: "w-[120px]" },
  { key: "net",        label: "Net Balance",  align: "right", className: "w-[130px]" },
  { key: "action",     label: "",             className: "w-[32px]" },
];

export default function GroupLedgerPage() {
  const access = getPageAccess({ pageCode: "accounting_group_ledger", pageType: "LIST" });
  const router  = useRouter();
  const actions = usePageActions({ router });

  const defaultProject = getLocalStorage("projectInfo")?.projectCode || "";
  const [projectCode, setProjectCode] = useState(defaultProject);
  const [fromDate, setFromDate]       = useState("");
  const [toDate, setToDate]           = useState("");
  const [searchText, setSearchText]   = useState("");
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [fetched, setFetched]         = useState(false);
  const [projectList, setProjectList] = useState([]);
  // the filters the shown data was fetched with — the breakdown must use the same
  const [appliedFilters, setAppliedFilters] = useState({});
  const [breakdown, setBreakdown]     = useState(null);

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" })
      .then((res) => setProjectList(res?.data || []))
      .catch(() => {});
  }, []);

  const handleFetch = useCallback(async () => {
    setLoading(true); setFetched(false);
    try {
      const params = new URLSearchParams();
      if (projectCode) params.set("project_code", projectCode);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate)   params.set("to_date", toDate);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.GROUP_LEDGER}?${params}`,
        method: "GET",
      });
      setData(res?.data ?? null); setFetched(true);
      setAppliedFilters({ projectCode, fromDate, toDate });
    } catch (err) {
      setData(null); toast.error(err?.message || "Failed to fetch group ledger");
    } finally { setLoading(false); }
  }, [projectCode, fromDate, toDate]);

  const handleReset = () => {
    setProjectCode(defaultProject);
    setFromDate(""); setToDate(""); setSearchText("");
    setData(null); setFetched(false);
  };

  const period = fromDate && toDate ? `${fromDate} to ${toDate}` : "";

  const onPDF = useCallback(() => {
    if (!data?.rows) return;
    const allRows = data.rows;
    const plRows = allRows.filter((r) => r.headUnder !== "Balance Sheet");
    const bsRows = allRows.filter((r) => r.headUnder === "Balance Sheet");
    const bodyRows = [];
    if (plRows.length) {
      bodyRows.push(["Profit & Loss", "", "", "", ""]);
      plRows.forEach((r) => bodyRows.push([
        r.groupName, r.headUnder || "", formatAmount(r.debit), formatAmount(r.credit), fmtBalDrCr(r.net),
      ]));
      const plDr = plRows.reduce((s, r) => s + (r.debit || 0), 0);
      const plCr = plRows.reduce((s, r) => s + (r.credit || 0), 0);
      bodyRows.push([`  Sub-total (${plRows.length} groups)`, "", formatAmount(plDr), formatAmount(plCr), fmtBalDrCr(plDr - plCr)]);
    }
    if (bsRows.length) {
      bodyRows.push(["Balance Sheet", "", "", "", ""]);
      bsRows.forEach((r) => bodyRows.push([
        r.groupName, r.headUnder || "", formatAmount(r.debit), formatAmount(r.credit), fmtBalDrCr(r.net),
      ]));
      const bsDr = bsRows.reduce((s, r) => s + (r.debit || 0), 0);
      const bsCr = bsRows.reduce((s, r) => s + (r.credit || 0), 0);
      bodyRows.push([`  Sub-total (${bsRows.length} groups)`, "", formatAmount(bsDr), formatAmount(bsCr), fmtBalDrCr(bsDr - bsCr)]);
    }
    const grandDr = allRows.reduce((s, r) => s + (r.debit || 0), 0);
    const grandCr = allRows.reduce((s, r) => s + (r.credit || 0), 0);
    exportPDF({
      title: "Group Summary",
      period, project: projectCode || "All",
      filename: "group_ledger",
      head: [["Group Name", "Head Under", "Total Debit", "Total Credit", "Net Balance"]],
      body: bodyRows,
      foot: [["Grand Total", "", formatAmount(grandDr), formatAmount(grandCr), fmtBalDrCr(grandDr - grandCr)]],
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      amountColumns: [2, 3, 4],
    });
  }, [data, period, projectCode]);

  const onExcel = useCallback(() => {
    if (!data?.rows) return;
    const allRows = data.rows;
    const plRows = allRows.filter((r) => r.headUnder !== "Balance Sheet");
    const bsRows = allRows.filter((r) => r.headUnder === "Balance Sheet");
    const excelRows = [];
    if (plRows.length) {
      excelRows.push(["Profit & Loss", "", "", "", ""]);
      plRows.forEach((r) => excelRows.push([r.groupName, r.headUnder || "", r.debit || 0, r.credit || 0, fmtBalDrCr(r.net)]));
      const plDr = plRows.reduce((s, r) => s + (r.debit || 0), 0);
      const plCr = plRows.reduce((s, r) => s + (r.credit || 0), 0);
      excelRows.push([`  Sub-total (${plRows.length} groups)`, "", plDr, plCr, fmtBalDrCr(plDr - plCr)]);
    }
    if (bsRows.length) {
      excelRows.push(["Balance Sheet", "", "", "", ""]);
      bsRows.forEach((r) => excelRows.push([r.groupName, r.headUnder || "", r.debit || 0, r.credit || 0, fmtBalDrCr(r.net)]));
      const bsDr = bsRows.reduce((s, r) => s + (r.debit || 0), 0);
      const bsCr = bsRows.reduce((s, r) => s + (r.credit || 0), 0);
      excelRows.push([`  Sub-total (${bsRows.length} groups)`, "", bsDr, bsCr, fmtBalDrCr(bsDr - bsCr)]);
    }
    const grandDr = allRows.reduce((s, r) => s + (r.debit || 0), 0);
    const grandCr = allRows.reduce((s, r) => s + (r.credit || 0), 0);
    excelRows.push(["Grand Total", "", grandDr, grandCr, fmtBalDrCr(grandDr - grandCr)]);
    exportExcel({
      title: "Group Summary",
      period, project: projectCode || "All",
      filename: "group_ledger",
      sheetName: "Group Summary",
      headers: ["Group Name", "Head Under", "Total Debit", "Total Credit", "Net Balance"],
      rows: excelRows,
      colWidths: [30, 15, 18, 18, 18],
    });
  }, [data, period, projectCode]);

  const groups = data?.rows || [];

  const { rows, footerRow, plTotal, bsTotal } = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    let slCounter = 0;
    const plRows = [];
    const bsRows = [];

    groups.forEach((g) => {
      const name = g.groupName || "Ungrouped";
      const head = g.headUnder || "—";
      if (q) {
        const haystack = `${name} ${head}`.toLowerCase();
        if (!haystack.includes(q)) return;
      }
      slCounter++;
      const row = {
        _key: `grp_${slCounter}`,
        sl: slCounter,
        groupName: name,
        headUnder: head,
        totalDebit: g.debit,
        totalCredit: g.credit,
        net: fmtBalDrCr(g.net),
        action: <FileSearch size={13} className="text-[#9ca3af]" />,
        _onClick: () => setBreakdown(g),
        _title: "Click to see which accounts and documents make this amount",
      };
      if (head === "Balance Sheet") bsRows.push(row);
      else plRows.push(row);
    });

    const allRows = [];

    const plDr = plRows.reduce((s, r) => s + (r.totalDebit || 0), 0);
    const plCr = plRows.reduce((s, r) => s + (r.totalCredit || 0), 0);
    const plNet = plDr - plCr;
    if (plRows.length > 0) {
      allRows.push({
        _key: "_pl_header", _highlight: true,
        sl: "", groupName: "Profit & Loss", headUnder: "",
        totalDebit: null, totalCredit: null, net: "",
      });
      allRows.push(...plRows);
      allRows.push({
        _key: "_pl_sub", _highlight: true,
        sl: "", groupName: `    Sub-total (${plRows.length} groups)`, headUnder: "",
        totalDebit: plDr, totalCredit: plCr, net: fmtBalDrCr(plNet),
      });
    }

    const bsDr = bsRows.reduce((s, r) => s + (r.totalDebit || 0), 0);
    const bsCr = bsRows.reduce((s, r) => s + (r.totalCredit || 0), 0);
    const bsNet = bsDr - bsCr;
    if (bsRows.length > 0) {
      allRows.push({
        _key: "_bs_header", _highlight: true,
        sl: "", groupName: "Balance Sheet", headUnder: "",
        totalDebit: null, totalCredit: null, net: "",
      });
      allRows.push(...bsRows);
      allRows.push({
        _key: "_bs_sub", _highlight: true,
        sl: "", groupName: `    Sub-total (${bsRows.length} groups)`, headUnder: "",
        totalDebit: bsDr, totalCredit: bsCr, net: fmtBalDrCr(bsNet),
      });
    }

    const grandDr = plDr + bsDr;
    const grandCr = plCr + bsCr;

    return {
      rows: allRows,
      footerRow: {
        sl: "", groupName: "Grand Total", headUnder: "",
        totalDebit: grandDr, totalCredit: grandCr,
        net: fmtBalDrCr(grandDr - grandCr),
      },
      plTotal: { dr: plDr, cr: plCr, net: plNet },
      bsTotal: { dr: bsDr, cr: bsCr, net: bsNet },
    };
  }, [groups, searchText]);


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — Group Ledger</h2>
        {fetched && !loading && groups.length > 0 && (
          <p className="text-[11.5px] text-[#6b7280] -mt-2">
            Click any group to see which accounts and documents make its amount.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
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

        {fetched && !loading && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 max-w-[300px]">
              <Search size={13} className="text-[#9ca3af] shrink-0" />
              <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search group name..."
                className="w-full h-[28px] px-2 text-[12px] border border-[#d1d5db] bg-white text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1b2f3a] focus:outline-none transition-colors" />
            </div>
            <span className="ml-auto text-[11.5px] text-[#6b7280]">
              {groups.length} group{groups.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-[300px]"><EdoxMark size={32} /></div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" /> Select a period and press Fetch
          </div>
        ) : (
          <AccountingTable columns={COLUMNS} rows={rows} footerRow={footerRow} emptyMessage="No group data found" />
        )}
      </div>

      <GroupBreakdownModal
        open={!!breakdown}
        onClose={() => setBreakdown(null)}
        group={breakdown}
        fromDate={appliedFilters.fromDate}
        toDate={appliedFilters.toDate}
        projectCode={appliedFilters.projectCode}
      />
    </HeaderWrapper>
  );
}
