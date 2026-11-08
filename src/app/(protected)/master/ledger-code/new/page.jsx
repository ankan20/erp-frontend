"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import LedgerFormNew from "@/components/master/ledger/LedgerFormNew";
import { useCopyData } from "@/lib/copyRecord";

export default function Page() {
  const [categories, setCategories] = useState(CATEGORY_OPTIONS.ledgerCategory);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Copy: /new?copy=<id> opens this form pre-filled from that record.
  const { data: copyData, ready: copyReady } = useCopyData(`${API_ENDPOINTS.MASTER.GET_LEDGER_BY_ID}/`);
  const canEdit = isMasterEditable();

  const actions = getPageActions({
    router,
  });

  // useEffect(() => {
  //   const fetchCategories = async () => {
  //     try {
  //       const res = await apiRequest({
  //         url: API_ENDPOINTS.MASTER.GET_ALL_CATEGORY,
  //       });

  //       setCategories(res.data || []);
  //     } catch (err) {
  //       toast.error(err.message || "Failed to load categories");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchCategories();
  // }, []);

  // if (loading) {
  //   return (
  //     <div className="flex justify-center items-center h-[300px]">
  //       <Loader2 className="animate-spin w-6 h-6" />
  //     </div>
  //   );
  // }
  // BLOCK NON-ADMIN USERS
  if (!canEdit) {
    return <PageNotAvailable />;
  }

  if (!copyReady) return null;

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <LedgerFormNew
        initialData={copyData || undefined} mode="create" categories={categories} />
      </HeaderWrapper>
    </>
  );
}
