"use client";

import { useRouter }      from "next/navigation";
import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable   from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import BudgetMasterForm   from "@/components/project-management/contacts/budget/BudgetMasterForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "budget_master", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <BudgetMasterForm mode="create" />
    </HeaderWrapper>
  );
}
