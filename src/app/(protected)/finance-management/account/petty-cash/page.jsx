"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, RefreshCw, Download, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable   from "@/components/common/PageNotAvailable";
import NavigationButton   from "@/components/common/NavigationButton";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }   from "@/helper/numberFormatter";

const PC_LEDGER = API_ENDPOINTS.FINANCE.PETTY_CASH.LEDGER;
const PAGE_SIZE = 20;

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt   = (v) => formatAmount(Number(v || 0));
const fmtD  = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d) ? raw : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── PDF download ─────────────────────────────────────────────────────────────
async function downloadLedgerPDF({ account, entries, summary, projectCode, fromDate, toDate }) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Petty Cash Account Ledger", pageW / 2, y, { align: "center" });
  y += 6;

  const parts = [`Project: ${projectCode}`];
  if (account) parts.push(`Account: ${account.bankCode} — ${account.bankName}`);
  if (fromDate) parts.push(`From: ${fromDate}`);
  if (toDate)   parts.push(`To: ${toDate}`);
  doc.setFontSize(8); doc.setFont("helvetica", "italic");
  doc.text(parts.join("   |   "), pageW / 2, y, { align: "center" });
  y += 5;

  // Summary bar
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(
    `Credit: ${fmt(summary?.totalCredit)}   |   Debit: ${fmt(summary?.totalDebit)}   |   Balance: ${fmt(summary?.balance)}   |   Pending: ${fmt(summary?.pendingDebit)}`,
    14, y,
  );
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Date", "Type", "Reference No", "Description", "Account", "Debit (DR)", "Credit (CR)", "Balance"]],
    body: (entries || []).map((e) => [
      fmtD(e.date),
      e.type,
      e.referenceNo || "—",
      e.description || "—",
      e.bankCode || "—",
      e.debit  > 0 ? fmt(e.debit)  : "—",
      e.credit > 0 ? fmt(e.credit) : "—",
      fmt(e.balance),
    ]),
    theme: "grid",
    headStyles: { fillColor: [20, 70, 100], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [242, 248, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18, halign: "center" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 10, right: 10 },
  });

  doc.save(`PettyCash_Ledger_${projectCode}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function downloadPendingPDF({ account, entries, projectCode }) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Petty Cash — Under Process Dockets", pageW / 2, y, { align: "center" });
  y += 6;

  const parts = [`Project: ${projectCode}`];
  if (account) parts.push(`Account: ${account.bankCode} — ${account.bankName}`);
  doc.setFontSize(8); doc.setFont("helvetica", "italic");
  doc.text(parts.join("   |   "), pageW / 2, y, { align: "center" });
  y += 7;

  const statusLabel = (s) => {
    if (!s) return "—";
    const k = s.toLowerCase();
    return k.startsWith("pending") ? "Under Process" : k === "draft" ? "Draft" : k === "reback" ? "Reback" : s;
  };

  autoTable(doc, {
    startY: y,
    head: [["Date", "Reference No", "Description", "Account", "Debit (DR)", "Status"]],
    body: (entries || []).map((e) => [
      fmtD(e.date),
      e.referenceNo || "—",
      e.description || "—",
      e.bankCode || "—",
      fmt(e.debit),
      statusLabel(e.workflowStatus),
    ]),
    theme: "grid",
    headStyles: { fillColor: [180, 120, 20], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [255, 253, 240] },
    columnStyles: {
      0: { cellWidth: 22 },
      4: { halign: "right" },
      5: { halign: "center" },
    },
    margin: { left: 10, right: 10 },
  });

  doc.save(`PettyCash_UnderProcess_${projectCode}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Type badge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const isContra = type === "Contra";
  return (
    <span className={`inline-block text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${
      isContra ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
    }`}>
      {type}
    </span>
  );
}

// ─── InfoBar ─────────────────────────────────────────────────────────────────
function InfoBar({ account, summary }) {
  const bal = Number(summary?.balance ?? 0);
  const pending = Number(summary?.pendingDebit ?? 0);
  return (
    <div className="flex flex-wrap items-center gap-x-1 px-3 py-2 bg-[#f0f4f8] border border-[#c4d1df] rounded-sm text-[12px]">
      {/* Left: account identity */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 flex-1 min-w-0">
        {account ? (
          <>
            <span>
              <span className="text-gray-500 font-semibold">Code:</span>{" "}
              <span className="font-semibold text-[#144664]">{account.bankCode}</span>
            </span>
            <span>
              <span className="text-gray-500 font-semibold">Name:</span>{" "}
              <span className="font-semibold">{account.bankName}</span>
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
              account.accountType === "Cash"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {account.accountType}
            </span>
          </>
        ) : (
          <span className="text-gray-500 italic text-[12px]">All linked accounts combined</span>
        )}
      </div>

      {/* Right: summary */}
      {summary && (
        <div className="flex items-center gap-3 shrink-0 border-l border-[#c4d1df] pl-3 ml-2">
          <span className="whitespace-nowrap">
            <span className="text-gray-500 font-semibold">Credit:</span>{" "}
            <span className="font-semibold text-[#2d7a2d]">{fmt(summary.totalCredit)}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span className="whitespace-nowrap">
            <span className="text-gray-500 font-semibold">Debit:</span>{" "}
            <span className="font-semibold text-[#a32020]">{fmt(summary.totalDebit)}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span className="whitespace-nowrap">
            <span className="text-gray-500 font-semibold">Balance:</span>{" "}
            <span className={`font-bold ${bal < 0 ? "text-[#a32020]" : "text-[#2d7a2d]"}`}>{fmt(bal)}</span>
          </span>
          {pending > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="whitespace-nowrap text-[11px]">
                <span className="text-amber-600 font-semibold">Pending:</span>{" "}
                <span className="font-semibold text-amber-700">{fmt(pending)}</span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Status badge (for pending entries) ──────────────────────────────────────
function StatusBadge({ status }) {
  if (!status) return null;
  const key = status.toLowerCase();
  const label = key.startsWith("pending") ? "Under Process"
    : key === "draft"  ? "Draft"
    : key === "reback" ? "Reback"
    : status;
  const cls = key.startsWith("pending") ? "bg-blue-100 text-blue-700"
    : key === "draft"  ? "bg-gray-100 text-gray-600"
    : key === "reback" ? "bg-amber-100 text-amber-700"
    : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Under-process section ────────────────────────────────────────────────────
function PendingEntriesTable({ entries, account, projectCode }) {
  const [dlBusy, setDlBusy] = useState(false);
  if (!entries?.length) return null;
  const totalPending = entries.reduce((s, e) => s + Number(e.debit || 0), 0);

  const handleDl = async () => {
    setDlBusy(true);
    try { await downloadPendingPDF({ account, entries, projectCode }); }
    finally { setDlBusy(false); }
  };

  return (
    <div className="border border-[#f0d88a] rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 border-b border-[#f0d88a]">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-amber-800">
          Under Process — Pending Dockets
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11.5px] font-semibold text-amber-700 font-mono">
            {fmt(totalPending)} DR pending
          </span>
          <button
            onClick={handleDl}
            disabled={dlBusy}
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-amber-400 text-amber-800 bg-white hover:bg-amber-50 disabled:opacity-50 font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {dlBusy ? "…" : "PDF"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] min-w-[600px]">
          <thead>
            <tr className="bg-[#fef3c7]">
              <th className="border border-[#f0d88a] px-2 py-1.5 text-left w-[100px] text-amber-900">Date</th>
              <th className="border border-[#f0d88a] px-2 py-1.5 text-left w-[110px] text-amber-900">Reference No</th>
              <th className="border border-[#f0d88a] px-2 py-1.5 text-left text-amber-900">Description</th>
              <th className="border border-[#f0d88a] px-2 py-1.5 text-left w-[90px] text-amber-900">Account</th>
              <th className="border border-[#f0d88a] px-2 py-1.5 text-right w-[120px] text-amber-900">Debit (DR)</th>
              <th className="border border-[#f0d88a] px-2 py-1.5 text-center w-[120px] text-amber-900">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#fffdf0]"}>
                <td className="border border-[#f0e8c0] px-2 py-1.5 text-gray-600">{fmtD(e.date)}</td>
                <td className="border border-[#f0e8c0] px-2 py-1.5 font-medium text-amber-800">{e.referenceNo || "—"}</td>
                <td className="border border-[#f0e8c0] px-2 py-1.5 text-gray-600">{e.description || "—"}</td>
                <td className="border border-[#f0e8c0] px-2 py-1.5 text-gray-500 font-mono text-[11px]">{e.bankCode || "—"}</td>
                <td className="border border-[#f0e8c0] px-2 py-1.5 text-right font-mono font-semibold text-amber-800">
                  {fmt(e.debit)}
                </td>
                <td className="border border-[#f0e8c0] px-2 py-1.5 text-center">
                  <StatusBadge status={e.workflowStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Approved ledger table ────────────────────────────────────────────────────
function LedgerTable({ entries }) {
  if (!entries?.length) {
    return <div className="text-center py-8 text-sm text-gray-400">No approved entries found.</div>;
  }
  return (
    <div className="overflow-x-auto border border-[#b5c9d8] rounded-sm">
      <table className="w-full border-collapse text-[12px] min-w-[700px]">
        <thead>
          <tr className="bg-[#144664] text-white">
            <th className="border border-[#1e5c7e] px-2 py-1.5 text-left w-[100px]">Date</th>
            <th className="border border-[#1e5c7e] px-2 py-1.5 text-center w-[80px]">Type</th>
            <th className="border border-[#1e5c7e] px-2 py-1.5 text-left w-[110px]">Reference No</th>
            <th className="border border-[#1e5c7e] px-2 py-1.5 text-left">Description</th>
            <th className="border border-[#1e5c7e] px-2 py-1.5 text-left w-[90px]">Account</th>
            <th className="border border-[#1e5c7e] px-2 py-1.5 text-right w-[110px]">Debit (DR)</th>
            <th className="border border-[#1e5c7e] px-2 py-1.5 text-right w-[110px]">Credit (CR)</th>
            <th className="border border-[#1e5c7e] px-2 py-1.5 text-right w-[120px]">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const bal = Number(e.balance ?? 0);
            return (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f7fbff]"}>
                <td className="border border-[#d5e8f5] px-2 py-1.5 text-gray-600">{fmtD(e.date)}</td>
                <td className="border border-[#d5e8f5] px-2 py-1.5 text-center">
                  <TypeBadge type={e.type} />
                </td>
                <td className="border border-[#d5e8f5] px-2 py-1.5 font-medium text-[#1a4f72]">{e.referenceNo || "—"}</td>
                <td className="border border-[#d5e8f5] px-2 py-1.5 text-gray-600">{e.description || "—"}</td>
                <td className="border border-[#d5e8f5] px-2 py-1.5 text-gray-500 font-mono text-[11px]">{e.bankCode || "—"}</td>
                <td className="border border-[#d5e8f5] px-2 py-1.5 text-right font-mono">
                  {e.debit > 0 ? <span className="text-[#a32020] font-semibold">{fmt(e.debit)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="border border-[#d5e8f5] px-2 py-1.5 text-right font-mono">
                  {e.credit > 0 ? <span className="text-[#2d7a2d] font-semibold">{fmt(e.credit)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className={`border border-[#d5e8f5] px-2 py-1.5 text-right font-mono font-bold ${bal < 0 ? "text-[#a32020]" : "text-[#144664]"}`}>
                  {fmt(bal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Paginator ────────────────────────────────────────────────────────────────
function Paginator({ page, totalPages, total, onPage, loading }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border border-[#c4d1df] rounded-sm bg-[#f7fbff] text-[11.5px] text-gray-600 mt-1">
      <span>Page {page} of {totalPages} · {total} entr{total !== 1 ? "ies" : "y"}</span>
      <div className="flex items-center gap-1">
        <button disabled={page === 1 || loading} onClick={() => onPage(page - 1)}
          className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition">
          ‹ Prev
        </button>
        {pages.map((p, i) =>
          p === "…" ? <span key={`e${i}`} className="px-1">…</span> : (
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PettyCashPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "petty_cash", pageType: "LIST" });

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [navOpen,       setNavOpen]       = useState(true);
  const [accounts,      setAccounts]      = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedId,    setSelectedId]    = useState("");   // "" = all combined
  const [fromDate,      setFromDate]      = useState("");
  const [toDate,        setToDate]        = useState("");

  const [ledger,        setLedger]        = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [fetched,       setFetched]       = useState(false);
  const [page,          setPage]          = useState(1);
  const [dlBusy,        setDlBusy]        = useState(false);

  // Load project-linked accounts on mount
  useEffect(() => {
    if (!projectCode) return;
    setAccountsLoading(true);
    apiRequest({ url: `${PC_LEDGER.PROJECT_ACCOUNTS}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => setAccounts(res.data?.accounts || []))
      .catch(() => toast.error("Failed to load project accounts"))
      .finally(() => setAccountsLoading(false));
  }, [projectCode]);

  const fetchLedger = useCallback(async (p = 1) => {
    if (!projectCode) { toast.error("No project selected"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectCode, page: p, pageSize: PAGE_SIZE });
      if (selectedId) params.set("bankCashId", selectedId);
      if (fromDate)   params.set("fromDate", fromDate);
      if (toDate)     params.set("toDate", toDate);
      const res = await apiRequest({ url: `${PC_LEDGER.ACCOUNT_LEDGER}?${params}`, method: "GET" });
      setLedger(res.data);
      setPage(p);
      setFetched(true);
    } catch (err) {
      toast.error(err?.message || "Failed to fetch ledger");
    } finally {
      setLoading(false);
    }
  }, [projectCode, selectedId, fromDate, toDate]);

  const handleFetch = () => fetchLedger(1);

  const handleReset = () => {
    setSelectedId("");
    setFromDate("");
    setToDate("");
    setLedger(null);
    setFetched(false);
    setPage(1);
  };

  const handleDownload = async () => {
    setDlBusy(true);
    try {
      await downloadLedgerPDF({
        account:     ledger?.account,
        entries:     ledger?.entries || [],
        summary:     ledger?.summary,
        projectCode,
        fromDate,
        toDate,
      });
    } finally {
      setDlBusy(false);
    }
  };

  const actions = getPageActions({
    router,
    onDownload: fetched && ledger?.entries?.length ? handleDownload : undefined,
  });

  if (!access.allowed) return <PageNotAvailable />;

  const selectedAccount = accounts.find((a) => String(a.bankCashId) === String(selectedId)) || null;
  const pagination      = ledger?.pagination || null;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">

        {/* Navigation */}
        <div className="flex items-center justify-between border-b pb-2">
          <button type="button" onClick={() => setNavOpen((v) => !v)}
            className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 transition-colors">
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
          {/* Project */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] rounded-sm whitespace-nowrap">Project</div>
            <span className="text-[13px] font-semibold px-2">{projectCode || "—"}</span>
          </div>

          {/* Account selector */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] rounded-sm whitespace-nowrap">Account</div>
            {accountsLoading ? (
              <Loader2 size={14} className="animate-spin text-gray-400" />
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-7 border border-[#8f8f8f] px-2 text-[13px] rounded-sm bg-white min-w-[200px]"
              >
                <option value="">All accounts (combined)</option>
                {accounts.map((a) => (
                  <option key={a.bankCashId} value={a.bankCashId}>
                    {a.bankCode} — {a.bankName} ({a.accountType})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] rounded-sm">From</div>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm" />
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] rounded-sm">To</div>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={handleFetch} disabled={loading || !projectCode}
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
                {ledger?.entries?.length > 0 && (
                  <button onClick={handleDownload} disabled={dlBusy}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#e8f0e8] hover:bg-[#d0e4d0] text-[#2d7a2d] text-[13px] font-semibold rounded-sm border border-[#a3c8a3] transition-colors disabled:opacity-60">
                    {dlBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    PDF
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !fetched && (
          <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 gap-2">
            <Search size={36} strokeWidth={1.2} />
            <p className="text-sm">Select an account and click <strong>Fetch</strong> to view the ledger</p>
          </div>
        )}

        {/* No data */}
        {!loading && fetched && !ledger?.entries?.length && !ledger?.pendingEntries?.length && (
          <div className="text-center py-10 text-sm text-gray-400">No ledger entries found for the selected filters.</div>
        )}

        {/* Ledger */}
        {!loading && fetched && (ledger?.entries?.length > 0 || ledger?.pendingEntries?.length > 0) && (
          <div className="space-y-3">
            <InfoBar account={ledger.account} summary={ledger.summary} />
            {/* Under-process pending dockets */}
            {ledger.pendingEntries?.length > 0 && (
              <PendingEntriesTable entries={ledger.pendingEntries} account={ledger.account} projectCode={projectCode} />
            )}
            {/* Approved ledger */}
            {ledger.entries?.length > 0 && (
              <>
                {ledger.pendingEntries?.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 border-t border-[#b5c9d8]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#144664] px-2">Approved Ledger</span>
                    <div className="flex-1 border-t border-[#b5c9d8]" />
                  </div>
                )}
                <LedgerTable entries={ledger.entries} />
              </>
            )}
            {pagination && pagination.totalPages > 1 && (
              <Paginator
                page={page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPage={(p) => fetchLedger(p)}
                loading={loading}
              />
            )}
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
