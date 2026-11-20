"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { EdoxMark } from "@/components/common/EdoxLoader";
import ItemForm from "@/components/master/item/ItemForm";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { useRouter } from "next/navigation";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { useCopyData } from "@/lib/copyRecord";

export default function Page() {
  const [categories, setCategories] = useState(
    CATEGORY_OPTIONS.itemCategory || [],
  );
  // const [ccList, setCcList] = useState([]);
  // const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Copy: /new?copy=<id> opens this form pre-filled from that record.
  const { data: copyData, ready: copyReady } = useCopyData(`${API_ENDPOINTS.MASTER.GET_ITEM_BY_ID}/`);
  const canEdit = isMasterEditable();

  const actions = getPageActions({
    router,
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

  // if (loading) return <EdoxMark size={32} className="m-auto mt-10" />;
  // BLOCK NON-ADMIN USERS
    if (!canEdit) {
      return <PageNotAvailable />;
    }

  if (!copyReady) return null;

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <ItemForm
        initialData={copyData || undefined} mode="create" categories={categories} />
      </HeaderWrapper>
    </>
  );
}
