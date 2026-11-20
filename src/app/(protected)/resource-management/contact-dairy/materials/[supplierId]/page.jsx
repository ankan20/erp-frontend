"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EdoxMark } from "@/components/common/EdoxLoader";

import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import SupplierForm from "@/components/contact-dairy/SupplierForm";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const { supplierId } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);

  const access = getPageAccess({ pageCode: "contact_dairy_materials", pageType: "EDIT" });

  useEffect(() => {
    if (!supplierId || !access.allowed) return;
    apiRequest({ url: `${API_ENDPOINTS.SUPPLIER.GET_BY_ID}/${supplierId}`, method: "GET" })
      .then((res) => setData(Array.isArray(res?.data) ? res.data[0] : res?.data))
      .catch(() => {});
  }, [supplierId]);

  if (!access.allowed) return <PageNotAvailable />;

  if (!data) return <div className="flex justify-center items-center h-[300px]"><EdoxMark size={32} /></div>;

  const actions = getPageActions({ router });
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <SupplierForm
        pageType="Materials"
        mode={access.mode}
        supplierId={supplierId}
        initialData={data}
        listPath="/resource-management/contact-dairy/materials"
        disabled={access.disabled}
      />
    </HeaderWrapper>
  );
}
