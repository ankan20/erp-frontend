"use client";

import { useRouter } from "next/navigation";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import PMIdForm from "@/components/resource/machinery/PMIdForm";
import { useCopyData } from "@/lib/copyRecord";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const router = useRouter();
  // Copy: /new?copy=<id> opens this form pre-filled from that record.
  const { data: copyData, ready: copyReady } = useCopyData(API_ENDPOINTS.RESOURCE.MACHINERY.PM_ID.GET_BY_ID, (d) => ({
    ...d, pmUid: "", registrationFile: null, insuranceFile: null, pucFile: null, roadTaxFile: null, purchasedBillFile: null,
  }));
  const access = getPageAccess({ pageCode: "pm_inventory", pageType: "ADD" });
  const actions = getPageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;

  if (!copyReady) return null;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <PMIdForm
        initialData={copyData || undefined} mode="create" />
    </HeaderWrapper>
  );
}
