"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import { API_ENDPOINTS } from "@/config/api.config";
import DprDayView from "@/components/project-management/dpr/DprDayView";

const DPR = API_ENDPOINTS.PROJECT.DPR;

export default function Page() {
  const router = useRouter();
  const { date } = useParams();
  const access = getPageAccess({ pageCode: "daily_progress_report", pageType: "EDIT" });

  const [report, setReport] = useState(null); // { id, uuid } once a report exists
  const [reloadKey, setReloadKey] = useState(0);
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    DPR.MY_APPROVAL_STATUS,
    report?.id,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: report?.id ? () => setOpenTimeline(true) : undefined,
    onApprove: access.canApprove && report?.id ? () => setOpenApproval(true) : undefined,
    onDownload: report?.uuid ? () => window.open(`/print/dpr/${report.uuid}`, "_blank") : undefined,
    isPendingApproval: isPendingForMe,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this Daily Progress Report.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <DprDayView
        key={`${date}-${reloadKey}`}
        date={date}
        canEditPage={access.mode === "edit"}
        onReport={(r) => setReport(r ? { id: r.id, uuid: r.uuid } : null)}
        onAfterSubmit={refresh}
      />

      {report?.id && (
        <>
          <ApprovalActionModal
            open={openApproval}
            onClose={() => setOpenApproval(false)}
            payload={{ id: report.id }}
            pendingInfo={{ isPendingForMe, myLevel }}
            actions={[
              { type: "approve", api: DPR.APPROVE },
              { type: "reback", api: DPR.REBACK },
              { type: "reject", api: DPR.REJECT },
            ]}
            onSuccess={() => {
              setOpenApproval(false);
              refresh();
              setReloadKey((k) => k + 1);
            }}
          />
          <HistoryTimelineSheet
            open={openTimeline}
            onClose={() => setOpenTimeline(false)}
            title="Daily Progress Report History"
            api={DPR.HISTORY}
            entityId={report.id}
          />
        </>
      )}
    </HeaderWrapper>
  );
}
