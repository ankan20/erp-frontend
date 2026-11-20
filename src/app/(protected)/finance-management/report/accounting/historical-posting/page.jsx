"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Play } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { toast } from "sonner";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import { usePageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

const SOURCE_LABELS = {
  journal_entry: "Journal Entry",
  purchase_bill: "Purchase Bill",
  sale_bill: "Sale Bill",
  payment_voucher: "Payment Voucher",
  petty_cash_docket: "Petty Cash Docket",
  bill_payment: "Bill Payment",
  sale_receipt_billing: "Sale Receipt Billing",
  debit_note: "Debit Note",
  credit_note: "Credit Note",
  contra_entry: "Contra Entry",
};

export default function PostingStatusPage() {
  const access = getPageAccess({ pageCode: "accounting_posting_status", pageType: "LIST" });
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest({ url: API_ENDPOINTS.FINANCE.ACCOUNTING.POSTING_STATUS, method: "GET" });
      setStatus(res?.data || {});
    } catch (err) {
      toast.error(err?.message || "Failed to load posting status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleHistoricalPosting = async (dryRun = false) => {
    setPosting(true);
    try {
      const res = await apiRequest({
        url: API_ENDPOINTS.FINANCE.ACCOUNTING.HISTORICAL_POSTING,
        method: "POST",
        data: { dry_run: dryRun },
      });
      const summary = res?.data?.summary;
      if (summary) {
        toast.success(
          `${dryRun ? "[Dry Run] " : ""}Posted: ${summary.totalPosted}, Skipped: ${summary.totalSkipped}, Errors: ${summary.totalErrors}`
        );
      }
      fetchStatus();
    } catch (err) {
      toast.error(err?.message || "Historical posting failed");
    } finally {
      setPosting(false);
    }
  };

  const entries = status ? Object.entries(status) : [];
  const totalApproved = entries.reduce((s, [, v]) => s + (v.totalApproved || 0), 0);
  const totalPosted = entries.reduce((s, [, v]) => s + (v.posted || 0), 0);
  const totalPending = entries.reduce((s, [, v]) => s + (v.pending || 0), 0);

  const actions = usePageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — Posting Status</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-[5px] border border-[#d1d5db] text-[12px] text-[#4b5563] hover:bg-[#f3f4f6] transition-colors"
            >
              <RefreshCw size={12} /> Refresh
            </button>
            <button
              onClick={() => handleHistoricalPosting(true)}
              disabled={posting}
              className="flex items-center gap-1 px-2.5 py-[5px] border border-[#1b2f3a] text-[#1b2f3a] text-[12px] hover:bg-[#f0f4f8] transition-colors"
            >
              Dry Run
            </button>
            <button
              onClick={() => handleHistoricalPosting(false)}
              disabled={posting}
              className="flex items-center gap-1 px-3 py-[5px] bg-[#1b2f3a] hover:bg-[#263f4d] text-white text-[12px] font-medium disabled:opacity-50 transition-colors"
            >
              {posting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Run Historical Posting
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="border border-[#d1d5db] bg-[#f8f9fb] p-3">
            <div className="text-[11px] text-[#6b7280] font-medium">Total Approved</div>
            <div className="text-[18px] font-bold text-[#374151] mt-0.5 tabular-nums">{totalApproved}</div>
          </div>
          <div className="border border-[#d1d5db] bg-[#f0fdf4] p-3">
            <div className="text-[11px] text-[#6b7280] font-medium">Posted</div>
            <div className="text-[18px] font-bold text-[#2d7a2d] mt-0.5 tabular-nums">{totalPosted}</div>
          </div>
          <div className="border border-[#d1d5db] bg-[#fffbeb] p-3">
            <div className="text-[11px] text-[#6b7280] font-medium">Pending</div>
            <div className="text-[18px] font-bold text-[#b45309] mt-0.5 tabular-nums">{totalPending}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <EdoxMark size={32} />
          </div>
        ) : (
          <div className="border border-[#d1d5db] overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#1b2f3a]">
                  <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">Module</th>
                  <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] border-r border-[#2a4a5a]">Approved</th>
                  <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] border-r border-[#2a4a5a]">Posted</th>
                  <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] border-r border-[#2a4a5a]">Pending</th>
                  <th className="px-2 py-[6px] text-left font-medium text-white text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, val], i) => (
                  <tr key={key} className={`border-b border-[#e5e7eb] ${i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f4f8] transition-colors`}>
                    <td className="px-2 py-[4px] font-medium text-[#374151] border-r border-[#f0f0f0]">{SOURCE_LABELS[key] || key}</td>
                    <td className="px-2 py-[4px] text-right tabular-nums text-[#374151] border-r border-[#f0f0f0]">{val.totalApproved}</td>
                    <td className="px-2 py-[4px] text-right tabular-nums text-[#2d7a2d] border-r border-[#f0f0f0]">{val.posted}</td>
                    <td className="px-2 py-[4px] text-right tabular-nums text-[#b45309] border-r border-[#f0f0f0]">{val.pending}</td>
                    <td className="px-2 py-[4px]">
                      {val.pending === 0 ? (
                        <span className="px-1.5 py-0.5 bg-[#e8f4e8] text-[#2d7a2d] text-[10px] font-semibold">Complete</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-[#fef3c7] text-[#b45309] text-[10px] font-semibold">{val.pending} pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#1b2f3a] text-white text-[11.5px] font-medium">
                  <td className="px-2 py-[5px] border-r border-[#2a4a5a]">Total</td>
                  <td className="px-2 py-[5px] text-right tabular-nums border-r border-[#2a4a5a]">{totalApproved}</td>
                  <td className="px-2 py-[5px] text-right tabular-nums border-r border-[#2a4a5a]">{totalPosted}</td>
                  <td className="px-2 py-[5px] text-right tabular-nums border-r border-[#2a4a5a]">{totalPending}</td>
                  <td className="px-2 py-[5px]"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
