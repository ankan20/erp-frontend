"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { isMasterEditable } from "@/helper/getMasterAccess";
import BankCashForm from "@/components/master/bank-cash/BankCashForm";

export default function Page() {
  const router = useRouter();
  const canEdit = isMasterEditable();
  const actions = getPageActions({ router });

  if (!canEdit) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <BankCashForm mode="create" />
    </HeaderWrapper>
  );
}
