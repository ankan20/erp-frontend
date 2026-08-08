"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense }                   from "react";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import SaleReceiptBillingForm from "@/components/finance/account/sale/SaleReceiptBillingForm";

function NewBillingContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const receiptId    = searchParams.get("receiptId");
  const access       = getPageAccess({ pageCode: "receipt", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <SaleReceiptBillingForm mode="create" receiptId={receiptId} />
    </HeaderWrapper>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewBillingContent />
    </Suspense>
  );
}
