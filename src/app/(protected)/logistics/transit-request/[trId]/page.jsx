"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Truck } from "lucide-react";

import HeaderWrapper        from "@/components/layout/HeaderWrapper";
import PageHeader           from "@/components/layout/PageHeader";
import PageNotAvailable     from "@/components/common/PageNotAvailable";
import { getPageActions }   from "@/components/common/PageActionButtons";
import { getPageAccess }    from "@/helper/getPageAccess";
import ApprovalActionModal  from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS }    from "@/config/api.config";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import { useDeletePending }   from "@/hooks/useDeletePending";

import TRForm from "@/components/logistics/transit-request/TRForm";
import LogisticsDocHeader  from "@/components/logistics/common/LogisticsDocHeader";
import LinkedChainPanel    from "@/components/logistics/common/LinkedChainPanel";

const TR = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.TRANSIT_REQUEST;

export default function Page() {
  const router    = useRouter();
  const { trId }  = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [detail,       setDetail]       = useState(null);
  const [uuid,         setUuid]         = useState(null);

  const access = getPageAccess({
    pageCode: "transit_request",
    pageType: "EDIT",
    defaultToAllowed: true,
  });

  // Backend is the source of truth for whether this is pending on me.
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    TR.MY_APPROVAL_STATUS,
    trId,
    true,
  );

  const { isPendingDeletion, pendingInfo, dismissDeletion } = useDeletePending(
    "TR", trId, access.allowed,
  );
  if (!access.allowed) return <PageNotAvailable />;

  const canOpenApproval = access.canApprove || isPendingForMe;

  const createDCHref = detail?.workflowStatus === "Approved" &&
    detail?.fulfillmentStatus !== "Fulfilled" &&
    access.canAdd
      ? `/logistics/delivery-challan/new?trId=${trId}`
      : null;

  const actions = getPageActions({
    router,
    onTimeLine:        () => setOpenTimeline(true),
    onApprove:         canOpenApproval ? () => setOpenApproval(true) : undefined,
    isPendingApproval: isPendingForMe,
    onPrint:           uuid ? () => window.open(`/print/transit-request/${uuid}`, "_blank") : undefined,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe
        ? `Your approval is required at Level ${myLevel} for this Transit Request.`
        : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
      pendingDeletion={isPendingDeletion ? pendingInfo : null}
      onDismissDeletion={dismissDeletion}
    >
      {detail && (
        <div className="px-3 pt-3">
          <LogisticsDocHeader
            kind="Transit Request"
            number={detail.trNo}
            statuses={[
              { label: "Workflow",    value: detail.workflowStatus },
              { label: "Fulfillment", value: detail.fulfillmentStatus || "Open" },
            ]}
            meta={[
              { label: "Date",     value: detail.requestDate },
              { label: "Priority", value: detail.priority },
              { label: "Route",    value: detail.sourceLocation && detail.destinationLocation
                ? `${detail.sourceLocation} → ${detail.destinationLocation}`
                : null },
              { label: "Carrier",  value: detail.preferredCarrierName },
              { label: "Mode",     value: detail.modeOfTransport },
            ].filter((m) => m.value)}
            action={createDCHref ? {
              label: "Create Delivery Challan",
              icon: Truck,
              onClick: () => router.push(createDCHref),
            } : null}
          />
        </div>
      )}

      <TRForm
        mode={access.mode}
        trId={trId}
        onAfterSubmit={refresh}
        onDetailLoaded={setDetail}
        onUuid={setUuid}
      />

      {/* Chain panel */}
      {detail && (
        <div className="px-3 pb-4">
          <LinkedChainPanel
            anchor="TR"
            tr={{ id: detail.id, trNo: detail.trNo, workflowStatus: detail.workflowStatus }}
            dcs={detail.linkedDcs || []}
            lbs={[]}
          />
        </div>
      )}

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: trId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: TR.APPROVE },
          { type: "reback",  api: TR.REBACK  },
          { type: "reject",  api: TR.REJECT  },
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
        title="Transit Request Approval History"
        api={TR.HISTORY}
        entityId={trId}
      />
    </HeaderWrapper>
  );
}
