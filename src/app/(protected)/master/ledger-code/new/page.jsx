"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import LedgerForm from "@/components/master/ledger/LedgerForm";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

export default function Page() {
  const [categories, setCategories] = useState(CATEGORY_OPTIONS.ledgerCategory);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const actions = getPageActions({
    onHome: () => router.push("/dashboard"),
    onBack: () => router.back(),
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

  return (
    <>
        <HeaderWrapper
      header={<PageHeader actions={actions} />}
    >
      <LedgerForm mode="create" categories={categories} />
      </HeaderWrapper>
    </>
  );
}
