"use client";

import { useRouter }               from "next/navigation";
import { Loader2 }                 from "lucide-react";
import HeaderWrapper               from "@/components/layout/HeaderWrapper";
import PageHeader                  from "@/components/layout/PageHeader";
import PageNotAvailable            from "@/components/common/PageNotAvailable";
import { getPageActions }          from "@/components/common/PageActionButtons";
import { useIssueTrackerStatus }   from "@/lib/issueTrackerStatus";
import IssueTracker                from "@/components/issue-tracker/IssueTracker";

// Access comes from the page's own member list + kill switch (not role permissions)
export default function Page() {
  const router = useRouter();
  const status = useIssueTrackerStatus();
  const actions = getPageActions({ router }); // a hook — keep it above the early returns

  if (!status) {
    return <div className="flex items-center gap-2 p-4 text-sm text-gray-500"><Loader2 className="animate-spin" size={16} /> Loading…</div>;
  }
  if (!status.isSuperAdmin && !(status.enabled && status.canView)) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <IssueTracker status={status} />
    </HeaderWrapper>
  );
}
