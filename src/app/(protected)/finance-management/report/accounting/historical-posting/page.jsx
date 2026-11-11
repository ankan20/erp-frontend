"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Play } from "lucide-react";
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
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
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
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#1a1a4e]">Posting Status</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1 border border-[#8f8f8f] text-[13px] rounded-sm hover:bg-gray-100"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={() => handleHistoricalPosting(true)}
              disabled={posting}
              className="flex items-center gap-1.5 px-3 py-1 border border-[#5a5aaa] text-[#5a5aaa] text-[13px] rounded-sm hover:bg-[#f0f0ff]"
            >
              Dry Run
            </button>
            <button
              onClick={() => handleHistoricalPosting(false)}
              disabled={posting}
              className="flex items-center gap-1.5 px-4 py-1 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run Historical Posting
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-[#b0b0d0] rounded-sm bg-[#f0f0ff] p-4">
            <div className="text-[12px] text-gray-600">Total Approved</div>
            <div className="text-[20px] font-bold mt-1">{totalApproved}</div>
          </div>
          <div className="border border-[#b0d4b0] rounded-sm bg-[#e8f4e8] p-4">
            <div className="text-[12px] text-gray-600">Posted</div>
            <div className="text-[20px] font-bold text-[#2d7a2d] mt-1">{totalPosted}</div>
          </div>
          <div className="border border-[#f0c0a0] rounded-sm bg-[#fff8f0] p-4">
            <div className="text-[12px] text-gray-600">Pending</div>
            <div className="text-[20px] font-bold text-[#c06000] mt-1">{totalPending}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#ccc] rounded-sm">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="bg-[#e8e8f0]">
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Module</th>
                  <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Approved</th>
                  <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Posted</th>
                  <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Pending</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, val], i) => (
                  <tr key={key} className={`border-b border-[#e0e0e0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f0ff]`}>
                    <td className="px-3 py-1.5 font-medium">{SOURCE_LABELS[key] || key}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{val.totalApproved}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-[#2d7a2d]">{val.posted}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-[#c06000]">{val.pending}</td>
                    <td className="px-3 py-1.5">
                      {val.pending === 0 ? (
                        <span className="px-2 py-0.5 bg-[#e8f4e8] text-[#2d7a2d] rounded text-[11px] font-semibold">Complete</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-[#fff3e0] text-[#c06000] rounded text-[11px] font-semibold">{val.pending} pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
