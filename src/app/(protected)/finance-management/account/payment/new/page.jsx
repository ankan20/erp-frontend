"use client";

import { useSearchParams } from "next/navigation";
import { useRouter }       from "next/navigation";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import PaymentForm         from "@/components/finance/account/payment/PaymentForm";

export default function Page() {
  const router      = useRouter();
  const params      = useSearchParams();
  const paymentType = params.get("type") || "bill"; // "bill" | "voucher"

  const access  = getPageAccess({ pageCode: "payment", pageType: "ADD" });
  const actions = getPageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <PaymentForm mode="create" paymentType={paymentType} />
    </HeaderWrapper>
  );
}
