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

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({
    pageCode: "concrete_register",
    pageType: "EDIT",
  });

  if (!access.allowed) {
    return <PageNotAvailable />;
  }

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove: access.canApprove ? () => setOpenApproval(true) : undefined,
  });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <ConcreteForm mode={access.mode} registryId={id} />
      <ApprovalActionModal
              open={openApproval}
              onClose={() => setOpenApproval(false)}
              payload={{
                id: id,
              }}
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
