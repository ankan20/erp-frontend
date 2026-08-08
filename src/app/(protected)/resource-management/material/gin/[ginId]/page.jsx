"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import GINForm from "@/components/resource/gin/GINForm";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";

export default function Page() {
  const router  = useRouter();
  const { ginId } = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid, setUuid] = useState(null);

  const access = getPageAccess({ pageCode: "goods_issue_note", pageType: "EDIT" });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.MY_APPROVAL_STATUS,
    ginId,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove:  access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload: uuid ? () => window.open(`/print/gin/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this GIN.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <GINForm mode={access.mode} ginId={ginId} onUuid={setUuid} onAfterSubmit={refresh} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: ginId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.APPROVE },
          { type: "reback",  api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.REBACK  },
          { type: "reject",  api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.REJECT  },
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
        title="GIN Approve History"
        api={API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.HISTORY}
        entityId={ginId}
      />
    </HeaderWrapper>
  );
}
