"use client";

import { useRouter } from "next/navigation";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import AssetRegisterForm   from "@/components/assetmanagement/asset-register/AssetRegisterForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_asset_register", pageType: "EDIT" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <AssetRegisterForm mode="create" />
    </HeaderWrapper>
  );
}
