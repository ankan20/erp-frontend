"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

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

import LBForm               from "@/components/logistics/bill-register/LBForm";
import LogisticsDocHeader   from "@/components/logistics/common/LogisticsDocHeader";
import LinkedChainPanel     from "@/components/logistics/common/LinkedChainPanel";

const LB = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.BILL_REGISTER;

export default function Page() {
  const router     = useRouter();
  const { billId } = useParams();

  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [detail,       setDetail]       = useState(null);
  const [uuid,         setUuid]         = useState(null);

  const access = getPageAccess({ pageCode: "logistics_bill_register", pageType: "EDIT", defaultToAllowed: true });

  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    LB.MY_APPROVAL_STATUS, billId, true,
  );
  const { isPendingDeletion, pendingInfo, dismissDeletion } = useDeletePending("LB", billId, access.allowed);
  if (!access.allowed) return <PageNotAvailable />;

  const canOpenApproval = access.canApprove || isPendingForMe;

  const actions = getPageActions({
    router,
    onTimeLine:        () => setOpenTimeline(true),
    onApprove:         canOpenApproval ? () => setOpenApproval(true) : undefined,
    isPendingApproval: isPendingForMe,
    onPrint:           uuid ? () => window.open(`/print/logistics-bill/${uuid}`, "_blank") : undefined,
  });

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe
        ? `Your approval is required at Level ${myLevel} for this Logistics Bill.`
        : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
      pendingDeletion={isPendingDeletion ? pendingInfo : null}
      onDismissDeletion={dismissDeletion}
    >
      {detail && (
        <div className="px-3 pt-3">
          <LogisticsDocHeader
            kind="Logistics Bill"
            number={detail.lbNo}
            statuses={[
              { label: "Workflow", value: detail.workflowStatus },
              ...(detail.workflowStatus === "Approved" ? [
                { label: "Payment", value: detail.paymentStatus || "Unpaid" },
              ] : []),
            ]}
            meta={[
              { label: "Bill Date",   value: detail.billDate },
              { label: "Transporter", value: detail.vendor?.ledgerName },
              { label: "Invoice",     value: detail.vendorInvoiceNo },
              { label: "Net Payable", value: `₹ ${Number(detail.netPayable || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
              ...(detail.voucherId ? [{ label: "AP", value: "Posted" }] : []),
            ].filter((m) => m.value)}
          />
        </div>
      )}

      <LBForm
        mode={access.mode}
        lbId={billId}
        onAfterSubmit={refresh}
        onDetailLoaded={setDetail}
        onUuid={setUuid}
      />

      {detail && (
        <div className="px-3 pb-4">
          <LinkedChainPanel
            anchor="LB"
            tr={null}
            dcs={(detail.challans || []).map((c) => ({
              id: c.dcId,
              dcNo: c.dcNo,
              workflowStatus: c.workflowStatus,
              transitStatus: c.transitStatus || "Delivered",
            }))}
            lbs={[{
              id: detail.id,
              lbNo: detail.lbNo,
              workflowStatus: detail.workflowStatus,
              paymentStatus: detail.paymentStatus,
            }]}
          />
        </div>
      )}

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: billId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: LB.APPROVE },
          { type: "reback",  api: LB.REBACK  },
          { type: "reject",  api: LB.REJECT  },
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
        title="Logistics Bill Approval History"
        api={LB.HISTORY}
        entityId={billId}
      />
    </HeaderWrapper>
  );
}
