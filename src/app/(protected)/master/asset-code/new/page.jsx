"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import AssetForm from "@/components/master/asset/AssetForm";
import { getPageActions } from "@/components/common/PageActionButtons";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";

export default function Page() {
  const [categories, setCategories] = useState(
    CATEGORY_OPTIONS.assetCategory || [],
  );
  // const [loading, setLoading] = useState(true);
  const router = useRouter();
  const canEdit = isMasterEditable();

  const actions = getPageActions({
    router,
  });

  // useEffect(() => {
  //   const load = async () => {
  //     const res = await apiRequest({
  //       url: API_ENDPOINTS.MASTER.GET_ALL_CATEGORY,
  //     });

  //     setCategories(res.data || []);
  //     setLoading(false);
  //   };

  //   load();
  // }, []);

  // if (loading) return <Loader2 className="animate-spin m-auto mt-10" />;
  // BLOCK NON-ADMIN USERS
  if (!canEdit) {
    return <PageNotAvailable />;
  }

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <AssetForm mode="create" categories={categories} />
      </HeaderWrapper>
    </>
  );
}
