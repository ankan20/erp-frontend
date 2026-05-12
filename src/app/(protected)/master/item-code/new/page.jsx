"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import ItemForm from "@/components/master/item/ItemForm";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { useRouter } from "next/navigation";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

export default function Page() {
  const [categories, setCategories] = useState(
    CATEGORY_OPTIONS.itemCategory || [],
  );
  // const [ccList, setCcList] = useState([]);
  // const [loading, setLoading] = useState(true);
  const router = useRouter();

  const actions = getPageActions({
    onHome: () => router.push("/dashboard"),
    onBack: () => router.back(),
  });

  // useEffect(() => {
  //   const fetchAll = async () => {
  //     // const [c, cc] = await Promise.all([
  //     //   apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CATEGORY }),
  //     //   apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE }),
  //     // ]);
  //     const cc = await apiRequest({
  //       url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE,
  //     });
  //     const itemOptions = CATEGORY_OPTIONS.itemCategory;

  //     setCategories(itemOptions || []);
  //     setCcList(cc.data || []);
  //     setLoading(false);
  //   };

  //   fetchAll();
  // }, []);

  // if (loading) return <Loader2 className="animate-spin m-auto mt-10" />;

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <ItemForm mode="create" categories={categories} />
      </HeaderWrapper>
    </>
  );
}
