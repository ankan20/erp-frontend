"use client";

import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import GroupCategorySection from "@/components/master/group-category/GroupCategorySection";
import { API_ENDPOINTS } from "@/config/api.config";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  const actions = getPageActions({
    onHome: () => router.push("/dashboard"),
    onBack: () => router.back(),
  });
  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <div className="p-4 grid md:grid-cols-2 gap-10">
          {/* GROUP */}
          <GroupCategorySection
            title="Group"
            addLabel="+ Add Group"
            listApi={API_ENDPOINTS.MASTER.GET_ALL_GROUP}
            createApi={API_ENDPOINTS.MASTER.CREATE_GROUP}
            updateApi={API_ENDPOINTS.MASTER.UPDATE_GROUP_BY_ID}
            nameKey="groupName"
            idKey="groupId"
            headOptions={["Profit & Loss", "Balance Sheet"]}
          />

          {/* CATEGORY */}
          <GroupCategorySection
            title="Category"
            addLabel="+ Add Category"
            listApi={API_ENDPOINTS.MASTER.GET_ALL_CATEGORY}
            createApi={API_ENDPOINTS.MASTER.CREATE_CATEGORY}
            updateApi={API_ENDPOINTS.MASTER.UPDATE_CATEGORY_BY_ID}
            nameKey="categoryName"
            idKey="categoryId"
            headOptions={["Items", "Ledger", "Unit", "Tax"]}
          />
        </div>
      </HeaderWrapper>
    </>
  );
}
