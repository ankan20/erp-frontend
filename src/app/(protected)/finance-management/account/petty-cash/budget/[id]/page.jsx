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
import BudgetForm           from "@/components/finance/account/petty-cash/BudgetForm";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const access = getPageAccess({ pageCode: "petty_cash", pageType: "EDIT" });

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid,         setUuid]         = useState(null);

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.MY_APPROVAL_STATUS,
    id,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine:  () => setOpenTimeline(true),
    onApprove:   access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload:  uuid ? () => window.open(`/print/petty-cash-budget/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={
        isPendingForMe
          ? `Your approval is required at Level ${myLevel} for this Budget.`
          : null
      }
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <BudgetForm
        mode={access.mode}
        budgetId={id}
        canApprove={access.canApprove}
        onAfterSubmit={refresh}
        onUuid={setUuid}
      />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.APPROVE },
          { type: "reback",  api: API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.REBACK  },
          { type: "reject",  api: API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.REJECT  },
        ]}
        onSuccess={() => { setOpenApproval(false); refresh(); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Budget Approve History"
        api={API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.HISTORY}
        entityId={id}
      />
    </HeaderWrapper>
  );
}
