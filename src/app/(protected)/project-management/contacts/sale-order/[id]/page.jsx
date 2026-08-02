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
import OGSaleOrderForm from "@/components/project-management/contacts/sale-order/OGSaleOrderForm";

export default function Page() {
  const router    = useRouter();
  const { id }    = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid,         setUuid]         = useState(null);

  const access = getPageAccess({ pageCode: "sale_order", pageType: "EDIT" });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.MY_APPROVAL_STATUS}`,
    id,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine:  () => setOpenTimeline(true),
    onApprove:   access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload:  uuid ? () => window.open(`/print/og-sale-order/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={
        isPendingForMe
          ? `Your approval is required at Level ${myLevel} for this Sale Order.`
          : null
      }
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <OGSaleOrderForm mode={access.mode} saleOrderId={id} onAfterSubmit={refresh} onUuid={setUuid} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.APPROVE}` },
          { type: "reback",  api: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.REBACK}`   },
          { type: "reject",  api: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.REJECT}`   },
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
        title="Sale Order History"
        api={`${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.HISTORY}`}
        entityId={id}
      />
    </HeaderWrapper>
  );
}
