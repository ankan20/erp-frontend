"use client";
import { useRouter } from "next/navigation";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import DepreciationForm    from "@/components/assetmanagement/depreciation-disposal/DepreciationForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_depreciation_disposal", pageType: "EDIT", defaultToAllowed: true });
  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <DepreciationForm mode="create" viewType="disposal" />
    </HeaderWrapper>
  );
}
