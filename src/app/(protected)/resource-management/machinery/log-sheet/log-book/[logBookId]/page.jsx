"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import LogBookForm from "@/components/resource/machinery/log-book/LogBookForm";

const LB = API_ENDPOINTS.RESOURCE.MACHINERY.LOG_BOOK;

export default function Page() {
  const router = useRouter();
  const { logBookId } = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const access = getPageAccess({ pageCode: "log_sheet", pageType: "EDIT" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove:  access.canApprove ? () => setOpenApproval(true) : undefined,
  });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <LogBookForm mode={access.mode} logBookId={logBookId} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: logBookId }}
        actions={[
          { type: "approve", api: LB.APPROVE },
          { type: "reback",  api: LB.REBACK  },
          { type: "reject",  api: LB.REJECT  },
        ]}
        onSuccess={() => {
          setOpenApproval(false);
          router.refresh();
        }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Log Book History"
        api={LB.HISTORY}
        entityId={logBookId}
      />
    </HeaderWrapper>
  );
}
