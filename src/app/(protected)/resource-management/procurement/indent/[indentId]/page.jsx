"use client";

import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";

import { getPageActions } from "@/components/common/PageActionButtons";

import IndentForm from "@/components/resource/indent/IndentForm";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";

export default function Page() {
  const router = useRouter();

  const { indentId } = useParams();
  const access = getPageAccess({
    pageCode: "indent",
    pageType: "EDIT",
  });

  if (!access.allowed) {
    return <PageNotAvailable />;
  }

  const actions = getPageActions({
    onHome: () => router.push("/dashboard"),

    onBack: () => router.back(),

    onApprove: access.canApprove
      ? () => toast.info("Working on this feature")
      : undefined,
  });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <IndentForm
        mode={access.mode}
        canApprove={access.canApprove}
        indentId={indentId}
      />
    </HeaderWrapper>
  );
}
