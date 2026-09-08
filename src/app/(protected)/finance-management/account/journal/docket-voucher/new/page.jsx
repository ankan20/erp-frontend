"use client";

// Journal → Voucher Docket (new). Same module as the Petty Cash copy, but the
// permission is checked against the "journal" page.

import { useRouter }       from "next/navigation";
import HeaderWrapper       from "@/components/layout/HeaderWrapper";
import PageHeader          from "@/components/layout/PageHeader";
import PageNotAvailable    from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import DocketVoucherForm   from "@/components/finance/account/petty-cash/DocketVoucherForm";

const BASE_PATH = "/finance-management/account/journal/docket-voucher";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "journal", pageType: "ADD" });
  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <DocketVoucherForm mode="create" basePath={BASE_PATH} />
    </HeaderWrapper>
  );
}
