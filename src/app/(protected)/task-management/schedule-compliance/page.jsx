"use client";

import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import ScheduleComplianceView from "@/components/mis/ScheduleComplianceView";

export default function ScheduleCompliancePage() {
  const router = useRouter();
  const actions = getPageActions({ router });
  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4">
        <ScheduleComplianceView />
      </div>
    </HeaderWrapper>
  );
}
