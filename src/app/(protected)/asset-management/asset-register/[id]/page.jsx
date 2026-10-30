"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import AssetRegisterForm   from "@/components/assetmanagement/asset-register/AssetRegisterForm";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const access = getPageAccess({ pageCode: "am_asset_register", pageType: "EDIT" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <AssetRegisterForm mode={access.mode} assetId={id} />
    </HeaderWrapper>
  );
}
