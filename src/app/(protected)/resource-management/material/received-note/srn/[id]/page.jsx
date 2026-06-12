"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }       from "@/components/common/PageActionButtons";
import { getPageAccess }        from "@/helper/getPageAccess";
import ApprovalActionModal      from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet     from "@/components/common/HistoryTimelineSheet";
import GRNForm from "@/components/resource/grn/GRNForm";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const router = useRouter();
  const { id }  = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({ pageCode: "goods_received_note", pageType: "EDIT" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove:  access.canApprove ? () => setOpenApproval(true) : undefined,
  });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <GRNForm mode={access.mode} grnId={id} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.APPROVE  },
          { type: "reback",  api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.REBACK   },
          { type: "reject",  api: API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.REJECT   },
        ]}
        onSuccess={() => { setOpenApproval(false); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="GRN History"
        api={API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.HISTORY}
        entityId={id}
      />
    </HeaderWrapper>
  );
}
