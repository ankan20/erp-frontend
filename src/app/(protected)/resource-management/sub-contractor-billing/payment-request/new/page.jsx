"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PaymentRequestForm from "@/components/resource/payment-request/PaymentRequestForm";

function NewPaymentRequest() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const access = getPageAccess({ pageCode: "payment_request", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <PaymentRequestForm mode={access.mode} presetBrrId={searchParams.get("brrId")} />
    </HeaderWrapper>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewPaymentRequest />
    </Suspense>
  );
}
