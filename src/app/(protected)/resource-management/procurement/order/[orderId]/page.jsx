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

import OrderForm from "@/components/resource/order/OrderForm";

export default function Page() {
  const router = useRouter();

  const { orderId } = useParams();

  const [openApproval, setOpenApproval] = useState(false);

  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({
    pageCode: "order",

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
      {/* FORM */}

      <OrderForm
        mode={access.mode}
        canApprove={access.canApprove}
        orderId={orderId}
      />

      {/* APPROVAL */}

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{
          id:orderId,
        }}
        actions={[
          {
            type: "approve",

            api: API_ENDPOINTS.RESOURCE.ORDER.APPROVE,
          },

          {
            type: "reback",

            api: API_ENDPOINTS.RESOURCE.ORDER.REBACK,
          },

          {
            type: "reject",

            api: API_ENDPOINTS.RESOURCE.ORDER.REJECT,
          },
        ]}
        onSuccess={() => {
          setOpenApproval(false);
          router.refresh();
        }}
      />

      {/* TIMELINE */}

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Order History"
        api={API_ENDPOINTS.RESOURCE.ORDER.HISTORY}
        entityId={orderId}
      />
    </HeaderWrapper>
  );
}
