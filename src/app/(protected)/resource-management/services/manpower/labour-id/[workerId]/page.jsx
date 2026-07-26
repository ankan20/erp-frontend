"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import ManpowerForm from "@/components/resource/manpower/ManpowerForm";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const { workerId } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(false);

  const access = getPageAccess({ pageCode: "labour_id", pageType: "EDIT" });
  const actions = getPageActions({ router });

  useEffect(() => {
    if (!workerId || !access.allowed) return;
    apiRequest({ url: `${API_ENDPOINTS.RESOURCE.MANPOWER.LABOUR_ID.GET_BY_ID}/${workerId}`, method: "GET" })
      .then((res) => {
        const d = Array.isArray(res?.data) ? res.data[0] : res?.data;
        setData(d || null);
      })
      .catch(() => setLoadErr(true));
  }, [workerId]);

  if (!access.allowed) return <PageNotAvailable />;

  if (loadErr) {
    return (
      <div className="flex justify-center items-center h-[300px] text-gray-500 text-sm">
        Failed to load worker details.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <ManpowerForm
        mode={access.mode === "view" || access.mode === "approver" ? "view" : "edit"}
        workerId={workerId}
        initialData={data}
        disabled={access.disabled}
      />
    </HeaderWrapper>
  );
}
