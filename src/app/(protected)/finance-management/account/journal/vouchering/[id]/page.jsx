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
import JournalVoucherForm   from "@/components/finance/account/journal/JournalVoucherForm";

const BASE = API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.BASE;

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const access = getPageAccess({ pageCode: "journal", pageType: "EDIT" });

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid,         setUuid]         = useState(null);
  const [refreshKey,   setRefreshKey]   = useState(0);

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    BASE,
    `${id}/my-status`,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine:        () => setOpenTimeline(true),
    onApprove:         access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload:        uuid ? () => window.open(`/print/journal-voucher/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={
        isPendingForMe
          ? `Your approval is required at Level ${myLevel} for this Journal Voucher.`
          : null
      }
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <JournalVoucherForm
        key={refreshKey}
        mode={access.mode}
        voucherId={id}
        onUuid={setUuid}
        onAfterSubmit={refresh}
      />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.APPROVE },
          { type: "reback",  api: API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.REBACK  },
          { type: "reject",  api: API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.REJECT  },
        ]}
        onSuccess={() => { setOpenApproval(false); refresh(); setRefreshKey((k) => k + 1); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Journal Voucher History"
        api={BASE}
        entityId={`${id}/history`}
      />
    </HeaderWrapper>
  );
}
