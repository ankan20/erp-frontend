"use client";

import HeaderWrapper  from "@/components/layout/HeaderWrapper";
import PageHeader     from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { useRouter }      from "next/navigation";
import DebitNoteForm      from "@/components/finance/account/debit-note/DebitNoteForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "debit_note", pageType: "ADD" });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <DebitNoteForm mode="create" />
    </HeaderWrapper>
  );
}
