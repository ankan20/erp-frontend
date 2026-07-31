"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import ServiceScheduleForm from "@/components/resource/machinery/ServiceScheduleForm";

export default function Page() {
  const { id } = useParams();
  const router = useRouter();
  const access = getPageAccess({ pageCode: "pm_inventory", pageType: "EDIT" });
  const actions = getPageActions({ router });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.MACHINERY.SERVICE_SCHEDULE.GET_BY_ID}${id}`,
          method: "GET",
        });
        setData(res.data);
      } catch {
        toast.error("Failed to load Service Schedule details");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (!access.allowed) return <PageNotAvailable />;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <ServiceScheduleForm mode="edit" recordId={id} initialData={data} />
    </HeaderWrapper>
  );
}
