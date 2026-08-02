"use client";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import SaleClaimBillForm   from "@/components/project-management/customer-billing/sale-claim-bill/SaleClaimBillForm";
import { useRouter }       from "next/navigation";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "sale_claim_bill", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <SaleClaimBillForm mode="create" />
    </HeaderWrapper>
  );
}
