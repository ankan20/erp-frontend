"use client";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import CCForm from "@/components/master/cc-code/CCForm";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const canEdit = isMasterEditable();
  

  const actions = getPageActions({
    router,
  });
  if (!canEdit) {
      return <PageNotAvailable />;
    }
  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <CCForm mode="create" />
      </HeaderWrapper>
    </>
  );
}
