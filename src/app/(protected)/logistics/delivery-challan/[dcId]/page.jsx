"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Receipt } from "lucide-react";

import HeaderWrapper        from "@/components/layout/HeaderWrapper";
import PageHeader           from "@/components/layout/PageHeader";
import PageNotAvailable     from "@/components/common/PageNotAvailable";
import { getPageActions }   from "@/components/common/PageActionButtons";
import { getPageAccess }    from "@/helper/getPageAccess";
import ApprovalActionModal  from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS }    from "@/config/api.config";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";
import { useDeletePending }    from "@/hooks/useDeletePending";

import DCForm               from "@/components/resource/logistics/delivery-challan/DCForm";
import DCTransitPanel       from "@/components/resource/logistics/delivery-challan/DCTransitPanel";
import LogisticsDocHeader   from "@/components/logistics/common/LogisticsDocHeader";
import LinkedChainPanel     from "@/components/logistics/common/LinkedChainPanel";

const DC = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC;

export default function Page() {
  const router   = useRouter();
  const { dcId } = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [detail,       setDetail]       = useState(null);
  const [uuid,         setUuid]         = useState(null);

  const access = getPageAccess({ pageCode: "delivery_challan", pageType: "EDIT", defaultToAllowed: true });

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    DC.MY_APPROVAL_STATUS,
    dcId,
    true,
  );
  const { isPendingDeletion, pendingInfo, dismissDeletion } = useDeletePending("DC", dcId, access.allowed);

  if (!access.allowed) return <PageNotAvailable />;

  const canOpenApproval = access.canApprove || isPendingForMe;
  // Dispatch/POD actions rely on a dedicated permission key; default to allowed
  // for environments that haven't configured it yet.
  const canDispatch = access.permissions?.["delivery_challan.DISPATCH"] ?? true;

  const canCreateBill =
    detail?.workflowStatus === "Approved" &&
    detail?.transitStatus === "Delivered" &&
    access.canAdd;

  const actions = getPageActions({
    router,
    onTimeLine:        () => setOpenTimeline(true),
    onApprove:         canOpenApproval ? () => setOpenApproval(true) : undefined,
    isPendingApproval: isPendingForMe,
    onPrint:           uuid ? () => window.open(`/print/delivery-challan/${uuid}`, "_blank") : undefined,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe
        ? `Your approval is required at Level ${myLevel} for this Delivery Challan.`
        : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
      pendingDeletion={isPendingDeletion ? pendingInfo : null}
      onDismissDeletion={dismissDeletion}
    >
      {detail && (
        <div className="px-3 pt-3">
          <LogisticsDocHeader
            kind="Delivery Challan"
            number={detail.dcNo}
            statuses={[
              { label: "Workflow", value: detail.workflowStatus },
              ...(detail.workflowStatus === "Approved" ? [
                { label: "Transit", value: detail.transitStatus || "Pending_Dispatch" },
                { label: "POD",     value: detail.podStatus || "Awaited" },
              ] : []),
            ]}
            meta={[
              { label: "Date",        value: detail.challanDate },
              { label: "Ref TR",      value: detail.transitRequestNo },
              { label: "Transporter", value: detail.transporterName },
              { label: "LR No",       value: detail.lrNo },
              { label: "Vehicle",     value: detail.vehicleNumber },
              { label: "Driver",      value: detail.driverName },
            ].filter((m) => m.value)}
            action={canCreateBill ? {
              label: "Create Logistics Bill",
              icon: Receipt,
              onClick: () => router.push(`/logistics/bill-register/new?dcId=${dcId}`),
            } : null}
          />
        </div>
      )}

      <DCForm
        mode={access.mode}
        dcId={dcId}
        onAfterSubmit={refresh}
        onDetailLoaded={setDetail}
        onUuid={setUuid}
      />

      {/* Operational panels — only meaningful after approval */}
      {detail && (
        <div className="px-3 pb-4 flex flex-col gap-3">
          <DCTransitPanel
            dcId={dcId}
            workflowStatus={detail.workflowStatus}
            transitStatus={detail.transitStatus}
            podStatus={detail.podStatus}
            podFile={detail.podFile}
            canUpdate={canDispatch}
            onChange={(patch) => setDetail((d) => ({ ...d, ...patch }))}
          />
          <LinkedChainPanel
            anchor="DC"
            tr={detail.transitRequestId
              ? { id: detail.transitRequestId, trNo: detail.transitRequestNo, workflowStatus: "Approved" }
              : null}
            dcs={[{
              id: detail.id,
              dcNo: detail.dcNo,
              workflowStatus: detail.workflowStatus,
              transitStatus: detail.transitStatus,
            }]}
            lbs={detail.linkedBills || []}
          />
        </div>
      )}

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: dcId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: DC.APPROVE },
          { type: "reback",  api: DC.REBACK  },
          { type: "reject",  api: DC.REJECT  },
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
        title="Delivery Challan Approval History"
        api={DC.HISTORY}
        entityId={dcId}
      />
    </HeaderWrapper>
  );
}
