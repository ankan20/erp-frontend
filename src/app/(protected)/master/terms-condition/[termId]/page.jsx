"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EdoxMark } from "@/components/common/EdoxLoader";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import TermsForm from "@/components/master/terms-condition/TermsForm";

const TC = API_ENDPOINTS.MASTER.TERM;

export default function Page() {
  const { termId } = useParams();
  const router     = useRouter();
  const canEdit    = isMasterEditable();
  const actions    = getPageActions({ router });

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!termId) return;
    const fetchData = async () => {
      try {
        let item;
          const res = await apiRequest({ url: `${TC.GET_BY_ID}/${termId}`, method: "GET" });
          item = res.data?.[0] || res.data || null;
        setData(item);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [termId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <EdoxMark size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center items-center h-[300px] text-sm text-gray-500">
        Term not found.
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <TermsForm
        mode={canEdit ? "edit" : "view"}
        disabled={!canEdit}
        termId={termId}
        initialData={data}
      />
    </HeaderWrapper>
  );
}
