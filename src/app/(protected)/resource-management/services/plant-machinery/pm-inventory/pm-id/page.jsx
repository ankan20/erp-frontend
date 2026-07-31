"use client";

import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import PMIdListPage from "@/components/resource/machinery/PMIdListPage";

export default function Page() {
  const access = getPageAccess({ pageCode: "pm_inventory", pageType: "LIST" });
  if (!access.allowed) return <PageNotAvailable />;

  return <PMIdListPage canAdd={access.canAdd} />;
}
