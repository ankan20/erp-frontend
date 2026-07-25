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
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";

export default function Page() {
  const router = useRouter();
  const { id }  = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid, setUuid] = useState(null);

  const access = getPageAccess({ pageCode: "goods_received_note", pageType: "EDIT" });
  const { isPendingForMe, myLevel } = useMyApprovalStatus(
    API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.MY_APPROVAL_STATUS,
    id,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove:  access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload: uuid ? () => window.open(`/print/grn/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this GRN.` : null}
    >
      <GRNForm mode={access.mode} grnId={id} onUuid={setUuid} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id }}
        pendingInfo={{ isPendingForMe, myLevel }}
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
