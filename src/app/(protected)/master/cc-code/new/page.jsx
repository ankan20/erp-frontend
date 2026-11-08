"use client";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import CCForm from "@/components/master/cc-code/CCForm";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { useRouter } from "next/navigation";
import { useCopyData } from "@/lib/copyRecord";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const router = useRouter();
  // Copy: /new?copy=<id> opens this form pre-filled from that record.
  const { data: copyData, ready: copyReady } = useCopyData(`${API_ENDPOINTS.MASTER.GET_CC_CODE_BY_ID}/`, (d) => ({
      ccCode: "", // codes are unique — type a new one
      ccName: d.ccName,
      groupId: String(d.ccGroupId),
      categoryId: String(d.ccCategoryId),
      subGroupId: d.ccSubGroupId ? String(d.ccSubGroupId) : "",
      subGroupPath: (d.ccSubGroupLevels || []).map((l) => l.subGroupId),
      headUnder: d.headUnder ?? null,
      isNonLedger: d.isNonLedger !== undefined ? d.isNonLedger : null,
      plLinked: !!d.plLinked,
      plGroupId: d.plGroupId ? String(d.plGroupId) : "",
      plSubGroupPath: (d.plSubGroupLevels || []).map((l) => l.subGroupId),
    }));
  const canEdit = isMasterEditable();
  

  const actions = getPageActions({
    router,
  });
  if (!canEdit) {
      return <PageNotAvailable />;
    }
  if (!copyReady) return null;

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <CCForm
        data={copyData || undefined} mode="create" />
      </HeaderWrapper>
    </>
  );
}
