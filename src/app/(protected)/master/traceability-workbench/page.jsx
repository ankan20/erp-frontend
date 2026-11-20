"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { EdoxMark } from "@/components/common/EdoxLoader";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import TraceabilityWorkbench from "@/components/master/traceability/TraceabilityWorkbench";

// Read-only. Access to every document is enforced by the backend per
// project and per document type; this page needs no master edit rights.
export default function Page() {
  const router = useRouter();
  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <Suspense
        fallback={
          <div className="flex h-[300px] items-center justify-center">
            <EdoxMark size={32} />
          </div>
        }
      >
        <TraceabilityWorkbench />
      </Suspense>
    </HeaderWrapper>
  );
}
