"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import UnitForm from "@/components/master/unit/UnitForm";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";

export default function Page() {
  const { unitId } = useParams();
  const router = useRouter();
  const canEdit = isMasterEditable();

  const actions = getPageActions({
    router,
  });

  const [data, setData] = useState(null);

  useEffect(() => {
    if (!unitId) return;

    const fetchData = async () => {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.MASTER.GET_UNIT_BY_ID}/${unitId}`,
      });

      setData(res.data[0]);
    };

    fetchData();
  }, [unitId]);

  if (!data) return null;

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <UnitForm
          mode={canEdit ? "edit" : "view"}
          disabled={!canEdit}
          unitId={unitId}
          initialData={data}
        />
      </HeaderWrapper>
    </>
  );
}
