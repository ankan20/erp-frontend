"use client";

import { useRouter } from "next/navigation";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import LBForm from "@/components/logistics/bill-register/LBForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "logistics_bill_register", pageType: "ADD", defaultToAllowed: true });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <LBForm mode="create" />
    </HeaderWrapper>
  );
}
