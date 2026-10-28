"use client";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { useRouter }       from "next/navigation";
import UncertainAllocationForm from "@/components/project-management/customer-billing/uncertain-allocation/UncertainAllocationForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "uncertified_statement", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <UncertainAllocationForm mode="create" />
    </HeaderWrapper>
  );
}
