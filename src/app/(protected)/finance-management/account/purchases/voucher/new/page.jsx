"use client";

import { useRouter }       from "next/navigation";
import HeaderWrapper       from "@/components/layout/HeaderWrapper";
import PageHeader          from "@/components/layout/PageHeader";
import PageNotAvailable    from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import PurchaseVoucherForm from "@/components/finance/account/purchases/PurchaseVoucherForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "purchases", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <PurchaseVoucherForm mode="create" />
    </HeaderWrapper>
  );
}
