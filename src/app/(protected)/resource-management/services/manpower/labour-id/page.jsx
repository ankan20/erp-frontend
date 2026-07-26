"use client";

import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ManpowerListPage from "@/components/resource/manpower/ManpowerListPage";

export default function Page() {
  const access = getPageAccess({ pageCode: "labour_id", pageType: "LIST" });
  if (!access.allowed) return <PageNotAvailable />;

  return <ManpowerListPage canAdd={access.canAdd} />;
}
