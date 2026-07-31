"use client";

import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import ServiceDataPage from "@/components/resource/machinery/ServiceDataPage";

export default function Page() {
  const access = getPageAccess({ pageCode: "pm_inventory", pageType: "LIST" });
  if (!access.allowed) return <PageNotAvailable />;

  return <ServiceDataPage canAdd={access.canAdd} />;
}
