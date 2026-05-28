"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";

import { getPageActions } from "@/components/common/PageActionButtons";

import IndentForm from "@/components/resource/indent/IndentForm";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";

export default function Page() {
  const router = useRouter();
  const access =
  getPageAccess({
    pageCode: "indent",
    pageType: "ADD",
  });

  if (!access.allowed) {
  return <PageNotAvailable />;
}

  const actions = getPageActions({
    router,
  });

  return (
    <HeaderWrapper
      header={
        <PageHeader actions={actions} />
      }
    >
      <IndentForm mode="create" />
    </HeaderWrapper>
  );
}