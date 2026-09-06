"use client";

import { useRouter } from "next/navigation";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "journal", pageType: "LIST" });

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">

        <div className="flex items-center justify-center h-[300px] text-gray-400 text-[14px]">
          Journal Accounting — coming soon
        </div>
      </div>
    </HeaderWrapper>
  );
}
