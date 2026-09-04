"use client";

import { useRouter }      from "next/navigation";
import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable   from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import BudgetForm         from "@/components/finance/account/petty-cash/BudgetForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "petty_cash", pageType: "ADD" });
  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <BudgetForm mode="create" />
    </HeaderWrapper>
  );
}
