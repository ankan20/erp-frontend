"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { isMasterEditable } from "@/helper/getMasterAccess";
import TermsForm from "@/components/master/terms-condition/TermsForm";
import { useCopyData, stripSavedIds } from "@/lib/copyRecord";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const router  = useRouter();
  // Copy: /new?copy=<id> opens this form pre-filled from that record.
  const { data: copyData, ready: copyReady } = useCopyData(`${API_ENDPOINTS.MASTER.TERM.GET_BY_ID}/`, stripSavedIds);
  const canEdit = isMasterEditable();
  const actions = getPageActions({ router });

  if (!canEdit) return <PageNotAvailable />;

  if (!copyReady) return null;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <TermsForm
        initialData={copyData || undefined} mode="create" />
    </HeaderWrapper>
  );
}
