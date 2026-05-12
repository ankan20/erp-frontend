"use client";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import CCForm from "@/components/master/cc-code/CCForm";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  const actions = getPageActions({
    onHome: () => router.push("/dashboard"),
    onBack: () => router.back(),
  });
  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <CCForm mode="create" />
      </HeaderWrapper>
    </>
  );
}
