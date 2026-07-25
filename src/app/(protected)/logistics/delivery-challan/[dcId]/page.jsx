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
import DCForm from "@/components/resource/logistics/delivery-challan/DCForm";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";

export default function Page() {
  const router   = useRouter();
  const { dcId } = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({ pageCode: "delivery_challan", pageType: "EDIT" });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.MY_APPROVAL_STATUS,
    dcId,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove:  access.canApprove ? () => setOpenApproval(true) : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this Delivery Challan.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <DCForm mode={access.mode} dcId={dcId} onAfterSubmit={refresh} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: dcId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.APPROVE },
          { type: "reback",  api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.REBACK  },
          { type: "reject",  api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.REJECT  },
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
        title="Delivery Challan History"
        api={API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.HISTORY}
        entityId={dcId}
      />
    </HeaderWrapper>
  );
}
