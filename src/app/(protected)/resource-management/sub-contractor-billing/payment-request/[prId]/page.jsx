"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import PaymentRequestForm from "@/components/resource/payment-request/PaymentRequestForm";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import { useDeletePending } from "@/hooks/useDeletePending";

const EP = API_ENDPOINTS.RESOURCE.PAYMENT_REQUEST;

export default function Page() {
  const router = useRouter();
  const { prId } = useParams();
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid, setUuid] = useState("");

  const access = getPageAccess({ pageCode: "payment_request", pageType: "EDIT" });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    EP.MY_APPROVAL_STATUS,
    prId,
    access.canApprove,
  );
  const { isPendingDeletion, pendingInfo, dismissDeletion } = useDeletePending("PAYMENT_REQUEST", prId, access.allowed);

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove: access.canApprove ? () => setOpenApproval(true) : undefined,
    isPendingApproval: isPendingForMe,
    onDownload: uuid ? () => window.open(`/print/payment-request/${uuid}`, "_blank") : undefined,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this Payment Request.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
      pendingDeletion={isPendingDeletion ? pendingInfo : null}
      onDismissDeletion={dismissDeletion}
    >
      <PaymentRequestForm
        mode={access.mode}
        prId={prId}
        onDataLoaded={({ uuid: u }) => { if (u) setUuid(u); }}
        onAfterSubmit={refresh}
      />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: prId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: EP.APPROVE },
          { type: "reback",  api: EP.REBACK },
          { type: "reject",  api: EP.REJECT },
        ]}
        onSuccess={() => { setOpenApproval(false); refresh(); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Payment Request Approve History"
        api={EP.HISTORY}
        entityId={prId}
      />
    </HeaderWrapper>
  );
}
