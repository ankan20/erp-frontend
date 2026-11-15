"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import SelfTaskView from "@/components/mis/SelfTaskView";

export default function SelfTaskPage() {
  const router = useRouter();
  const actions = getPageActions({ router });

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4">
        <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">Loading…</div>}>
          <SelfTaskView />
        </Suspense>
      </div>
    </HeaderWrapper>
  );
}
