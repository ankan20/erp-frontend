"use client";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { useRouter }      from "next/navigation";
import CreditNoteForm     from "@/components/finance/account/credit-note/CreditNoteForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "credit_note", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <CreditNoteForm mode="create" />
    </HeaderWrapper>
  );
}
