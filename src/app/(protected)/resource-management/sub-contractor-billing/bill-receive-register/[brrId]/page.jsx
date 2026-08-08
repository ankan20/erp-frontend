"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plug } from "lucide-react";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ApprovalActionModal from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { API_ENDPOINTS } from "@/config/api.config";
import BRRForm from "@/components/resource/brr/BRRForm";
import { useMyApprovalStatus } from "@/hooks/useMyApprovalStatus";

// Categories that route to GRN (BRG) billing; rest go to SRN (BRS)
const GRN_CATEGORIES = ["Purchases_Order", "Site_Transfer_Order", "Customer_Supply_Order"];

export default function Page() {
  const router = useRouter();
  const { brrId } = useParams();
  const [openApproval, setOpenApproval] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  // Populated by BRRForm's onDataLoaded — no separate fetch needed here
  const [brrStatus, setBrrStatus]         = useState("");
  const [orderCategory, setOrderCategory] = useState("");

  const access = getPageAccess({ pageCode: "bill_receive_register", pageType: "EDIT" });
  const { isPendingForMe, myLevel, refresh, dismiss } = useMyApprovalStatus(
    API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.MY_APPROVAL_STATUS,
    brrId,
    access.canApprove,
  );

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({
    router,
    onTimeLine: () => setOpenTimeline(true),
    onApprove: access.canApprove ? () => setOpenApproval(true) : undefined,
    isPendingApproval: isPendingForMe,
  });

  const isApproved  = brrStatus.toLowerCase() === "approved";
  const billingType = GRN_CATEGORIES.includes(orderCategory) ? "grn" : "srn";

  const handleOpenEReconcile = () => {
    // TODO: may change whether to check approval status strictly — currently only active when approved
    router.push(
      `/resource-management/sub-contractor-billing/e-reconcile-bill/new?brrId=${brrId}&billingType=${billingType}`
    );
  };

  return (
    <HeaderWrapper
      header={<PageHeader actions={actions} />}
      pendingApproval={isPendingForMe ? `Your approval is required at Level ${myLevel} for this BRR.` : null}
      onDismissApproval={isPendingForMe ? dismiss : undefined}
    >
      <BRRForm
        mode={access.mode}
        brrId={brrId}
        onDataLoaded={({ workflowStatus, orderCategory: cat }) => {
          setBrrStatus(workflowStatus);
          setOrderCategory(cat);
        }}
        onAfterSubmit={refresh}
      />

      {/* E-Reconcile Bill connect button — only active when BRR is Approved */}
      <div className="px-3 pb-4">
        <div className="border-t pt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenEReconcile}
            disabled={!isApproved}
            title={
              isApproved
                ? `Create ${billingType === "grn" ? "GRN" : "SRN"} Billing (E-Reconcile)`
                : "BRR must be Approved to create E-Reconcile Billing"
            }
            className={`inline-flex items-center gap-2 px-4 h-[36px] rounded-md border text-[13px] font-semibold transition-all
              ${isApproved
                ? "bg-[#7fc3d4] border-[#4a9fb5] text-black hover:bg-[#6ab8cb] cursor-pointer"
                : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-60"
              }`}
          >
            <Plug className="w-4 h-4" />
            Create E-Reconcile Bill ({billingType === "grn" ? "GRN" : "SRN"})
          </button>
          {!isApproved && brrStatus && (
            <span className="text-xs text-gray-500">Available after BRR approval</span>
          )}
        </div>
      </div>

      <ApprovalActionModal
        open={openApproval}
        onClose={() => setOpenApproval(false)}
        payload={{ id: brrId }}
        pendingInfo={{ isPendingForMe, myLevel }}
        actions={[
          { type: "approve", api: API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.APPROVE },
          { type: "reback", api: API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.REBACK },
          { type: "reject", api: API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.REJECT },
        ]}
        onSuccess={() => { setOpenApproval(false); refresh(); router.refresh(); }}
      />

      <HistoryTimelineSheet
        open={openTimeline}
        onClose={() => setOpenTimeline(false)}
        title="BRR Approve History"
        api={API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.HISTORY}
        entityId={brrId}
      />
    </HeaderWrapper>
  );
}
