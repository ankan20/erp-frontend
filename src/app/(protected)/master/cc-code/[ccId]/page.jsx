"use client";

import { useParams, useRouter } from "next/navigation";
import CCForm from "@/components/master/cc-code/CCForm";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";

export default function Page() {
  const { ccId } = useParams();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const router = useRouter();
  const canEdit = isMasterEditable();

  const actions = getPageActions({
    router,
  });

  useEffect(() => {
    if (!ccId) return;
    if (ccId) {
      const fetchData = async () => {
        try {
          const res = await apiRequest({
            url: `${API_ENDPOINTS.MASTER.GET_CC_CODE_BY_ID}/${ccId}`,
          });

          const d = res.data[0];

          let respdata = {
            ccCode: d.ccCode,
            ccName: d.ccName,
            groupId: String(d.ccGroupId),
            categoryId: String(d.ccCategoryId),
          };
          setData(respdata);
        } catch {
          toast.error("Failed to fetch");
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [ccId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <CCForm
          mode={canEdit ? "edit" : "view"}
          disabled={!canEdit}
          ccId={ccId}
          data={data}
        />
      </HeaderWrapper>
    </>
  );
}
