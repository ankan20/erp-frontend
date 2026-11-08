"use client";

import { getPageActions } from "@/components/common/PageActionButtons";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import UnitForm from "@/components/master/unit/UnitForm";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { useRouter } from "next/navigation";
import { useCopyData } from "@/lib/copyRecord";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const router = useRouter();
  // Copy: /new?copy=<id> opens this form pre-filled from that record.
  const { data: copyData, ready: copyReady } = useCopyData(`${API_ENDPOINTS.MASTER.GET_UNIT_BY_ID}/`);
  const canEdit = isMasterEditable();

  const actions = getPageActions({
    router,
  });
  // BLOCK NON-ADMIN USERS
  if (!canEdit) {
    return <PageNotAvailable />;
  }
  if (!copyReady) return null;

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <UnitForm
        initialData={copyData || undefined} mode="create" />
      </HeaderWrapper>
    </>
  );
}
