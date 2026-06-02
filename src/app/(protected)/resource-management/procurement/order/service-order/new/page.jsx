"use client";

import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import ServiceOrderForm from "@/components/resource/service-order/ServiceOrderForm";

export default function Page() {
  const router = useRouter();

  // Access uses "order" pageCode — same as order module
  const access = getPageAccess({ pageCode: "order", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <ServiceOrderForm mode={access.mode} />
    </HeaderWrapper>
  );
}
