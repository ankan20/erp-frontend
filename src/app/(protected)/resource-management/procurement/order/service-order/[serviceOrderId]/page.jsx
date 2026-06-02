"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import ServiceOrderForm from "@/components/resource/service-order/ServiceOrderForm";

const PW = API_ENDPOINTS.RESOURCE.ORDER.PROJECT_WORK;

export default function Page() {
  const router = useRouter();
  const { serviceOrderId } = useParams();
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  // Access uses "order" pageCode — same module access as order
  const access = getPageAccess({ pageCode: "order", pageType: "EDIT" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove: access.canApprove ? () => setOpenApproval(true) : undefined,
  });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <ServiceOrderForm
        mode={access.mode}
        canApprove={access.canApprove}
        serviceOrderId={serviceOrderId}
      />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: serviceOrderId }}
        actions={[
          { type: "approve", api: PW.APPROVE },
          { type: "reback", api: PW.REBACK },
          { type: "reject", api: PW.REJECT },
        ]}
        onSuccess={() => { setOpenApproval(false); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Service Order History"
        api={PW.HISTORY}
        entityId={serviceOrderId}
      />
    </HeaderWrapper>
  );
}
