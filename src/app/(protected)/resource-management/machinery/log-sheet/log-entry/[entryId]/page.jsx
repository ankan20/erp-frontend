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
import LogEntryForm from "@/components/resource/machinery/log-book/LogEntryForm";

const LE = API_ENDPOINTS.RESOURCE.MACHINERY.LOG_ENTRY;

export default function Page() {
  const router = useRouter();
  const { entryId } = useParams();

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
      <LogEntryForm mode={access.mode} entryId={entryId} />

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: entryId }}
        actions={[
          { type: "approve", api: LE.APPROVE },
          { type: "reback",  api: LE.REBACK  },
          { type: "reject",  api: LE.REJECT  },
        ]}
        onSuccess={() => {
          setOpenApproval(false);
          router.refresh();
        }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="Log Entry History"
        api={LE.HISTORY}
        entityId={entryId}
      />
    </HeaderWrapper>
  );
}
