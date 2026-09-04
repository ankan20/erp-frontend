"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import NavigationButton from "@/components/common/NavigationButton";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }   from "@/helper/numberFormatter";

const fmt = (val) => {
  const n = Number(val);
  if (!n && n !== 0) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

function FilterLabel({ children }) {
  return (
    <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] leading-5 rounded-sm whitespace-nowrap shrink-0">
      {children}
    </div>
  );
}

function SummaryBox({ totalDebit, totalCredit, closingBalance, balanceType }) {
  const items = [
    { label: "Total Debit",     value: fmt(totalDebit),   bg: "bg-[#fce8e8]", vBg: "bg-[#f5d0d0]", text: "text-[#a32020]" },
    { label: "Total Credit",    value: fmt(totalCredit),  bg: "bg-[#e8f4e8]", vBg: "bg-[#ccebcc]", text: "text-[#2d7a2d]" },
    { label: "Closing Balance", value: `${fmt(closingBalance)} ${balanceType || ""}`,
      bg: "bg-[#DCE8D2]", vBg: "bg-[#F2B07E]", text: "text-[#6b3000] font-bold" },
  ];
  return (
    <div className="flex flex-col sm:flex-row gap-2 max-w-[560px] ml-auto">
      {items.map(({ label, value, bg, vBg, text }) => (
        <div key={label} className="flex sm:flex-col rounded-sm border border-gray-300 overflow-hidden flex-1">
          <div className={`px-3 py-[6px] text-[12px] font-semibold sm:text-center ${bg}`}>{label}</div>
          <div className={`px-3 py-[6px] text-[13px] font-semibold text-right ${vBg} ${text}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function LedgerTable({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="border border-[#9e9e9e] text-center py-8 text-sm text-gray-400">
        No entries found
      </div>
    );
  }
  return (
    <div className="border border-[#9e9e9e] overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-[12px]">
        <thead className="bg-[#144664] sticky top-0 z-10">
          <tr>
            <th className="border border-[#2e5a72] px-2 py-1.5 font-semibold text-white text-left whitespace-nowrap w-[45px]">Sl.</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 font-semibold text-white text-left whitespace-nowrap w-[95px]">Date</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 font-semibold text-white text-left whitespace-nowrap w-[130px]">Doc Type</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 font-semibold text-white text-left whitespace-nowrap w-[140px]">Voucher No</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 font-semibold text-white text-left">Particulars</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 font-semibold text-white text-right whitespace-nowrap w-[110px]">Debit (Dr)</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 font-semibold text-white text-right whitespace-nowrap w-[110px]">Credit (Cr)</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 font-semibold text-white text-right whitespace-nowrap w-[120px]">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row, i) => {
            const balSign = row.balanceType === "Dr" ? "text-[#a32020]" : row.balanceType === "Cr" ? "text-[#2d7a2d]" : "";
            return (
              <tr key={i} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                <td className="border border-[#e6e4e4] px-2 py-1 text-gray-500">{i + 1}</td>
                <td className="border border-[#e6e4e4] px-2 py-1 whitespace-nowrap">{fmtDate(row.date)}</td>
                <td className="border border-[#e6e4e4] px-2 py-1 text-[11px]">{row.docType || "—"}</td>
                <td className="border border-[#e6e4e4] px-2 py-1 text-blue-700 font-medium whitespace-nowrap">{row.voucherNo || "—"}</td>
                <td className="border border-[#e6e4e4] px-2 py-1 max-w-[280px] truncate" title={row.particulars}>{row.particulars || "—"}</td>
                <td className="border border-[#e6e4e4] px-2 py-1 text-right font-mono">
                  {row.debit > 0 ? <span className="text-[#a32020]">{fmt(row.debit)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="border border-[#e6e4e4] px-2 py-1 text-right font-mono">
                  {row.credit > 0 ? <span className="text-[#2d7a2d]">{fmt(row.credit)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className={`border border-[#e6e4e4] px-2 py-1 text-right font-mono font-semibold ${balSign}`}>
                  {fmt(row.balance)}{" "}
                  <span className="text-[10px] font-bold">{row.balanceType}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function downloadPettyCashPDF({ ledgerData, filters }) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Petty Cash Ledger", pageW / 2, y, { align: "center" });
  y += 7;

  const parts = [];
  if (filters.projectCode) parts.push(`Project: ${filters.projectCode}`);
  if (filters.fromDate) parts.push(`From: ${filters.fromDate}`);
  if (filters.toDate)   parts.push(`To: ${filters.toDate}`);
  if (parts.length) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(parts.join("   |   "), pageW / 2, y, { align: "center" });
    y += 5;
  }

  const entries = ledgerData.entries || [];
  const summary = ledgerData.summary || {};

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total Debit: ${fmt(summary.totalDebit)}   |   Total Credit: ${fmt(summary.totalCredit)}   |   Closing Balance: ${fmt(summary.closingBalance)} ${summary.balanceType || ""}`,
    14, y,
  );
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [["Sl.", "Date", "Doc Type", "Voucher No", "Particulars", "Debit (Dr)", "Credit (Cr)", "Balance"]],
    body: entries.map((r, i) => [
      i + 1,
      fmtDate(r.date),
      r.docType || "—",
      r.voucherNo || "—",
      r.particulars || "—",
      r.debit > 0 ? fmt(r.debit) : "—",
      r.credit > 0 ? fmt(r.credit) : "—",
      `${fmt(r.balance)} ${r.balanceType || ""}`,
    ]),
    theme: "grid",
    headStyles: { fillColor: [20, 70, 100], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [242, 242, 242] },
    columnStyles: {
      0: { cellWidth: 8,  halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: 30 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 26, halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });

  doc.save(`Petty_Cash_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function PettyCashPage() {
  const router  = useRouter();
  const access  = getPageAccess({ pageCode: "petty_cash", pageType: "LIST" });

  const [fromDate,    setFromDate]    = useState("");
  const [toDate,      setToDate]      = useState("");
  const [ledgerData,  setLedgerData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [fetched,     setFetched]     = useState(false);
  const [navOpen,     setNavOpen]     = useState(true);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const handleFetch = useCallback(async () => {
    if (!projectCode) { toast.error("No project selected"); return; }
    setLoading(true);
    setLedgerData(null);
    setFetched(false);
    try {
      const params = new URLSearchParams({ projectCode });
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate)   params.set("toDate", toDate);
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.LEDGER}?${params}`,
        method: "GET",
      });
      setLedgerData(res.data || null);
      setFetched(true);
    } catch (err) {
      toast.error(err?.message || "Failed to fetch petty cash ledger");
    } finally {
      setLoading(false);
    }
  }, [projectCode, fromDate, toDate]);

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setLedgerData(null);
    setFetched(false);
  };

  const actions = getPageActions({
    router,
    onDownload: fetched && ledgerData
      ? () => downloadPettyCashPDF({ ledgerData, filters: { projectCode, fromDate, toDate } })
      : undefined,
  });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">

        {/* Top nav buttons */}
        <div className="flex items-center justify-between border-b pb-2">
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            {navOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {navOpen ? "Collapse" : "Expand"}
          </button>

          {navOpen && (
            <div className="flex flex-wrap gap-2">
              <NavigationButton onClick={() => router.push("/finance-management/account/petty-cash/budget")}>
                Budget
              </NavigationButton>
              <NavigationButton onClick={() => router.push("/finance-management/account/petty-cash/docket-voucher")}>
                Docket Voucher
              </NavigationButton>
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <FilterLabel>Project</FilterLabel>
            <span className="text-[13px] font-semibold px-2">{projectCode || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>From</FilterLabel>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>To</FilterLabel>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFetch}
              disabled={loading || !projectCode}
              className="flex items-center gap-1.5 px-4 py-1 bg-[#144664] hover:bg-[#0f3550] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Fetch
            </button>
            {fetched && (
              <>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-semibold rounded-sm border border-gray-300 transition-colors"
                >
                  <RefreshCw size={13} />
                  Reset
                </button>
                <button
                  onClick={() => downloadPettyCashPDF({ ledgerData, filters: { projectCode, fromDate, toDate } })}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#e8f0e8] hover:bg-[#d0e4d0] text-[#2d7a2d] text-[13px] font-semibold rounded-sm border border-[#a3c8a3] transition-colors"
                >
                  <Download size={13} />
                  PDF
                </button>
              </>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        )}

        {!loading && !fetched && (
          <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 gap-2">
            <Search size={36} strokeWidth={1.2} />
            <p className="text-sm">Select date range and click <strong>Fetch</strong> to load ledger</p>
          </div>
        )}

        {!loading && fetched && ledgerData && (
          <div className="space-y-4">
            <SummaryBox {...(ledgerData.summary || {})} />
            <LedgerTable entries={ledgerData.entries} />
          </div>
        )}

        {!loading && fetched && !ledgerData && (
          <div className="text-center py-10 text-sm text-gray-400">No petty cash entries found for the selected filters.</div>
        )}

      </div>
    </HeaderWrapper>
  );
}
