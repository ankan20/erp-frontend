"use client";

/**
 * "How is this value made?" for one Group Ledger row.
 *
 *   Group total  ->  accounts in it (CC / bank-cash / vendor)
 *                ->  same total split by document type
 *   Click an account -> ReconciliationModal (voucher-by-voucher, with links)
 *
 * Uses the same filters as the Group Ledger, so the parts always add up to
 * the number that was clicked.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";
import ReconciliationModal from "@/components/finance/report/accounting/ReconciliationModal";
import { SourceTypeBadge } from "@/components/finance/report/accounting/shared";

const ACCOUNT_TYPE_LABEL = { CC: "CC Code", Vendor: "Vendor", BankCash: "Bank / Cash" };

function drCr(val) {
  if (!val) return "—";
  return `${formatAmount(Math.abs(val))} ${val > 0 ? "Dr" : "Cr"}`;
}

function amt(val) {
  return val ? formatAmount(val) : "—";
}

const TH = "px-2 py-[5px] font-medium text-[10.5px] text-[#6b7280] whitespace-nowrap";
const TD = "px-2 py-[4px] tabular-nums";

export default function GroupBreakdownModal({ open, onClose, group, fromDate, toDate, projectCode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState(null);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (group.groupKey) params.set("group_key", group.groupKey);
      else params.set("group_id", String(group.groupId));
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (projectCode) params.set("project_code", projectCode);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.GROUP_LEDGER_BREAKDOWN}?${params}`,
        method: "GET",
      });
      setData(res?.data ?? null);
    } catch (err) {
      toast.error(err?.message || "Failed to load group breakdown");
    } finally {
      setLoading(false);
    }
  }, [group, fromDate, toDate, projectCode]);

  useEffect(() => {
    if (open) {
      setData(null);
      setSearch("");
      setAccount(null);
      load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !account) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, account, onClose]);

  const accounts = useMemo(() => {
    const list = data?.accounts || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => `${a.code || ""} ${a.name || ""} ${ACCOUNT_TYPE_LABEL[a.accountType] || ""}`
      .toLowerCase().includes(q));
  }, [data, search]);

  if (!open) return null;

  const title = data?.groupName || group?.groupName || "Group";
  const period = fromDate || toDate ? `${fromDate || "…"} to ${toDate || "…"}` : "All dates";
  const shownDr = accounts.reduce((s, a) => s + (a.debit || 0), 0);
  const shownCr = accounts.reduce((s, a) => s + (a.credit || 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[4vh]">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white shadow-xl w-[92vw] max-w-[1000px] max-h-[88vh] flex flex-col border border-[#d1d5db]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#1b2f3a] text-white">
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold truncate">How “{title}” is made</h2>
              <p className="text-[11px] text-white/70 truncate">
                {period}{projectCode ? ` · ${projectCode}` : " · All Projects"}
                {data?.headUnder ? ` · ${data.headUnder}` : ""}
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/15 transition-colors" title="Close">
              <X size={16} />
            </button>
          </div>

          {/* Totals */}
          {data && !loading && (
            <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b border-[#e5e7eb] bg-[#f9fafb] text-[11.5px]">
              <span className="text-[#374151]">
                Total Dr: <span className="tabular-nums font-medium text-[#166534]">{formatAmount(data.totalDebit)}</span>
              </span>
              <span className="text-[#374151]">
                Total Cr: <span className="tabular-nums font-medium text-[#991b1b]">{formatAmount(data.totalCredit)}</span>
              </span>
              <span className="text-[#374151] font-medium">
                Net: <span className="tabular-nums font-semibold text-[#1b2f3a]">{drCr(data.net)}</span>
              </span>
              <span className="ml-auto text-[#6b7280]">
                {data.accounts.length} account{data.accounts.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="flex justify-center items-center h-[200px]">
                <Loader2 className="animate-spin w-5 h-5 text-[#1b2f3a]" />
              </div>
            ) : !data ? (
              <div className="text-center text-[#9ca3af] py-10 text-[12px]">No data available</div>
            ) : !data.accounts.length ? (
              <div className="text-center text-[#9ca3af] py-10 text-[12px]">
                Nothing posted to this group in the selected period
              </div>
            ) : (
              <>
                {/* By document type */}
                <section>
                  <h3 className="text-[11px] font-semibold text-[#1b2f3a] uppercase tracking-wide mb-1.5">
                    By document type
                  </h3>
                  <div className="border border-[#d1d5db]">
                    <table className="w-full text-[11.5px] border-collapse">
                      <thead>
                        <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb]">
                          <th className={`${TH} text-left`}>Document type</th>
                          <th className={`${TH} text-right w-[80px]`}>Vouchers</th>
                          <th className={`${TH} text-right w-[120px]`}>Debit</th>
                          <th className={`${TH} text-right w-[120px]`}>Credit</th>
                          <th className={`${TH} text-right w-[130px]`}>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bySourceType.map((t) => (
                          <tr key={t.sourceType} className="border-b border-[#f0f0f0] last:border-b-0">
                            <td className="px-2 py-[4px]"><SourceTypeBadge type={t.sourceTypeLabel} /></td>
                            <td className={`${TD} text-right text-[#6b7280]`}>{t.count}</td>
                            <td className={`${TD} text-right text-[#166534]`}>{amt(t.debit)}</td>
                            <td className={`${TD} text-right text-[#991b1b]`}>{amt(t.credit)}</td>
                            <td className={`${TD} text-right font-medium text-[#374151]`}>{drCr(t.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Accounts */}
                <section>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[11px] font-semibold text-[#1b2f3a] uppercase tracking-wide">
                      Accounts in this group
                    </h3>
                    <span className="text-[10.5px] text-[#9ca3af]">click an account to see its vouchers</span>
                    <div className="flex items-center gap-1.5 ml-auto w-[240px]">
                      <Search size={13} className="text-[#9ca3af] shrink-0" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search account..."
                        className="w-full h-[26px] px-2 text-[11.5px] border border-[#d1d5db] bg-white text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1b2f3a] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div className="border border-[#d1d5db]">
                    <table className="w-full text-[11.5px] border-collapse">
                      <thead>
                        <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb]">
                          <th className={`${TH} text-left w-[90px]`}>Type</th>
                          <th className={`${TH} text-left`}>Account</th>
                          <th className={`${TH} text-right w-[80px]`}>Vouchers</th>
                          <th className={`${TH} text-right w-[120px]`}>Debit</th>
                          <th className={`${TH} text-right w-[120px]`}>Credit</th>
                          <th className={`${TH} text-right w-[130px]`}>Net</th>
                          <th className="w-[24px]" />
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((a, i) => {
                          const clickable = !!a.accountId;
                          const name = a.code ? `${a.code} - ${a.name}` : a.name;
                          return (
                            <tr
                              key={`${a.accountType}_${a.accountId ?? i}`}
                              onClick={clickable ? () => setAccount({ ...a, label: name }) : undefined}
                              title={clickable ? "See the vouchers that make this amount" : undefined}
                              className={`border-b border-[#f0f0f0] ${i % 2 ? "bg-[#fafbfc]" : "bg-white"} ${clickable ? "cursor-pointer hover:bg-[#eef4f8]" : ""} group`}
                            >
                              <td className="px-2 py-[4px] text-[10.5px] text-[#6b7280] whitespace-nowrap">
                                {ACCOUNT_TYPE_LABEL[a.accountType] || a.accountType}
                              </td>
                              <td className="px-2 py-[4px] text-[#374151] group-hover:text-[#144664]">{name}</td>
                              <td className={`${TD} text-right text-[#6b7280]`}>{a.vouchers}</td>
                              <td className={`${TD} text-right text-[#166534]`}>{amt(a.debit)}</td>
                              <td className={`${TD} text-right text-[#991b1b]`}>{amt(a.credit)}</td>
                              <td className={`${TD} text-right font-medium text-[#374151]`}>{drCr(a.net)}</td>
                              <td className="pr-2 text-[#9ca3af] group-hover:text-[#1b2f3a]">
                                {clickable && <ChevronRight size={13} />}
                              </td>
                            </tr>
                          );
                        })}
                        {!accounts.length && (
                          <tr>
                            <td colSpan={7} className="px-2 py-3 text-center text-[#9ca3af] text-[11px]">
                              No matching accounts
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {accounts.length > 0 && (
                        <tfoot>
                          <tr className="bg-[#f3f4f6] border-t border-[#d1d5db] font-semibold text-[#1b2f3a]">
                            <td className="px-2 py-[5px]" colSpan={3}>
                              {search ? `Total of ${accounts.length} shown` : "Group total"}
                            </td>
                            <td className={`${TD} text-right`}>{formatAmount(shownDr)}</td>
                            <td className={`${TD} text-right`}>{formatAmount(shownCr)}</td>
                            <td className={`${TD} text-right`}>{drCr(shownDr - shownCr)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      <ReconciliationModal
        open={!!account}
        onClose={() => setAccount(null)}
        accountType={account?.accountType}
        accountId={account?.accountId}
        accountName={account?.label}
        fromDate={fromDate}
        toDate={toDate}
        projectCode={projectCode}
      />
    </>
  );
}
