"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import ItemForm from "@/components/master/item/ItemForm";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";

export default function Page() {
  const { itemId } = useParams();

  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const canEdit = isMasterEditable();

  const actions = getPageActions({
    onHome: () => router.push("/dashboard"),
    onBack: () => router.back(),
  });

  useEffect(() => {
    const fetchAll = async () => {
      // const [itemRes, cc] = await Promise.all([
      //   apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ITEM_BY_ID}/${itemId}` }),
      //    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CATEGORY }),
      //   apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE }),
      // ]);
      const itemRes = await apiRequest({
        url: `${API_ENDPOINTS.MASTER.GET_ITEM_BY_ID}/${itemId}`,
      });

      const itemOptions = CATEGORY_OPTIONS.itemCategory;
      setData(itemRes.data[0]);
      setCategories(itemOptions || []);
      setLoading(false);
    };

    fetchAll();
  }, [itemId]);

  if (loading) return <Loader2 className="animate-spin m-auto mt-10" />;

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <ItemForm
          mode={canEdit ? "edit" : "view"}
          disabled={!canEdit}
          itemId={itemId}
          initialData={data}
          categories={categories}
        />
      </HeaderWrapper>
    </>
  );
}
