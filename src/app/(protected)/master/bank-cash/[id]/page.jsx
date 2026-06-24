"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import BankCashForm from "@/components/master/bank-cash/BankCashForm";

const BC = API_ENDPOINTS.MASTER.BANK_CASH;

export default function Page() {
  const { id } = useParams();
  const router = useRouter();
  const canEdit = isMasterEditable();
  const actions = getPageActions({ router });

  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const res = await apiRequest({ url: `${BC.GET_BY_ID}/${id}`, method: "GET" });
      setData(res.data?.[0] || null);
    };
    fetchData();
  }, [id]);

  if (!data) return null;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <BankCashForm
        mode={canEdit ? "edit" : "view"}
        disabled={!canEdit}
        recordId={id}
        initialData={data}
      />
    </HeaderWrapper>
  );
}
