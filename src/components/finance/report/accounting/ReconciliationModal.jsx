"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, ExternalLink, ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { getNarrationHint } from "@/components/finance/report/accounting/shared";

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
              <tr key={i} className={`border-b border-[#f0f0f0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f4f8]`}>
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
          <button onClick={onClose} className="p-1 hover:bg-white/15 transition-colors shrink-0">
            <X size={16} />
          </button>
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
