"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import AssetForm from "@/components/master/asset/AssetForm";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

export default function Page() {
  const { assetId } = useParams();

  const [data, setData] = useState(null);
  const [categories, setCategories] = useState(CATEGORY_OPTIONS.assetCategory || []);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const actions = getPageActions({

    onHome: () => router.push("/dashboard"),
    onBack: () => router.back(),

  });

  useEffect(() => {
    const load = async () => {
      // const [assetRes, catRes] = await Promise.all([
      //   apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ASSET_BY_ID}/${assetId}` }),
      //   apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CATEGORY }),
      // ]);
      const assetRes = await apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ASSET_BY_ID}/${assetId}` });

      setData(assetRes.data[0]);
      setLoading(false);
    };

    load();
  }, [assetId]);

  if (loading) return <Loader2 className="animate-spin m-auto mt-10" />;

  return (
    <>
      <HeaderWrapper
            header={<PageHeader actions={actions} />}
          >
      <AssetForm
        mode="edit"
        assetId={assetId}
        initialData={data}
        categories={categories}
      />
      </HeaderWrapper>
    </>

  );
}