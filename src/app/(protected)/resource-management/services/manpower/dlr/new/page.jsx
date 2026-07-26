"use client";

import { useRouter } from "next/navigation";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import DLRForm from "@/components/resource/manpower/DLRForm";

export default function Page() {
  const router  = useRouter();
  const access  = getPageAccess({ pageCode: "dlr", pageType: "ADD" });
  const actions = getPageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <DLRForm mode="create" />
    </HeaderWrapper>
  );
}
