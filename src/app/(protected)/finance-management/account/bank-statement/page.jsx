"use client";

import { useRouter }         from "next/navigation";
import HeaderWrapper         from "@/components/layout/HeaderWrapper";
import PageHeader            from "@/components/layout/PageHeader";
import PageNotAvailable      from "@/components/common/PageNotAvailable";
import { getPageActions }    from "@/components/common/PageActionButtons";
import { getPageAccess }     from "@/helper/getPageAccess";
import BankStatementImport   from "@/components/finance/account/bank-statement/BankStatementImport";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "bank_statement", pageType: "LIST" });
  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <BankStatementImport canImport={!!access.canAdd} />
    </HeaderWrapper>
  );
}
