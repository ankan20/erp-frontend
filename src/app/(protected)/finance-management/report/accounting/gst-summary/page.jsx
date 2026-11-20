"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import { usePageActions } from "@/components/common/PageActionButtons";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";
import { apiRequest } from "@/lib/apiClient";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { getNarrationHint } from "@/components/finance/report/accounting/shared";

import AccountingFilterBar from "@/components/finance/report/accounting/AccountingFilterBar";
import useAccountingFetch from "@/components/finance/report/accounting/useAccountingFetch";

function fmtBalDrCr(val) {
  if (val == null || val === 0) return "—";
  const abs = Math.abs(val);
  const side = val > 0 ? "Dr" : "Cr";
  return `${formatAmount(abs)} ${side}`;
}

/* ── Inline GST Reconciliation Modal ──────────────────────────────── */

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
        <span className="flex-1">{group.sourceType.replace(/_/g, " ")}</span>
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

function GstReconciliationModal({ open, onClose, gstType, drCr, fromDate, toDate, projectCode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    if (!gstType) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("gst_type", gstType);
      if (drCr) params.set("dr_cr", drCr);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (projectCode) params.set("project_code", projectCode);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.GST_RECONCILIATION}?${params}`,
        method: "GET",
      });
      setData(res?.data ?? null);
    } catch (err) {
      toast.error(err?.message || "Failed to load GST reconciliation data");
    } finally {
      setLoading(false);
    }
  }, [gstType, drCr, fromDate, toDate, projectCode]);

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
  const sideLabel = drCr === "Dr" ? "Input" : drCr === "Cr" ? "Output" : "All";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[4vh]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white shadow-xl w-[92vw] max-w-[1050px] max-h-[88vh] flex flex-col border border-[#d1d5db]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#d1d5db] bg-[#1b2f3a] text-white">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold truncate">
              {gstType} — {sideLabel} GST Reconciliation
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

        {data && !loading && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[#e5e7eb] bg-[#f9fafb]">
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
            <div className="flex items-center gap-4 ml-auto text-[11.5px]">
              <span className="text-[#374151]">
                Dr: <span className="tabular-nums font-medium text-[#166534]">{formatAmount(data.totalDebit)}</span>
              </span>
              <span className="text-[#374151]">
                Cr: <span className="tabular-nums font-medium text-[#991b1b]">{formatAmount(data.totalCredit)}</span>
              </span>
              <span className="text-[#374151] font-medium">
                Net: <span className="tabular-nums font-semibold text-[#1b2f3a]">
                  {fmtBalDrCr(data.net)}
                </span>
              </span>
            </div>
          </div>
        )}

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

/* ── Main Page ────────────────────────────────────────────────────── */

export default function GstSummaryPage() {
  const access = getPageAccess({ pageCode: "accounting_gst_summary", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.GST_SUMMARY);

  const actions = usePageActions({ router });

  const [reconModal, setReconModal] = useState(null);

  const allTypes = useMemo(() => {
    if (!data?.input && !data?.output) return [];
    return [...new Set([...Object.keys(data.input || {}), ...Object.keys(data.output || {})])].sort();
  }, [data]);

  const totalInput = data?.totalInput || 0;
  const totalOutput = data?.totalOutput || 0;
  const netPayable = data?.netPayable || 0;

  const openRecon = (gstType, drCr) => {
    setReconModal({ gstType, drCr });
  };

  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — GST Summary</h2>

        <AccountingFilterBar
          projectList={projectList}
          projectCode={projectCode}
          setProjectCode={setProjectCode}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          loading={loading}
          fetched={fetched}
          onFetch={handleFetch}
          onReset={handleReset}
        />

        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <EdoxMark size={32} />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Choose a period and press Fetch to view the GST Summary
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className="border border-[#d1d5db] bg-[#f8f9fb] p-3 cursor-pointer hover:bg-[#f0f4f8] transition-colors"
                onClick={() => openRecon(null, "Dr")}
                title="Click to reconcile all Input GST"
              >
                <div className="text-[11px] text-[#6b7280] font-medium">Input GST (Purchases)</div>
                <div className="text-[18px] font-bold tabular-nums text-[#374151] mt-1">{formatAmount(totalInput)}</div>
                <div className="text-[10px] text-[#9ca3af] mt-0.5">Click to reconcile</div>
              </div>
              <div
                className="border border-[#d1d5db] bg-[#f8f9fb] p-3 cursor-pointer hover:bg-[#f0f4f8] transition-colors"
                onClick={() => openRecon(null, "Cr")}
                title="Click to reconcile all Output GST"
              >
                <div className="text-[11px] text-[#6b7280] font-medium">Output GST (Sales)</div>
                <div className="text-[18px] font-bold tabular-nums text-[#374151] mt-1">{formatAmount(totalOutput)}</div>
                <div className="text-[10px] text-[#9ca3af] mt-0.5">Click to reconcile</div>
              </div>
              <div className="border border-[#d1d5db] bg-[#f8f9fb] p-3">
                <div className="text-[11px] text-[#6b7280] font-medium">
                  {netPayable >= 0 ? "Net GST Payable" : "Net GST Refundable"}
                </div>
                <div className="text-[18px] font-bold tabular-nums text-[#144664] mt-1">
                  {netPayable === 0 ? "—" : `${formatAmount(Math.abs(netPayable))} ${netPayable > 0 ? "Cr" : "Dr"}`}
                </div>
              </div>
            </div>

            {/* Detail Table */}
            {allTypes.length > 0 && (
              <>
                <span className="text-[11.5px] text-[#6b7280]">{allTypes.length} GST type{allTypes.length !== 1 ? "s" : ""}</span>
                <div className="border border-[#d1d5db] overflow-x-auto">
                  <table className="w-full text-[12px] border-collapse">
                    <thead>
                      <tr className="bg-[#1b2f3a]">
                        <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">GST Type</th>
                        <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[130px]">Input (Dr)</th>
                        <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[130px]">Output (Cr)</th>
                        <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] w-[140px]">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTypes.map((t, i) => {
                        const inp = (data.input || {})[t] || 0;
                        const out = (data.output || {})[t] || 0;
                        const net = out - inp;
                        return (
                          <tr
                            key={t}
                            className={`border-b border-[#e5e7eb] ${i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f4f8] transition-colors cursor-pointer`}
                            onClick={() => openRecon(t, null)}
                            title={`Click to reconcile ${t}`}
                          >
                            <td className="px-2 py-[5px] font-medium text-[#374151] border-r border-[#f0f0f0]">
                              {t}
                              <span className="ml-2 text-[10px] text-[#9ca3af]">reconcile →</span>
                            </td>
                            <td className="px-2 py-[5px] text-right tabular-nums text-[#374151] border-r border-[#f0f0f0]">{formatAmount(inp)}</td>
                            <td className="px-2 py-[5px] text-right tabular-nums text-[#374151] border-r border-[#f0f0f0]">{formatAmount(out)}</td>
                            <td className="px-2 py-[5px] text-right tabular-nums font-medium text-[#374151]">
                              {net === 0 ? "—" : `${formatAmount(Math.abs(net))} ${net > 0 ? "Cr" : "Dr"}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#1b2f3a] text-white text-[11.5px] font-medium">
                        <td className="px-2 py-[5px] border-r border-[#2a4a5a]">Total</td>
                        <td className="px-2 py-[5px] text-right tabular-nums border-r border-[#2a4a5a]">{formatAmount(totalInput)}</td>
                        <td className="px-2 py-[5px] text-right tabular-nums border-r border-[#2a4a5a]">{formatAmount(totalOutput)}</td>
                        <td className="px-2 py-[5px] text-right tabular-nums">
                          {netPayable === 0 ? "—" : `${formatAmount(Math.abs(netPayable))} ${netPayable > 0 ? "Cr" : "Dr"}`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* GST Reconciliation Modal */}
      <GstReconciliationModal
        open={!!reconModal}
        onClose={() => setReconModal(null)}
        gstType={reconModal?.gstType}
        drCr={reconModal?.drCr}
        fromDate={fromDate}
        toDate={toDate}
        projectCode={projectCode}
      />
    </HeaderWrapper>
  );
}
