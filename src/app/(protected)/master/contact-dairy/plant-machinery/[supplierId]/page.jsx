"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { isMasterEditable } from "@/helper/getMasterAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import SupplierForm from "@/components/contact-dairy/SupplierForm";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

const noopSubscribe = () => () => {};

export default function Page() {
  const { supplierId } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);

  // Role comes from a cookie, which is only readable in the browser: null on the
  // server, true/false on the client, so hydration stays consistent. Keep every
  // hook above the early returns (React requires the same hook order each render).
  const canView = useSyncExternalStore(noopSubscribe, isMasterEditable, () => null);

  useEffect(() => {
    if (!supplierId || !canView) return;
    apiRequest({ url: `${API_ENDPOINTS.SUPPLIER.GET_BY_ID}/${supplierId}`, method: "GET" })
      .then((res) => setData(Array.isArray(res?.data) ? res.data[0] : res?.data))
      .catch(() => {});
  }, [supplierId, canView]);

  if (canView === false) return <PageNotAvailable />;

  if (!data) return <div className="flex justify-center items-center h-[300px]"><EdoxMark size={32} /></div>;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <SupplierForm
        pageType="Plant_Machinery"
        mode="view"
        supplierId={supplierId}
        initialData={data}
        listPath="/master/contact-dairy/plant-machinery"
        disabled={true}
      />
    </HeaderWrapper>
  );
}
