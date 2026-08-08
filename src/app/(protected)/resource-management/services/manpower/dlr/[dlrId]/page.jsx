"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import DLRForm from "@/components/resource/manpower/DLRForm";

export default function Page() {
  const router   = useRouter();
  const { dlrId } = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({ pageCode: "dlr", pageType: "EDIT" });

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.RESOURCE.MANPOWER.DLR.MY_APPROVAL_STATUS,
    dlrId,
    access.canApprove,
  );

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove:  access.canApprove ? () => setOpenApproval(true) : undefined,
    isPendingApproval: isPendingForMe,
  });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={
        isPendingForMe
          ? `Your approval is required at Level ${myLevel} for this DLR.`
          : null
      }
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <DLRForm
        mode={access.mode}
        dlrId={dlrId}
        disabled={access.disabled}
        onDataLoaded={() => {}}
        onAfterSubmit={refresh}
      />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: dlrId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.RESOURCE.MANPOWER.DLR.APPROVE },
          { type: "reback",  api: API_ENDPOINTS.RESOURCE.MANPOWER.DLR.REBACK  },
          { type: "reject",  api: API_ENDPOINTS.RESOURCE.MANPOWER.DLR.REJECT  },
        ]}
        onSuccess={() => {
          setOpenApproval(false);
          refresh();
          router.refresh();
        }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="DLR Approve History"
        api={API_ENDPOINTS.RESOURCE.MANPOWER.DLR.HISTORY}
        entityId={dlrId}
      />
    </HeaderWrapper>
  );
}
