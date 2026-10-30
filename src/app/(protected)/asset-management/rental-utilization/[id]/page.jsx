"use client";
import { useParams, useRouter } from "next/navigation";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import RentalForm          from "@/components/assetmanagement/rental-utilization/RentalForm";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const access = getPageAccess({ pageCode: "am_rental_utilization", pageType: "EDIT", defaultToAllowed: true });
  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <RentalForm mode={access.mode} docId={id} />
    </HeaderWrapper>
  );
}
