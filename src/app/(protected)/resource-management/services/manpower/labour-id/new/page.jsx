"use client";

import { useRouter } from "next/navigation";

import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import ManpowerForm from "@/components/resource/manpower/ManpowerForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "labour_id", pageType: "ADD" });
  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <ManpowerForm mode="create" />
    </HeaderWrapper>
  );
}
