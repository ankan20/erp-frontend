"use client";

import { useRouter }    from "next/navigation";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import SaleReceiptParentForm from "@/components/finance/account/sale/SaleReceiptParentForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "receipt", pageType: "ADD" });
  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <div className="max-w-[520px] p-4">
        <SaleReceiptParentForm mode="create" />
      </div>
    </HeaderWrapper>
  );
}
