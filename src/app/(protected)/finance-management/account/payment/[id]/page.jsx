"use client";

import { useState }                        from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import HeaderWrapper        from "@/components/layout/HeaderWrapper";
import PageHeader           from "@/components/layout/PageHeader";
import PageNotAvailable     from "@/components/common/PageNotAvailable";
import ApprovalActionModal  from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { getPageActions }   from "@/components/common/PageActionButtons";
import { getPageAccess }    from "@/helper/getPageAccess";
import { API_ENDPOINTS }    from "@/config/api.config";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import PaymentForm          from "@/components/finance/account/payment/PaymentForm";

export default function Page() {
  const router      = useRouter();
  const { id }      = useParams();
  const params      = useSearchParams();
  const paymentType = params.get("type") || "bill";
  const isBill      = paymentType === "bill";

  const access = getPageAccess({ pageCode: "payment", pageType: "EDIT" });

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid,         setUuid]         = useState(null);

  const EP = isBill ? API_ENDPOINTS.FINANCE.BILL_PAYMENT : API_ENDPOINTS.FINANCE.PAYMENT_VOUCHER;

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    EP.MY_APPROVAL_STATUS,
    id,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove:  access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload: uuid ? () => window.open(`/print/payment/${uuid}?type=${paymentType}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this Payment.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <PaymentForm
        mode={access.mode}
        paymentId={id}
        paymentType={paymentType}
        onAfterSubmit={refresh}
        onUuid={setUuid}
      />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: EP.APPROVE },
          { type: "reback",  api: EP.REBACK  },
          { type: "reject",  api: EP.REJECT  },
        ]}
        onSuccess={() => { setOpenApproval(false); refresh(); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title={`Payment Approve History`}
        api={EP.HISTORY}
        entityId={id}
      />
    </HeaderWrapper>
  );
}
