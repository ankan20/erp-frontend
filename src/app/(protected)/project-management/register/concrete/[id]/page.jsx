"use client";

import { useParams, useRouter } from "next/navigation";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import ConcreteForm from "@/components/project-management/register/concrete/ConcreteForm";
import { useState } from "react";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({
    pageCode: "concrete_register",
    pageType: "EDIT",
  });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.MY_APPROVAL_STATUS,
    id,
    access.canApprove,
  );

  if (!access.allowed) {
    return <PageNotAvailable />;
  }

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove: access.canApprove ? () => setOpenApproval(true) : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this Concrete Register.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <ConcreteForm mode={access.mode} registryId={id} onAfterSubmit={refresh} />
      <ApprovalActionModal
              open={openApproval}
              onClose={() => setOpenApproval(false)}
              payload={{
                id: id,
              }}
              pendingInfo={{ isPendingForMe, myLevel }}
              actions={[
                {
                  type: "approve",
                  api: API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.APPROVE,
                },
      
                {
                  type: "reback",
                  api: API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.REBACK,
                },
      
                {
                  type: "reject",
                  api: API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.REJECT,
                },
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
              title="Concrete Register History"
              api={API_ENDPOINTS.PROJECT.REGISTER.CONCRETE.HISTORY}
              entityId={id}
            />
    </HeaderWrapper>
  );
}
