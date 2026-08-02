"use client";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import ExtraWorkForm      from "@/components/project-management/contacts/extra-work/ExtraWorkForm";
import { useRouter }      from "next/navigation";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "extra_work", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <ExtraWorkForm mode="create" />
    </HeaderWrapper>
  );
}
