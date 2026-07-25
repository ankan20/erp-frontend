"use client";

import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";

import { getPageActions } from "@/components/common/PageActionButtons";

import IndentForm from "@/components/resource/indent/IndentForm";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import { API_ENDPOINTS } from "@/config/api.config";
import { useState } from "react";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";

export default function Page() {
  const router = useRouter();
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [uuid, setUuid] = useState(null);

  const { indentId } = useParams();
  const access = getPageAccess({
    pageCode: "indent",
    pageType: "EDIT",
  });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.MY_APPROVAL_STATUS,
    indentId,
    access.canApprove,
  );

  if (!access.allowed) {
    return <PageNotAvailable />;
  }

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove: access.canApprove ? () => setOpenApproval(true) : undefined,
    onDownload: uuid ? () => window.open(`/print/indent/${uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this Indent.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <IndentForm
        mode={access.mode}
        canApprove={access.canApprove}
        indentId={indentId}
        onUuid={setUuid}
      />
      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{
          id: indentId,
        }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          {
            type: "approve",
            api: API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.APPROVE,
          },

          {
            type: "reback",
            api: API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.REBACK,
          },

          {
            type: "reject",
            api: API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.REJECT,
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
        title="Indent History"
        api={API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.HISTORY}
        entityId={indentId}
      />
    </HeaderWrapper>
  );
}