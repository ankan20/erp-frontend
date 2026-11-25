"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, ExternalLink, ChevronDown, ChevronRight, Search, Download } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { getNarrationHint } from "@/components/finance/report/accounting/shared";
import { getLocalStorage } from "@/lib/localStorage";

function NarrationCell({ narration }) {
  const hint = getNarrationHint(narration);
  const tooltipText = hint ? `${hint}\n\n${narration}` : narration;

  return (
    <td className="px-2 py-[3px] text-[#4b5563] max-w-[220px] truncate">
      <span
        className={hint ? "border-b border-dashed border-[#9ca3af] cursor-help" : ""}
        title={tooltipText || ""}
      >
        {narration || "—"}
      </span>
    </td>
  );
}

function SourceGroup({ group, showProject, searchTerm }) {
  const [open, setOpen] = useState(true);
  const Icon = open ? ChevronDown : ChevronRight;

  const filtered = useMemo(() => {
    if (!searchTerm) return group.entries;
    const q = searchTerm.toLowerCase();
    return group.entries.filter((e) =>
      (e.voucherNo || "").toLowerCase().includes(q) ||
      (e.narration || "").toLowerCase().includes(q) ||
      (e.projectCode || "").toLowerCase().includes(q) ||
      (e.date || "").includes(q)
    );
  }, [group.entries, searchTerm]);

  if (searchTerm && filtered.length === 0) return null;

  const totalDr = filtered.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCr = filtered.reduce((s, e) => s + (e.credit || 0), 0);

  return (
    <div className="border border-[#d1d5db] overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-[6px] bg-[#f3f4f6] hover:bg-[#ebedf0] text-left text-[12px] font-medium text-[#374151] transition-colors"
      >
        <Icon size={13} className="shrink-0 text-[#9ca3af]" />
        <span className="flex-1">
          {group.sourceType.replace(/_/g, " ")}
        </span>
        <span className="text-[10.5px] text-[#6b7280] tabular-nums">
          {filtered.length} txn{filtered.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[10.5px] text-[#166534] tabular-nums">
          Dr {formatAmount(searchTerm ? totalDr : group.totalDebit)}
        </span>
        <span className="text-[10.5px] text-[#991b1b] tabular-nums">
          Cr {formatAmount(searchTerm ? totalCr : group.totalCredit)}
        </span>
      </button>

      {open && (
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr className="bg-[#f9fafb] text-[10.5px] text-[#6b7280] border-b border-[#e5e7eb]">
              <th className="px-2 py-[4px] text-left font-medium w-[80px]">Date</th>
              <th className="px-2 py-[4px] text-left font-medium">Voucher</th>
              {showProject && <th className="px-2 py-[4px] text-left font-medium w-[80px]">Project</th>}
              <th className="px-2 py-[4px] text-left font-medium">Narration</th>
              <th className="px-2 py-[4px] text-right font-medium w-[90px]">Debit</th>
              <th className="px-2 py-[4px] text-right font-medium w-[90px]">Credit</th>
              <th className="px-2 py-[4px] w-[28px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr
                key={i}
                title={e.isCancelled ? `${e.cancelLabel || "Cancelled"} — nets to zero with its pair` : undefined}
                className={`border-b border-[#f0f0f0] ${e.isCancelled ? "bg-[#fdf2f2] line-through decoration-[#b91c1c]/60 opacity-70" : i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f4f8]`}
              >
                <td className="px-2 py-[3px] tabular-nums text-[#6b7280]">
                  {e.date ? getfmtDisplaydate(e.date) : "—"}
                </td>
                <td className="px-2 py-[3px] font-mono text-[10.5px] text-[#374151]">{e.voucherNo || "—"}</td>
                {showProject && (
                  <td className="px-2 py-[3px] text-[10.5px] text-[#6b7280]">{e.projectCode || "—"}</td>
                )}
                <NarrationCell narration={e.narration} />
                <td className="px-2 py-[3px] text-right tabular-nums text-[#166534]">
                  {e.debit ? formatAmount(e.debit) : "—"}
                </td>
                <td className="px-2 py-[3px] text-right tabular-nums text-[#991b1b]">
                  {e.credit ? formatAmount(e.credit) : "—"}
                </td>
                <td className="px-2 py-[3px] text-center">
                  {e.link && (
                    <Link href={e.link} target="_blank" className="text-[#2563eb] hover:text-[#1d4ed8]">
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showProject ? 7 : 6} className="px-2 py-3 text-center text-[#9ca3af] text-[11px]">
                  No matching transactions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const fmtINR = (v) =>
  Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function splitAmount(text) {
  if (typeof text !== "string") return null;
  const dot = text.lastIndexOf(".");
  if (dot === -1) return null;
  const intPart = text.slice(0, dot);
  const decPart = text.slice(dot);
  if (!/^\.\d+$/.test(decPart)) return null;
  return { intPart, decPart };
}

async function exportReconciliationPDF({ data, accountName, fromDate, toDate, projectCode, showProject }) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const co = (() => {
    const c = getLocalStorage("companyInfo") || {};
    return {
      name: c.companyName || c.company_name || "",
      address: c.address || "",
      contact: c.contact || c.phone || "",
      email: c.email || "",
    };
  })();
  let y = 12;

  if (co.name) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(co.name.toUpperCase(), pageW / 2, y, { align: "center" });
    y += 4.5;
  }
  if (co.address) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(co.address, pageW / 2, y, { align: "center" });
    y += 3;
  }
  const contactParts = [];
  if (co.contact) contactParts.push(`Ph: ${co.contact}`);
  if (co.email) contactParts.push(co.email);
  if (contactParts.length) {
    doc.setFontSize(6.5);
    doc.text(contactParts.join("   |   "), pageW / 2, y, { align: "center" });
    y += 3.5;
  }
  doc.setTextColor(0, 0, 0);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(10, y, pageW - 10, y);
  y += 4;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Reconciliation Statement", pageW / 2, y, { align: "center" });
  y += 4.5;

  doc.setFontSize(9);
  doc.text(accountName || "", pageW / 2, y, { align: "center" });
  y += 4;

  const meta = [];
  if (fromDate || toDate) meta.push(`${fromDate || "…"} to ${toDate || "…"}`);
  if (projectCode) meta.push(`Project: ${projectCode}`);
  else meta.push("All Projects");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(meta.join("     |     "), pageW / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 5;

  const amountCols = showProject ? [4, 5] : [3, 4];
  const head = showProject
    ? [["Date", "Voucher", "Project", "Narration", "Debit", "Credit"]]
    : [["Date", "Voucher", "Narration", "Debit", "Credit"]];

  const body = [];
  for (const group of (data.groups || [])) {
    const srcLabel = group.sourceType.replace(/_/g, " ");
    if (showProject) {
      body.push([
        { content: srcLabel, colSpan: 4, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
        { content: fmtINR(group.totalDebit), styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "right" } },
        { content: fmtINR(group.totalCredit), styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "right" } },
      ]);
    } else {
      body.push([
        { content: srcLabel, colSpan: 3, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
        { content: fmtINR(group.totalDebit), styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "right" } },
        { content: fmtINR(group.totalCredit), styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "right" } },
      ]);
    }

    for (const e of group.entries) {
      const row = [
        e.date || "—",
        e.voucherNo || "—",
      ];
      if (showProject) row.push(e.projectCode || "—");
      row.push(e.narration || "—");
      row.push(e.debit ? fmtINR(e.debit) : "—");
      row.push(e.credit ? fmtINR(e.credit) : "—");
      body.push(row);
    }
  }

  const foot = showProject
    ? [[
        { content: "Total", colSpan: 4, styles: { fontStyle: "bold" } },
        { content: fmtINR(data.totalDebit), styles: { halign: "right", fontStyle: "bold" } },
        { content: fmtINR(data.totalCredit), styles: { halign: "right", fontStyle: "bold" } },
      ]]
    : [[
        { content: "Total", colSpan: 3, styles: { fontStyle: "bold" } },
        { content: fmtINR(data.totalDebit), styles: { halign: "right", fontStyle: "bold" } },
        { content: fmtINR(data.totalCredit), styles: { halign: "right", fontStyle: "bold" } },
      ]];

  const netLabel = `Net: ${fmtINR(Math.abs(data.net))} ${data.net > 0 ? "Dr" : data.net < 0 ? "Cr" : ""}`;
  if (showProject) {
    foot.push([{ content: netLabel, colSpan: 6, styles: { fontStyle: "bold", halign: "right" } }]);
  } else {
    foot.push([{ content: netLabel, colSpan: 5, styles: { fontStyle: "bold", halign: "right" } }]);
  }

  const colStyles = {};
  for (const ci of amountCols) {
    colStyles[ci] = { halign: "right" };
  }

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
      lineColor: [200, 200, 200],
      lineWidth: 0.15,
      textColor: [30, 30, 30],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: "bold",
      fontSize: 7.5,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    bodyStyles: { fillColor: false },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: "bold",
      fontSize: 7.5,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    columnStyles: colStyles,
    margin: { left: 10, right: 10 },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.2,

    willDrawCell: (cellData) => {
      if (cellData.section !== "body" && cellData.section !== "foot") return;
      if (!amountCols.includes(cellData.column.index)) return;
      const text = (cellData.cell.text || []).join("");
      const parts = splitAmount(text);
      if (!parts) return;
      cellData.cell.text = [];
      cellData.cell._amountParts = parts;
    },

    didDrawCell: (cellData) => {
      if (!cellData.cell._amountParts) return;
      const { intPart, decPart } = cellData.cell._amountParts;
      const cell = cellData.cell;
      const styles = cell.styles;
      const x = cell.x + cell.width - styles.cellPadding.right;
      const yPos = cell.y + cell.height / 2 + 1;
      doc.setFont("helvetica", styles.fontStyle || "normal");
      doc.setFontSize(5.5);
      const decW = doc.getTextWidth(decPart);
      doc.setTextColor(...(styles.textColor || [30, 30, 30]));
      doc.text(decPart, x, yPos, { align: "right" });
      doc.setFontSize(styles.fontSize || 7.5);
      doc.text(intPart, x - decW, yPos, { align: "right" });
      doc.setTextColor(0, 0, 0);
    },

    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(10, pageH - 10, pageW - 10, pageH - 10);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 130);
      doc.text(
        `${co.name || ""}   |   ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
        10,
        pageH - 7,
      );
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageW - 10,
        pageH - 7,
        { align: "right" },
      );
      doc.setTextColor(0, 0, 0);
    },
  });

  const safeName = (accountName || "reconciliation").replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
  doc.save(`${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function ReconciliationModal({ open, onClose, accountType, accountId, accountName, fromDate, toDate, projectCode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    if (!accountType || !accountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("account_type", accountType);
      params.set("account_id", String(accountId));
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (projectCode) params.set("project_code", projectCode);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.RECONCILIATION}?${params}`,
        method: "GET",
      });
      setData(res?.data ?? null);
    } catch (err) {
      toast.error(err?.message || "Failed to load reconciliation data");
    } finally {
      setLoading(false);
    }
  }, [accountType, accountId, fromDate, toDate, projectCode]);

  useEffect(() => {
    if (open) {
      setData(null);
      setSearchTerm("");
      fetchData();
    }
  }, [open, fetchData]);

  if (!open) return null;

  const showProject = !projectCode;
  const totalEntries = data?.groups?.reduce((s, g) => s + (g.entries?.length || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[4vh]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white shadow-xl w-[92vw] max-w-[1050px] max-h-[88vh] flex flex-col border border-[#d1d5db]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#d1d5db] bg-[#1b2f3a] text-white">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold truncate">
              {accountName || `${accountType} #${accountId}`}
            </h2>
            <p className="text-[11px] text-white/70 truncate">
              {fromDate || toDate ? `${fromDate || "…"} to ${toDate || "…"}` : "All dates"}
              {projectCode ? ` · ${projectCode}` : " · All Projects"}
              {totalEntries > 0 && ` · ${totalEntries} entries`}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {data && !loading && (
              <button
                onClick={() => exportReconciliationPDF({ data, accountName: accountName || `${accountType} #${accountId}`, fromDate, toDate, projectCode, showProject })}
                className="p-1 hover:bg-white/15 transition-colors"
                title="Download PDF"
              >
                <Download size={14} />
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-white/15 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search + summary */}
        {data && !loading && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[#e5e7eb] bg-[#f9fafb]">
            {/* Search */}
            <div className="flex items-center gap-1.5 flex-1 max-w-[280px]">
              <Search size={13} className="text-[#9ca3af] shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search voucher, narration..."
                className="w-full h-[26px] px-2 text-[11.5px] border border-[#d1d5db] bg-white text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1b2f3a] focus:outline-none transition-colors"
              />
            </div>

            {/* Summary figures */}
            <div className="flex items-center gap-4 ml-auto text-[11.5px]">
              <span className="text-[#374151]">
                Dr: <span className="tabular-nums font-medium text-[#166534]">{formatAmount(data.totalDebit)}</span>
              </span>
              <span className="text-[#374151]">
                Cr: <span className="tabular-nums font-medium text-[#991b1b]">{formatAmount(data.totalCredit)}</span>
              </span>
              <span className="text-[#374151] font-medium">
                Net: <span className="tabular-nums font-semibold text-[#1b2f3a]">
                  {formatAmount(Math.abs(data.net))} {data.net > 0 ? "Dr" : data.net < 0 ? "Cr" : ""}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center items-center h-[200px]">
              <Loader2 className="animate-spin w-5 h-5 text-[#1b2f3a]" />
            </div>
          ) : !data ? (
            <div className="text-center text-[#9ca3af] py-10 text-[12px]">No data available</div>
          ) : data.groups?.length > 0 ? (
            data.groups.map((g, i) => (
              <SourceGroup key={i} group={g} showProject={showProject} searchTerm={searchTerm} />
            ))
          ) : (
            <div className="text-center text-[#9ca3af] py-8 text-[12px]">
              No transactions found in this period
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
