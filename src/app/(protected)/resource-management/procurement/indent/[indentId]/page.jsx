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

export default function Page() {
  const router = useRouter();
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const { indentId } = useParams();
  const access = getPageAccess({
    pageCode: "indent",
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
      <IndentForm
        mode={access.mode}
        canApprove={access.canApprove}
        indentId={indentId}
      />
      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{
          id: indentId,
        }}
        actions={[
          {
            type: "approve",
            api: API_ENDPOINTS.RESOURCE.INDENT.APPROVE,
          },

          {
            type: "reback",
            api: API_ENDPOINTS.RESOURCE.INDENT.REBACK,
          },

          {
            type: "reject",
            api: API_ENDPOINTS.RESOURCE.INDENT.REJECT,
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
        title="Indent History"
        api={API_ENDPOINTS.RESOURCE.INDENT.HISTORY}
        entityId={indentId}
      />
    </HeaderWrapper>
  );
}