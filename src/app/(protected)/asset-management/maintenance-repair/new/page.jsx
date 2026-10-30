"use client";
import { useRouter } from "next/navigation";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import MaintenanceForm     from "@/components/assetmanagement/maintenance-repair/MaintenanceForm";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_maintenance_repair", pageType: "EDIT", defaultToAllowed: true });
  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <MaintenanceForm mode="create" />
    </HeaderWrapper>
  );
}
