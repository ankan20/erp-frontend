"use client";

import { useRouter } from "next/navigation";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import SupplierForm from "@/components/contact-dairy/SupplierForm";
import { useCopyData } from "@/lib/copyRecord";
import { API_ENDPOINTS } from "@/config/api.config";

export default function Page() {
  const router = useRouter();
  // Copy: /new?copy=<id> opens this form pre-filled from that record.
  const { data: copyData, ready: copyReady } = useCopyData(`${API_ENDPOINTS.SUPPLIER.GET_BY_ID}/`, (d) => ({ ...d, supplierCode: "", linkedLedgers: [] }));
  const access = getPageAccess({ pageCode: "contact_dairy_materials", pageType: "ADD" });
  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });
  if (!copyReady) return null;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <SupplierForm
        initialData={copyData || undefined}
        pageType="Materials"
        mode="create"
        listPath="/resource-management/contact-dairy/materials"
      />
    </HeaderWrapper>
  );
}
