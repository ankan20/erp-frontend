"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import LedgerForm from "@/components/master/ledger/LedgerForm";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";

export default function Page() {
  const { ledgerId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const router = useRouter();
  const canEdit = isMasterEditable();
  const actions = getPageActions({
    router,
  });

  useEffect(() => {
    if (!ledgerId) return;

    const fetchAll = async () => {
      try {
        // const [ledgerRes, categoryRes] = await Promise.all([
        //   apiRequest({
        //     url: `${API_ENDPOINTS.MASTER.GET_LEDGER_BY_ID}/${ledgerId}`,
        //   }),
        //   apiRequest({
        //     url: API_ENDPOINTS.MASTER.GET_ALL_CATEGORY,
        //   }),
        // ]);
        const ledgerRes = await apiRequest({
          url: `${API_ENDPOINTS.MASTER.GET_LEDGER_BY_ID}/${ledgerId}`,
        });
        const ledgerCategories = CATEGORY_OPTIONS.ledgerCategory;
        setData(ledgerRes.data[0]);
        setCategories(ledgerCategories || []);
      } catch (err) {
        toast.error(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [ledgerId]);

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
        <LedgerForm
          mode={canEdit ? "edit" : "view"}
          disabled={!canEdit}
          ledgerId={ledgerId}
          initialData={data}
          categories={categories}
        />
      </HeaderWrapper>
    </>
  );
}
