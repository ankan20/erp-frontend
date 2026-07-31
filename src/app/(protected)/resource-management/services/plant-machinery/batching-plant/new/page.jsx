"use client";

import { useRouter } from "next/navigation";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import BatchingPlantForm from "@/components/resource/batching/BatchingPlantForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "batching_plant", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <BatchingPlantForm mode="create" />
    </HeaderWrapper>
  );
}
