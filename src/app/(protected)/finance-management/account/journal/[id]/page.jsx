"use client";

import { useState }             from "react";
import { useParams, useRouter } from "next/navigation";

import HeaderWrapper        from "@/components/layout/HeaderWrapper";
import PageHeader           from "@/components/layout/PageHeader";
import PageNotAvailable     from "@/components/common/PageNotAvailable";
import ApprovalActionModal  from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { getPageActions }   from "@/components/common/PageActionButtons";
import { getPageAccess }    from "@/helper/getPageAccess";
import { API_ENDPOINTS }    from "@/config/api.config";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import { useDeletePending } from "@/hooks/useDeletePending";
import JournalEntryForm     from "@/components/finance/account/journal/JournalEntryForm";
import { IndianRupee }      from "lucide-react";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const access = getPageAccess({ pageCode: "journal", pageType: "EDIT" });

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid,         setUuid]         = useState(null);
  const [jeStatus,     setJeStatus]     = useState("");

  // Restricted: only payment_request_journal.EDIT holders (super admin sets it) see this
  const journalPrAccess = getPageAccess({ pageCode: "payment_request_journal", pageType: "LIST" });
  const canRaisePaymentRequest = !!(journalPrAccess.allowed && journalPrAccess.canAdd);

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.MY_APPROVAL_STATUS,
    id,
    access.canApprove,
  );


  const { isPendingDeletion, pendingInfo, dismissDeletion } = useDeletePending("JOURNAL_ENTRY", id, access.allowed);
  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine:        () => setOpenTimeline(true),
    onApprove:         access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload:        uuid ? () => window.open(`/print/journal-entry/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={
        isPendingForMe
          ? `Your approval is required at Level ${myLevel} for this Journal Entry.`
          : null
      }
      onDismissApproval={isPendingForMe ? dismiss : undefined}
      pendingDeletion={isPendingDeletion ? pendingInfo : null}
      onDismissDeletion={dismissDeletion}
    >
      <JournalEntryForm
        mode={access.mode}
        journalId={id}
        onAfterSubmit={refresh}
        onUuid={setUuid}
        onStatus={setJeStatus}
      />

      {canRaisePaymentRequest && (
        <div className="px-3 pb-4">
          <div className="border-t pt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/resource-management/sub-contractor-billing/payment-request/new?journalId=${id}`)}
              disabled={jeStatus !== "Approved"}
              title={jeStatus === "Approved" ? "Raise a Payment Request against this journal" : "Journal must be Approved to raise a Payment Request"}
              className={`ml-auto inline-flex items-center gap-2 px-4 h-[36px] rounded-md border text-[13px] font-semibold transition-all
                ${jeStatus === "Approved"
                  ? "bg-[#7fc3d4] border-[#4a9fb5] text-black hover:bg-[#6ab8cb] cursor-pointer"
                  : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-60"
                }`}
            >
              <IndianRupee className="w-4 h-4" />
              Raise Payment Request
            </button>
          </div>
        </div>
      )}

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.APPROVE },
          { type: "reback",  api: API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.REBACK  },
          { type: "reject",  api: API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.REJECT  },
        ]}
        onSuccess={() => { setOpenApproval(false); refresh(); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Journal Entry Approve History"
        api={API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.HISTORY}
        entityId={id}
      />
    </HeaderWrapper>
  );
}
