"use client";
import { useRouter } from "next/navigation";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import AllocationForm      from "@/components/assetmanagement/site-allocation-transfer/AllocationForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_site_allocation", pageType: "EDIT", defaultToAllowed: true });
  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <AllocationForm mode="create" />
    </HeaderWrapper>
  );
}
