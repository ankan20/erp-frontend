"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, RefreshCw, ChevronDown, ChevronUp,
  ChevronRight, Wallet, FileText, Download,
} from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import NavigationButton from "@/components/common/NavigationButton";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

// ─── helpers ────────────────────────────────────────────────────────────────
const pct    = (used, total) => (total > 0 ? Math.min(100, (used / total) * 100) : 0);
const fmtAmt = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD   = (raw) => { if (!raw) return "—"; const d = new Date(raw); return isNaN(d) ? raw : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };

// ─── PDF: budget list summary ────────────────────────────────────────────────
async function downloadListPDF({ list, projectCode, fromDate, toDate }) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("Petty Cash Ledger — Budget Summary", pageW / 2, y, { align: "center" });
  y += 7;

  const parts = [`Project: ${projectCode}`];
  if (fromDate) parts.push(`From: ${fromDate}`);
  if (toDate)   parts.push(`To: ${toDate}`);
  doc.setFontSize(8); doc.setFont("helvetica", "italic");
  doc.text(parts.join("   |   "), pageW / 2, y, { align: "center" });
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Sl.", "Budget No", "Date", "Frequency", "From", "To", "Total Amt", "Used", "Remaining", "Vouchers", "Status"]],
    body: list.map((b, i) => [
      i + 1,
      b.budgetNo,
      fmtD(b.budgetDate),
      b.budgetFrequency || "—",
      fmtD(b.fromDate),
      fmtD(b.toDate),
      fmtAmt(b.totalBudgetAmount),
      fmtAmt(b.totalUsed),
      fmtAmt(b.totalRemaining),
      b.voucherCount ?? 0,
      b.workflowStatus || "—",
    ]),
    theme: "grid",
    headStyles: { fillColor: [20, 70, 100], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [242, 242, 242] },
    columnStyles: {
      0:  { cellWidth: 8,  halign: "center" },
      6:  { halign: "right" },
      7:  { halign: "right" },
      8:  { halign: "right" },
      9:  { halign: "center" },
    },
    margin: { left: 10, right: 10 },
  });

  doc.save(`PettyCash_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── PDF: single budget full detail ─────────────────────────────────────────
async function downloadBudgetDetailPDF({ budget, ccSummary, vouchers, summary }) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(`Petty Cash Budget — ${budget?.budgetNo || ""}`, pageW / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const info = [
    `Frequency: ${budget?.budgetFrequency || "—"}`,
    `Period: ${fmtD(budget?.fromDate)} → ${fmtD(budget?.toDate)}`,
    `Status: ${budget?.workflowStatus || "—"}`,
  ].join("   |   ");
  doc.text(info, pageW / 2, y, { align: "center" });
  y += 5;

  // Summary line
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(
    `Total: ${fmtAmt(summary?.totalBudgetAmount)}   |   Used: ${fmtAmt(summary?.totalUsed)}   |   Remaining: ${fmtAmt(summary?.totalRemaining)}   |   Vouchers: ${summary?.voucherCount ?? 0}`,
    14, y,
  );
  y += 6;

  // CC Summary
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("CC-wise Breakdown", 14, y); y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Sl.", "CC Code", "CC Name", "Description", "Allocated", "Used", "Remaining"]],
    body: (ccSummary || []).map((r) => [
      r.slNo, r.ccCode, r.ccName, r.shortDescription || "—",
      fmtAmt(r.budgetAmount), fmtAmt(r.usedAmount), fmtAmt(r.remaining),
    ]),
    theme: "grid",
    headStyles: { fillColor: [30, 92, 126], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [242, 248, 255] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Vouchers
  if (vouchers?.length) {
    if (y > 160) { doc.addPage(); y = 14; }
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("Vouchers", 14, y); y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Sl.", "Voucher No", "Date", "Expenses By", "Mode", "Fund Source", "Total Amt", "Status"]],
      body: (vouchers || []).map((v, i) => [
        i + 1, v.voucherNo, fmtD(v.voucherDate), v.expensesBy || "—",
        v.modeOfPayment || "—", v.fundSource || "—",
        fmtAmt(v.totalAmount), v.workflowStatus || "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: [20, 70, 100], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [242, 242, 242] },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center" },
        6: { halign: "right" },
      },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Voucher details
    for (const v of vouchers) {
      if (!v.details?.length) continue;
      if (y > 160) { doc.addPage(); y = 14; }
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text(`${v.voucherNo} — Details`, 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Sl.", "CC Code", "CC Name", "Description", "Amount"]],
        body: v.details.map((d) => [d.slNo, d.ccCode, d.ccName, d.shortDescription || "—", fmtAmt(d.amount)]),
        theme: "grid",
        headStyles: { fillColor: [200, 220, 235], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 6.5 },
        bodyStyles: { fontSize: 6.5 },
        alternateRowStyles: { fillColor: [245, 250, 255] },
        columnStyles: { 0: { cellWidth: 8, halign: "center" }, 4: { halign: "right" } },
        margin: { left: 14, right: 10 },
      });
      y = doc.lastAutoTable.finalY + 5;
    }
  }

  doc.save(`PettyCash_Budget_${budget?.budgetNo || "detail"}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

const STATUS_STYLES = {
  approved: "bg-green-100 text-green-700",
  draft:    "bg-gray-100 text-gray-600",
  reback:   "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-600",
  reject:   "bg-red-100 text-red-600",
};
function StatusBadge({ status }) {
  if (!status) return null;
  const key = status.toLowerCase();
  const cls = key.startsWith("pending")
    ? "bg-blue-100 text-blue-700"
    : (STATUS_STYLES[key] || "bg-gray-100 text-gray-600");
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function FilterLabel({ children }) {
  return (
    <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] leading-5 rounded-sm whitespace-nowrap shrink-0">
      {children}
    </div>
  );
}

// ─── Paginator ───────────────────────────────────────────────────────────────
function Paginator({ page, totalPages, total, pageSize, onPage, loading }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);
  return (
    <div className="flex items-center justify-between px-2 py-1.5 border-t border-[#d5e8f5] bg-[#f7fbff] text-[11.5px] text-gray-600">
      <span>Page {page} of {totalPages} · {total} record{total !== 1 ? "s" : ""}</span>
      <div className="flex items-center gap-1">
        <button disabled={page === 1 || loading} onClick={() => onPage(page - 1)}
          className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition">
          ‹ Prev
        </button>
        {pages.map((p, i) =>
          p === "…" ? <span key={`e-${i}`} className="px-1">…</span> : (
            <button key={p} disabled={loading} onClick={() => onPage(p)}
              className={`px-2 py-0.5 border rounded transition ${p === page ? "bg-[#144664] border-[#144664] text-white font-semibold" : "border-[#9e9e9e] hover:bg-[#e6e6e6]"}`}>
              {p}
            </button>
          )
        )}
        <button disabled={page === totalPages || loading} onClick={() => onPage(page + 1)}
          className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition">
          Next ›
        </button>
      </div>
    </div>
  );
}

// ─── CC Summary table ────────────────────────────────────────────────────────
function CcSummaryTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#1e5c7e] text-white">
            <th className="border border-[#2e5a72] px-2 py-1.5 text-left w-[40px]">Sl</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 text-left w-[90px]">CC Code</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 text-left">CC Name</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 text-left">Description</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 text-right w-[110px]">Allocated</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 text-right w-[110px]">Used</th>
            <th className="border border-[#2e5a72] px-2 py-1.5 text-right w-[110px]">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rem = Number(r.remaining ?? 0);
            return (
              <tr key={r.budgetDetailId} className={i % 2 === 0 ? "bg-white" : "bg-[#f7f7f7]"}>
                <td className="border border-[#e0e0e0] px-2 py-1 text-gray-400">{r.slNo}</td>
                <td className="border border-[#e0e0e0] px-2 py-1 font-medium text-[#1a4f72]">{r.ccCode}</td>
                <td className="border border-[#e0e0e0] px-2 py-1">{r.ccName}</td>
                <td className="border border-[#e0e0e0] px-2 py-1 text-gray-500">{r.shortDescription || "—"}</td>
                <td className="border border-[#e0e0e0] px-2 py-1 text-right font-mono">{formatAmount(r.budgetAmount)}</td>
                <td className="border border-[#e0e0e0] px-2 py-1 text-right font-mono text-amber-700">{formatAmount(r.usedAmount)}</td>
                <td className={`border border-[#e0e0e0] px-2 py-1 text-right font-mono font-semibold ${rem < 0 ? "text-red-600" : "text-green-700"}`}>
                  {formatAmount(rem)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Voucher list inside detail ──────────────────────────────────────────────
function VoucherRow({ v, router }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#d5e8f5] rounded-sm overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 bg-[#f5faff] hover:bg-[#e8f4fd] text-[12px] transition-colors cursor-pointer select-none"
      >
        <ChevronRight size={13} className={`text-[#1a4f72] transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
        <span className="font-semibold text-[#1a4f72] w-[90px] text-left shrink-0">{v.voucherNo}</span>
        <span className="text-gray-500 shrink-0">{getfmtDisplaydate(v.voucherDate)}</span>
        <span className="text-gray-600 flex-1 text-left truncate">{v.expensesBy}</span>
        <span className="text-gray-500 w-[80px] text-left shrink-0">{v.modeOfPayment}</span>
        <span className="font-semibold text-gray-800 w-[100px] text-right font-mono shrink-0">{formatAmount(v.totalAmount)}</span>
        <span className="w-[110px] text-right shrink-0"><StatusBadge status={v.workflowStatus} /></span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); router.push(`/finance-management/account/petty-cash/docket-voucher/${v.id}`); }}
          className="text-[11px] text-blue-600 hover:underline whitespace-nowrap ml-2 shrink-0"
        >
          Open →
        </button>
      </div>
      {open && (
        <div className="border-t border-[#d5e8f5] bg-white overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-[#eef5fb]">
                <th className="border border-[#d5e8f5] px-2 py-1 text-left text-gray-500 w-[30px]">Sl</th>
                <th className="border border-[#d5e8f5] px-2 py-1 text-left text-gray-500 w-[80px]">CC Code</th>
                <th className="border border-[#d5e8f5] px-2 py-1 text-left text-gray-500">CC Name</th>
                <th className="border border-[#d5e8f5] px-2 py-1 text-left text-gray-500">Description</th>
                <th className="border border-[#d5e8f5] px-2 py-1 text-right text-gray-500 w-[100px]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(v.details || []).map((d, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f7fbff]"}>
                  <td className="border border-[#e5eff8] px-2 py-1 text-gray-400">{d.slNo}</td>
                  <td className="border border-[#e5eff8] px-2 py-1 font-medium text-[#1a4f72]">{d.ccCode}</td>
                  <td className="border border-[#e5eff8] px-2 py-1">{d.ccName}</td>
                  <td className="border border-[#e5eff8] px-2 py-1 text-gray-500">{d.shortDescription || "—"}</td>
                  <td className="border border-[#e5eff8] px-2 py-1 text-right font-mono font-semibold">{formatAmount(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Summary stat chips ──────────────────────────────────────────────────────
function SummaryChips({ s }) {
  const chips = [
    { label: "Total",     value: formatAmount(s.totalBudgetAmount), color: "text-gray-700 bg-gray-100 border-gray-200" },
    { label: "Used",      value: formatAmount(s.totalUsed),         color: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Remaining", value: formatAmount(s.totalRemaining),    color: Number(s.totalRemaining) < 0 ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <div key={c.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11.5px] ${c.color}`}>
          <span className="font-medium">{c.label}:</span>
          <span className="font-bold font-mono">{c.value}</span>
        </div>
      ))}
      {[
        { label: "Approved",  val: s.approvedVouchers,  col: "text-green-700  bg-green-50  border-green-200"  },
        { label: "Pending",   val: s.pendingVouchers,   col: "text-blue-700   bg-blue-50   border-blue-200"   },
        { label: "Draft",     val: s.draftVouchers,     col: "text-gray-600   bg-gray-50   border-gray-200"   },
        { label: "Reback",    val: s.rebackVouchers,    col: "text-orange-700 bg-orange-50 border-orange-200" },
        { label: "Rejected",  val: s.rejectedVouchers,  col: "text-red-700    bg-red-50    border-red-200"    },
      ].filter((x) => x.val > 0).map((x) => (
        <div key={x.label} className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] ${x.col}`}>
          <FileText size={11} />
          <span>{x.label}: <strong>{x.val}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ─── Budget detail panel (lazy loaded) ───────────────────────────────────────
const VOUCHER_PAGE_SIZE = 10;

function BudgetDetail({ budgetId, budgetMeta, router }) {
  const [detail,      setDetail]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [vPage,       setVPage]       = useState(1);
  const [vPagination, setVPagination] = useState(null);
  const [dlBusy,      setDlBusy]      = useState(false);

  const fetchDetail = useCallback((page) => {
    setLoading(true);
    const params = new URLSearchParams({ voucherPage: page, voucherPageSize: VOUCHER_PAGE_SIZE });
    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.LEDGER.BUDGET_DETAIL}${budgetId}?${params}`,
      method: "GET",
    })
      .then((res) => {
        setDetail(res.data);
        setVPagination(res.data?.voucherPagination || null);
      })
      .catch(() => toast.error("Failed to load budget detail"))
      .finally(() => setLoading(false));
  }, [budgetId]);

  useEffect(() => { fetchDetail(1); }, [fetchDetail]);

  const handleVPage = (p) => { setVPage(p); fetchDetail(p); };

  if (loading && !detail) return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-[#144664]" /></div>;
  if (!detail) return null;

  const { ccSummary, vouchers, summary, budget } = detail;

  const handleDownload = async () => {
    setDlBusy(true);
    try {
      await downloadBudgetDetailPDF({ budget: budget || budgetMeta, ccSummary, vouchers, summary });
    } finally {
      setDlBusy(false);
    }
  };

  return (
    <div className="p-3 space-y-4">
      {/* Summary chips + download */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <SummaryChips s={summary || {}} />
        <button
          onClick={handleDownload}
          disabled={dlBusy}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#e8f0e8] hover:bg-[#d0e4d0] text-[#2d7a2d] text-[12px] font-semibold rounded border border-[#a3c8a3] transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {dlBusy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          PDF
        </button>
      </div>

      {/* CC Breakdown */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">CC-wise Breakdown</div>
        <CcSummaryTable rows={ccSummary} />
      </div>

      {/* Vouchers */}
      {(vouchers?.length > 0 || vPagination) && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Vouchers {vPagination ? `(${vPagination.total})` : `(${vouchers?.length ?? 0})`}
          </div>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#144664]" /></div>
          ) : (
            <div className="border border-[#d5e8f5] rounded-sm overflow-hidden">
              <div className="space-y-0 divide-y divide-[#d5e8f5]">
                {(vouchers || []).map((v) => <VoucherRow key={v.id} v={v} router={router} />)}
              </div>
              {vPagination && vPagination.totalPages > 1 && (
                <Paginator
                  page={vPage}
                  totalPages={vPagination.totalPages}
                  total={vPagination.total}
                  pageSize={VOUCHER_PAGE_SIZE}
                  onPage={handleVPage}
                  loading={loading}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Budget card in list ──────────────────────────────────────────────────────
function BudgetCard({ b, router }) {
  const [open, setOpen] = useState(false);
  const usedPct = pct(b.totalUsed, b.totalBudgetAmount);
  const rem     = Number(b.totalRemaining ?? 0);

  return (
    <div className="border border-[#c5d8e8] rounded-md overflow-hidden">
      {/* Card header — clickable */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 bg-[#f0f7fd] hover:bg-[#e2f0fa] transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-[130px]">
          <Wallet size={15} className="text-[#1a4f72] shrink-0" />
          <span className="font-bold text-[13px] text-[#144664]">{b.budgetNo}</span>
        </div>
        <span className="text-[11.5px] text-gray-500">{b.budgetFrequency}</span>
        <span className="text-[11.5px] text-gray-600">
          {getfmtDisplaydate(b.fromDate)} → {getfmtDisplaydate(b.toDate)}
        </span>
        <span className="text-[11.5px] text-gray-400">{getfmtDisplaydate(b.budgetDate)}</span>

        <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
          {/* Amount bar */}
          <div className="w-[160px]">
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Used: {formatAmount(b.totalUsed)}</span>
              <span className={rem < 0 ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
                Rem: {formatAmount(rem)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${usedPct >= 100 ? "bg-red-500" : usedPct >= 80 ? "bg-amber-500" : "bg-[#144664]"}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5 text-right">
              Total: {formatAmount(b.totalBudgetAmount)}
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <FileText size={12} />
            {b.voucherCount} voucher{b.voucherCount !== 1 ? "s" : ""}
          </div>

          <StatusBadge status={b.workflowStatus} />

          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Expandable detail */}
      {open && (
        <div className="border-t border-[#c5d8e8] bg-white">
          <BudgetDetail budgetId={b.id} budgetMeta={b} router={router} />
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
const LIST_PAGE_SIZE = 10;

export default function PettyCashPage() {
  const router  = useRouter();
  const access  = getPageAccess({ pageCode: "petty_cash", pageType: "LIST" });

  const [fromDate,    setFromDate]    = useState("");
  const [toDate,      setToDate]      = useState("");
  const [list,        setList]        = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [fetched,     setFetched]     = useState(false);
  const [navOpen,     setNavOpen]     = useState(true);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const fetchList = useCallback(async (p = 1) => {
    if (!projectCode) { toast.error("No project selected"); return; }
    setLoading(true);
    if (p === 1) { setList([]); setFetched(false); setPagination(null); }
    try {
      const params = new URLSearchParams({ projectCode, page: p, pageSize: LIST_PAGE_SIZE });
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate)   params.set("toDate", toDate);
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.LEDGER.LIST}?${params}`,
        method: "GET",
      });
      setList(res.data?.list || []);
      setPagination(res.data?.pagination || null);
      setFetched(true);
    } catch (err) {
      toast.error(err?.message || "Failed to fetch petty cash ledger");
    } finally {
      setLoading(false);
    }
  }, [projectCode, fromDate, toDate]);

  const handleFetch = () => { setPage(1); fetchList(1); };

  const handlePage = (p) => { setPage(p); fetchList(p); };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setList([]);
    setPagination(null);
    setPage(1);
    setFetched(false);
  };

  const handleListDownload = () => downloadListPDF({ list, projectCode, fromDate, toDate });

  const actions = getPageActions({
    router,
    onDownload: fetched && list.length > 0 ? handleListDownload : undefined,
  });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">

        {/* Navigation buttons */}
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
                Voucher Docket
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
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm" />
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>To</FilterLabel>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleFetch()} disabled={loading || !projectCode}
              className="flex items-center gap-1.5 px-4 py-1 bg-[#144664] hover:bg-[#0f3550] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Fetch
            </button>
            {fetched && (
              <>
                <button onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-semibold rounded-sm border border-gray-300 transition-colors">
                  <RefreshCw size={13} />
                  Reset
                </button>
                {list.length > 0 && (
                  <button onClick={handleListDownload}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#e8f0e8] hover:bg-[#d0e4d0] text-[#2d7a2d] text-[13px] font-semibold rounded-sm border border-[#a3c8a3] transition-colors">
                    <Download size={13} />
                    PDF
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        )}

        {!loading && !fetched && (
          <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 gap-2">
            <Search size={36} strokeWidth={1.2} />
            <p className="text-sm">Click <strong>Fetch</strong> to load petty cash ledger</p>
          </div>
        )}

        {!loading && fetched && list.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400">No budgets found for the selected filters.</div>
        )}

        {!loading && fetched && list.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11.5px] text-gray-400">
              {pagination ? `${pagination.total} budget${pagination.total !== 1 ? "s" : ""}` : `${list.length} budget${list.length !== 1 ? "s" : ""}`} found
            </div>
            {list.map((b) => <BudgetCard key={b.id} b={b} router={router} />)}
            {pagination && pagination.totalPages > 1 && (
              <div className="border border-[#c5d8e8] rounded-md overflow-hidden">
                <Paginator
                  page={page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  pageSize={LIST_PAGE_SIZE}
                  onPage={handlePage}
                  loading={loading}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </HeaderWrapper>
  );
}
