"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { isMasterEditable } from "@/helper/getMasterAccess";
import BankCashForm from "@/components/master/bank-cash/BankCashForm";
import { useCopyData } from "@/lib/copyRecord";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const router = useRouter();
  // Copy: /new?copy=<id> opens this form pre-filled from that record.
  const { data: copyData, ready: copyReady } = useCopyData(`${API_ENDPOINTS.MASTER.BANK_CASH.GET_BY_ID}/`, (d) => ({ ...d, bankCode: "" }));
  const canEdit = isMasterEditable();
  const actions = getPageActions({ router });

  if (!canEdit) return <PageNotAvailable />;

  if (!copyReady) return null;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <BankCashForm
        initialData={copyData || undefined} mode="create" />
    </HeaderWrapper>
  );
}
