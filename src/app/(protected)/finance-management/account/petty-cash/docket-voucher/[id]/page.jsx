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
import DocketVoucherForm    from "@/components/finance/account/petty-cash/DocketVoucherForm";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const access = getPageAccess({ pageCode: "petty_cash", pageType: "EDIT" });

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.MY_APPROVAL_STATUS,
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
          ? `Your approval is required at Level ${myLevel} for this Docket Voucher.`
          : null
      }
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <DocketVoucherForm
        mode={access.mode}
        voucherId={id}
        canApprove={access.canApprove}
        onAfterSubmit={refresh}
      />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.APPROVE },
          { type: "reback",  api: API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.REBACK  },
          { type: "reject",  api: API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.REJECT  },
        ]}
        onSuccess={() => { setOpenApproval(false); refresh(); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Docket Voucher Approve History"
        api={API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.HISTORY}
        entityId={id}
      />
    </HeaderWrapper>
  );
}
