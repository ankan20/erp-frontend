"use client";

import { use }            from "react";
import { useRouter }      from "next/navigation";
import HeaderWrapper      from "@/components/layout/HeaderWrapper";
import PageHeader         from "@/components/layout/PageHeader";
import PageNotAvailable   from "@/components/common/PageNotAvailable";
import { getPageAccess }  from "@/helper/getPageAccess";
import BudgetForm         from "@/components/finance/account/petty-cash/BudgetForm";

export default function Page({ params }) {
  const { id } = use(params);
  const router  = useRouter();
  const access  = getPageAccess({ pageCode: "petty_cash", pageType: "EDIT" });
  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={[]} />}>
      <BudgetForm
        mode={access.mode}
        budgetId={id}
        canApprove={access.canApprove}
      />
    </HeaderWrapper>
  );
}
