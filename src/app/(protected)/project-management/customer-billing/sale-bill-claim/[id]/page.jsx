"use client";

import { useState }     from "react";
import { useParams, useRouter } from "next/navigation";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ApprovalActionModal   from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet  from "@/components/common/HistoryTimelineSheet";
import { getPageActions }    from "@/components/common/PageActionButtons";
import { getPageAccess }     from "@/helper/getPageAccess";
import { API_ENDPOINTS }     from "@/config/api.config";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import SaleClaimBillForm from "@/components/project-management/customer-billing/sale-claim-bill/SaleClaimBillForm";

export default function Page() {
  const router    = useRouter();
  const { id }    = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({ pageCode: "sale_claim_bill", pageType: "EDIT" });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.MY_APPROVAL_STATUS}${id}/my-approval-status`,
    id,
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
      pendingApproval={
        isPendingForMe
          ? `Your approval is required at Level ${myLevel} for this Sale Bill.`
          : null
      }
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <SaleClaimBillForm mode={access.mode} billId={id} onAfterSubmit={refresh} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.APPROVE}${id}/approve` },
          { type: "reback",  api: `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.REBACK}${id}/reback`   },
          { type: "reject",  api: `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.REJECT}${id}/reject`   },
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
        title="Sale Bill History"
        api={`${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.HISTORY}${id}/history`}
        entityId={id}
      />
    </HeaderWrapper>
  );
}
