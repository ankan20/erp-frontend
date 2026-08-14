"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable   from "@/components/common/PageNotAvailable";
import SearchableSelect   from "@/components/common/SearchableSelect";
import { usePageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";

// ── helpers ──────────────────────────────────────────────────────────────────

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

const DOC_TYPE_BADGE = {
  "Purchase Voucher": "bg-[#e8f4e8] text-[#2d7a2d]",
  "Purchase Bill":    "bg-[#e8f4e8] text-[#2d7a2d]",
  "Payment Voucher":  "bg-[#fce8e8] text-[#a32020]",
  "Bill Payment":     "bg-[#fce8e8] text-[#a32020]",
  "Debit Note":       "bg-[#fff3e0] text-[#b35900]",
  "Credit Note":      "bg-[#e8eaff] text-[#3030a3]",
  "Sale Bill":        "bg-[#e0f7fa] text-[#006064]",
  "Sale Receipt":     "bg-[#e0f7fa] text-[#006064]",
};

// ── sub-components ────────────────────────────────────────────────────────────

function FilterLabel({ children }) {
  return (
    <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] leading-5 rounded-sm whitespace-nowrap shrink-0">
      {children}
    </div>
  );
}

function SummaryBox({ totalDebit, totalCredit, closingBalance, balanceType }) {
  const items = [
    { label: "Total Debit",       value: fmt(totalDebit),       bg: "bg-[#fce8e8]", vBg: "bg-[#f5d0d0]", text: "text-[#a32020]" },
    { label: "Total Credit",      value: fmt(totalCredit),      bg: "bg-[#e8f4e8]", vBg: "bg-[#ccebcc]", text: "text-[#2d7a2d]" },
    { label: "Closing Balance",   value: `${fmt(closingBalance)} ${balanceType || ""}`, bg: "bg-[#DCE8D2]", vBg: "bg-[#F2B07E]", text: "text-[#6b3000] font-bold" },
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

function LedgerTable({ entries, showVendor = false }) {
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
        <thead className="bg-[#b7cfa5] sticky top-0 z-10">
          <tr>
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-left whitespace-nowrap w-[45px]">Sl.</th>
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-left whitespace-nowrap w-[95px]">Date</th>
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-left whitespace-nowrap w-[130px]">Doc Type</th>
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-left whitespace-nowrap w-[165px]">Doc No</th>
            {showVendor && (
              <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-left whitespace-nowrap w-[165px]">Vendor</th>
            )}
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-left">Particular</th>
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-right whitespace-nowrap w-[110px]">Debit (Dr)</th>
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-right whitespace-nowrap w-[110px]">Credit (Cr)</th>
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-right whitespace-nowrap w-[120px]">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row, i) => {
            const badgeCls = DOC_TYPE_BADGE[row.docType] || "bg-gray-100 text-gray-600";
            const balSign = row.balanceType === "Dr"
              ? "text-[#a32020]"
              : row.balanceType === "Cr"
              ? "text-[#2d7a2d]"
              : "";
            return (
              <tr key={i} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                <td className="border border-[#e6e4e4] px-2 py-1 text-gray-500">{i + 1}</td>
                <td className="border border-[#e6e4e4] px-2 py-1 whitespace-nowrap">{fmtDate(row.date)}</td>
                <td className="border border-[#e6e4e4] px-2 py-1">
                  <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badgeCls}`}>
                    {row.docType}
                  </span>
                </td>
                <td className="border border-[#e6e4e4] px-2 py-1 text-blue-700 font-medium whitespace-nowrap">{row.docNo || "—"}</td>
                {showVendor && (
                  <td className="border border-[#e6e4e4] px-2 py-1 text-[11px]">{row.vendorName || "—"}</td>
                )}
                <td className="border border-[#e6e4e4] px-2 py-1 max-w-[280px] truncate" title={row.particular}>{row.particular || "—"}</td>
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

function VendorInfoBar({ vendor }) {
  if (!vendor) return null;
  return (
    <div className="flex flex-wrap gap-4 px-3 py-2 bg-[#f0f4f8] border border-[#c4d1df] rounded-sm text-[12px]">
      <span><span className="font-semibold text-gray-500">Code:</span> <span className="font-semibold">{vendor.ledgerCode}</span></span>
      <span><span className="font-semibold text-gray-500">Name:</span> <span className="font-semibold">{vendor.ledgerName}</span></span>
      {vendor.gstin && <span><span className="font-semibold text-gray-500">GSTIN:</span> {vendor.gstin}</span>}
    </div>
  );
}

// ── PDF export ────────────────────────────────────────────────────────────────

async function downloadLedgerPDF({ ledgerType, ledgerData, filters, vendorMap }) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  const title = ledgerType === "vendor" ? "Vendor Ledger" : "My Ledger";
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, y, { align: "center" });
  y += 7;

  // Vendor info (vendor mode)
  if (ledgerType === "vendor" && ledgerData?.vendor) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const v = ledgerData.vendor;
    const info = [v.ledgerCode, v.ledgerName, v.gstin ? `GSTIN: ${v.gstin}` : null].filter(Boolean).join("   |   ");
    doc.text(info, pageW / 2, y, { align: "center" });
    y += 6;
  }

  // Filter row
  const parts = [];
  if (filters.fromDate) parts.push(`From: ${filters.fromDate}`);
  if (filters.toDate)   parts.push(`To: ${filters.toDate}`);
  if (filters.projectCode) parts.push(`Project: ${filters.projectCode}`);
  if (parts.length) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(parts.join("   |   "), pageW / 2, y, { align: "center" });
    y += 5;
  }

  // Helper: render one ledger block
  const renderBlock = (entries, summary, showVendor) => {
    // Summary line
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const sumLine = `Total Debit: ${fmt(summary.totalDebit)}   |   Total Credit: ${fmt(summary.totalCredit)}   |   Closing Balance: ${fmt(summary.closingBalance)} ${summary.balanceType}`;
    doc.text(sumLine, 14, y);
    y += 5;

    const head = [["Sl.", "Date", "Doc Type", "Doc No", showVendor ? "Vendor" : null, "Particular", "Debit (Dr)", "Credit (Cr)", "Balance"].filter(Boolean)];
    const body = entries.map((r, i) => [
      i + 1,
      fmtDate(r.date),
      r.docType,
      r.docNo || "—",
      ...(showVendor ? [r.vendorName || "—"] : []),
      r.particular || "—",
      r.debit > 0 ? fmt(r.debit) : "—",
      r.credit > 0 ? fmt(r.credit) : "—",
      `${fmt(r.balance)} ${r.balanceType}`,
    ]);

    const colOff = showVendor ? 1 : 0;
    const colStyles = {
      0: { cellWidth: 8,  halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 30 },
      3: { cellWidth: 32 },
      [4 + colOff]: { cellWidth: "auto" },
      [5 + colOff]: { cellWidth: 22, halign: "right" },
      [6 + colOff]: { cellWidth: 22, halign: "right" },
      [7 + colOff]: { cellWidth: 26, halign: "right" },
    };
    if (showVendor) colStyles[4] = { cellWidth: 32 };

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      headStyles: { fillColor: [183, 207, 165], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [242, 242, 242] },
      columnStyles: colStyles,
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  if (ledgerType === "vendor") {
    renderBlock(ledgerData.entries || [], ledgerData.summary || {}, false);
  } else if (ledgerData.mode === "project") {
    renderBlock(ledgerData.entries || [], ledgerData.summary || {}, true);
  } else {
    // All projects mode
    (ledgerData.projects || []).forEach((proj) => {
      if (y > 170) { doc.addPage(); y = 14; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${proj.projectCode} — ${proj.projectName}${proj.clientName ? " | Client: " + proj.clientName : ""}`, 14, y);
      y += 5;
      renderBlock(proj.entries || [], proj.summary || {}, true);
    });
  }

  doc.save(`${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function LedgerViewPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "ledger_view", pageType: "LIST" });

  const [ledgerType, setLedgerType] = useState("my"); // "my" | "vendor"

  // filter state
  const [vendorId,     setVendorId]     = useState("");
  const [projectCode,  setProjectCode]  = useState("");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");

  // data
  const [ledgerData,   setLedgerData]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [fetched,      setFetched]      = useState(false);

  // dropdown options
  const [vendorList,   setVendorList]   = useState([]);
  const [projectList,  setProjectList]  = useState([]);

  // load dropdown data
  useEffect(() => {
    if (!access.allowed) return;
    Promise.allSettled([
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" }),
    ]).then(([vRes, pRes]) => {
      if (vRes.status === "fulfilled") {
        setVendorList(
          (vRes.value?.data || [])
            .slice()
            .sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || ""))
        );
      }
      if (pRes.status === "fulfilled") {
        setProjectList(pRes.value?.data || []);
      }
    });
  }, [access.allowed]);

  const handleFetch = useCallback(async () => {
    if (ledgerType === "vendor" && !vendorId) {
      toast.error("Please select a vendor");
      return;
    }
    setLoading(true);
    setLedgerData(null);
    setFetched(false);
    try {
      let url = "";
      if (ledgerType === "vendor") {
        const params = new URLSearchParams({ vendorId });
        if (projectCode) params.set("projectCode", projectCode);
        if (fromDate)    params.set("fromDate", fromDate);
        if (toDate)      params.set("toDate", toDate);
        url = `${API_ENDPOINTS.FINANCE.VENDOR_LEDGER.GET}?${params}`;
      } else {
        const params = new URLSearchParams();
        if (projectCode) params.set("projectCode", projectCode);
        if (fromDate)    params.set("fromDate", fromDate);
        if (toDate)      params.set("toDate", toDate);
        url = `${API_ENDPOINTS.FINANCE.MY_LEDGER.GET}${params.toString() ? "?" + params : ""}`;
      }
      const res = await apiRequest({ url, method: "GET" });
      setLedgerData(res.data || null);
      setFetched(true);
    } catch (err) {
      toast.error(err?.message || "Failed to fetch ledger");
    } finally {
      setLoading(false);
    }
  }, [ledgerType, vendorId, projectCode, fromDate, toDate]);

  const handleReset = () => {
    setVendorId("");
    setProjectCode("");
    setFromDate("");
    setToDate("");
    setLedgerData(null);
    setFetched(false);
  };

  const actions = usePageActions({
    router,
    onDownload: fetched && ledgerData
      ? () => downloadLedgerPDF({ ledgerType, ledgerData, filters: { fromDate, toDate, projectCode } })
      : undefined,
  });

  if (!access.allowed) return <PageNotAvailable />;

  const isAllProjectsMode = ledgerType === "my" && ledgerData && ledgerData.mode === "all";

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">

        {/* ── TAB TOGGLE ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-0 border-b border-[#c4d1df] pb-0">
          {[
            { key: "my",     label: "My Ledger" },
            { key: "vendor", label: "Vendor Ledger" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setLedgerType(key); handleReset(); }}
              className={`px-5 py-1.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px ${
                ledgerType === key
                  ? "border-[#5a5aaa] text-[#3a3a8a] bg-[#f0f0fc]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── FILTER BAR ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 border-b pb-3">

          {/* Vendor (vendor ledger only) */}
          {ledgerType === "vendor" && (
            <div className="flex items-center gap-2">
              <FilterLabel>Vendor <span className="text-red-500">*</span></FilterLabel>
              <div className="w-[260px]">
                <SearchableSelect
                  options={vendorList}
                  value={vendorId}
                  onChange={(val) => setVendorId(val)}
                  labelKey={["ledgerCode", "ledgerName"]}
                  labelSeparator=" : "
                  valueKey="ledgerId"
                  placeholder="Select vendor..."
                  clearLabel="— All —"
                  searchKeys={["ledgerCode", "ledgerName"]}
                />
              </div>
            </div>
          )}

          {/* Project (both) */}
          <div className="flex items-center gap-2">
            <FilterLabel>Project</FilterLabel>
            <div className="w-[220px]">
              
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

          {/* Date range */}
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

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleFetch}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors"
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
                  onClick={() =>
                    downloadLedgerPDF({
                      ledgerType,
                      ledgerData,
                      filters: { fromDate, toDate, projectCode },
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#e8f0e8] hover:bg-[#d0e4d0] text-[#2d7a2d] text-[13px] font-semibold rounded-sm border border-[#a3c8a3] transition-colors"
                >
                  <Download size={13} />
                  PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── LOADING ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#5a5aaa]" />
          </div>
        )}

        {/* ── NOT FETCHED YET ──────────────────────────────────────────────── */}
        {!loading && !fetched && (
          <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 gap-2">
            <Search size={36} strokeWidth={1.2} />
            <p className="text-sm">Select filters and click <strong>Fetch</strong> to load ledger</p>
          </div>
        )}

        {/* ── DATA ────────────────────────────────────────────────────────── */}
        {!loading && fetched && ledgerData && (
          <div className="space-y-4">

            {/* VENDOR LEDGER */}
            {ledgerType === "vendor" && (
              <>
                <VendorInfoBar vendor={ledgerData.vendor} />

                {ledgerData.filters && (
                  <div className="text-[11px] text-gray-500 flex flex-wrap gap-3">
                    {ledgerData.filters.projectCode && <span>Project: <b>{ledgerData.filters.projectCode}</b></span>}
                    {ledgerData.filters.fromDate && <span>From: <b>{ledgerData.filters.fromDate}</b></span>}
                    {ledgerData.filters.toDate   && <span>To: <b>{ledgerData.filters.toDate}</b></span>}
                  </div>
                )}

                <SummaryBox {...(ledgerData.summary || {})} />
                <LedgerTable entries={ledgerData.entries} showVendor={false} />
              </>
            )}

            {/* MY LEDGER — PROJECT MODE */}
            {ledgerType === "my" && ledgerData.mode === "project" && (
              <>
                <div className="flex flex-wrap gap-4 text-[12px] font-semibold text-gray-700 px-1">
                  <span>{ledgerData.projectCode} — {ledgerData.projectName}</span>
                  {ledgerData.clientName && <span className="text-gray-500">Client: {ledgerData.clientName}</span>}
                </div>

                {ledgerData.filters && (
                  <div className="text-[11px] text-gray-500 flex flex-wrap gap-3">
                    {ledgerData.filters.fromDate && <span>From: <b>{ledgerData.filters.fromDate}</b></span>}
                    {ledgerData.filters.toDate   && <span>To: <b>{ledgerData.filters.toDate}</b></span>}
                  </div>
                )}

                <SummaryBox {...(ledgerData.summary || {})} />
                <LedgerTable entries={ledgerData.entries} showVendor />
              </>
            )}

            {/* MY LEDGER — ALL PROJECTS MODE */}
            {isAllProjectsMode && (
              <>
                {/* Overall summary */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-gray-600">
                    All Projects — {ledgerData.projects?.length || 0} projects
                  </span>
                </div>
                <SummaryBox {...(ledgerData.summary || {})} />

                {/* Per-project blocks */}
                {(ledgerData.projects || []).map((proj) => (
                  <ProjectBlock key={proj.projectCode} proj={proj} />
                ))}
              </>
            )}
          </div>
        )}

        {/* ── NO DATA ─────────────────────────────────────────────────────── */}
        {!loading && fetched && !ledgerData && (
          <div className="text-center py-10 text-sm text-gray-400">No ledger data found for the selected filters.</div>
        )}

      </div>
    </HeaderWrapper>
  );
}

// ── Project block (collapsible) for All-Projects mode ─────────────────────────

function ProjectBlock({ proj }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-[#c4d1df] rounded-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#e8eef5] hover:bg-[#dce6f0] text-[13px] font-semibold text-left transition-colors"
      >
        <span>
          <span className="text-[#3a3a8a]">{proj.projectCode}</span>
          <span className="text-gray-600 mx-1">—</span>
          {proj.projectName}
          {proj.clientName && (
            <span className="ml-3 text-[11px] font-normal text-gray-500">Client: {proj.clientName}</span>
          )}
        </span>
        <span className="text-gray-400 text-[11px] font-normal flex items-center gap-3">
          <span>
            Balance: <b className={proj.summary?.balanceType === "Dr" ? "text-[#a32020]" : "text-[#2d7a2d]"}>
              {fmt(proj.summary?.closingBalance)} {proj.summary?.balanceType}
            </b>
          </span>
          <span className="text-[16px] leading-none">{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {/* Content */}
      {open && (
        <div className="p-3 space-y-3 bg-white">
          <SummaryBox {...(proj.summary || {})} />
          <LedgerTable entries={proj.entries} showVendor />
        </div>
      )}
    </div>
  );
}
