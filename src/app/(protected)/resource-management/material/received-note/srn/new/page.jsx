"use client";

import { useRouter } from "next/navigation";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import SRNForm from "@/components/resource/srn/SRNForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "goods_received_note", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <SRNForm mode="create" />
    </HeaderWrapper>
  );
}
