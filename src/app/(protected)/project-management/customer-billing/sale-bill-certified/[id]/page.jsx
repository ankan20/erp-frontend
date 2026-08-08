"use client";

import { useState }        from "react";
import { useParams, useRouter } from "next/navigation";

import HeaderWrapper       from "@/components/layout/HeaderWrapper";
import PageHeader          from "@/components/layout/PageHeader";
import PageNotAvailable    from "@/components/common/PageNotAvailable";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { API_ENDPOINTS }   from "@/config/api.config";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import SaleCertifiedBillForm from "@/components/project-management/customer-billing/sale-certified-bill/SaleCertifiedBillForm";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid,         setUuid]         = useState(null);

  const access = getPageAccess({ pageCode: "sale_certified_bill", pageType: "EDIT" });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.MY_APPROVAL_STATUS}`,
    id,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine:  () => setOpenTimeline(true),
    onApprove:   access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload:  uuid ? () => window.open(`/print/sale-certified-bill/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={
        isPendingForMe
          ? `Your approval is required at Level ${myLevel} for this Certified Bill.`
          : null
      }
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <SaleCertifiedBillForm mode={access.mode} billId={id} onAfterSubmit={refresh} onUuid={setUuid} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.APPROVE}` },
          { type: "reback",  api: `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.REBACK}`   },
          { type: "reject",  api: `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.REJECT}`   },
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
        title="Certified Bill Approve History"
        api={`${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.HISTORY}`}
        entityId={id}
      />
    </HeaderWrapper>
  );
}
