"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import OrderForm from "@/components/resource/order/OrderForm";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";

export default function Page() {
  const router = useRouter();
  const { orderId } = useParams();
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid, setUuid] = useState(null);

  const access = getPageAccess({ pageCode: "order", pageType: "EDIT" });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.MY_APPROVAL_STATUS,
    orderId,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove: access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload: uuid ? () => window.open(`/print/order/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this Order.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <OrderForm mode={access.mode} canApprove={access.canApprove} orderId={orderId} onUuid={setUuid} onAfterSubmit={refresh} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: orderId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.APPROVE },
          { type: "reback", api: API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.REBACK },
          { type: "reject", api: API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.REJECT },
        ]}
        onSuccess={() => { setOpenApproval(false); refresh(); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Order History"
        api={API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.HISTORY}
        entityId={orderId}
      />
    </HeaderWrapper>
  );
}
