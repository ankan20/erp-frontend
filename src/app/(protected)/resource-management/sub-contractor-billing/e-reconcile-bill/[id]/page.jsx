"use client";

import { useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import BRRBillingForm from "@/components/resource/brr-billing/BRRBillingForm";
import BRRSelector from "@/components/resource/brr-billing/BRRSelector";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";

export default function Page() {
  const router  = useRouter();
  const { id }  = useParams();
  const params  = useSearchParams();

  const billingType = params.get("billingType") || "grn"; // grn | srn
  const brrId       = params.get("brrId");

  const isNew = id === "new";
  const isGRN = billingType === "grn";

  const pageCode = isGRN ? "bill_receive_register" : "bill_receive_register";
  const pageType = isNew ? "ADD" : "EDIT";

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({ pageCode, pageType });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.RESOURCE.BRB.MY_APPROVAL_STATUS,
    isNew ? null : id,
    !isNew && access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const ENDPOINT = API_ENDPOINTS.RESOURCE.BRB;
  const billingLabel = "BRB";

  const actions = getPageActions({
    router,
    ...(isNew
      ? {}
      : {
          onTimeLine: () => setOpenTimeline(true),
          onApprove: access.canApprove ? () => setOpenApproval(true) : undefined,
          isPendingApproval: isPendingForMe,
        }),
  });

  if (isNew && !brrId) {
    return (
      <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
        <BRRSelector
          onSelect={(selectedBrrId, selectedBillingType) =>
            router.replace(
              `/resource-management/sub-contractor-billing/e-reconcile-bill/new?brrId=${selectedBrrId}&billingType=${selectedBillingType}`
            )
          }
        />
      </HeaderWrapper>
    );
  }

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={!isNew && isPendingForMe ? `Your approval is required at Level ${myLevel} for this ${billingLabel}.` : null}
      onDismissApproval={!isNew && isPendingForMe ? dismiss : undefined}
    >
      <BRRBillingForm
        mode={isNew ? "create" : access.mode}
        billingType={billingType}
        brrId={isNew ? brrId : undefined}
        billingId={isNew ? undefined : id}
        onAfterSubmit={refresh}
      />

      {!isNew && (
        <>
          <ApprovalActionModal
            open={openApproval}
            onClose={() => setOpenApproval(false)}
            payload={{ id }}
            pendingInfo={{ isPendingForMe, myLevel }}
            actions={[
              { type: "approve", api: ENDPOINT.APPROVE },
              { type: "reback", api: ENDPOINT.REBACK },
              { type: "reject",  api: ENDPOINT.REJECT  },
            ]}
            onSuccess={() => { setOpenApproval(false); refresh(); router.refresh(); }}
          />

          <HistoryTimelineSheet
            open={openTimeline}
            onClose={() => setOpenTimeline(false)}
            title={`${billingLabel} Approve History`}
            api={ENDPOINT.HISTORY}
            entityId={id}
          />
        </>
      )}
    </HeaderWrapper>
  );
}
