"use client";

import { useState } from "react";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import GroupCategorySection from "@/components/master/group-category/GroupCategorySection";
import SubGroupSection from "@/components/master/group-category/SubGroupSection";
import UnifiedAddModal from "@/components/master/group-category/UnifiedAddModal";
import GroupOrderPanel from "@/components/master/group-category/GroupOrderPanel";
import { API_ENDPOINTS } from "@/config/api.config";
import { useRouter } from "next/navigation";

const TABS = [
  { id: "manage", label: "Manage" },
  { id: "order", label: "Report Order" },
];

function SectionCard({ title, description, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("manage");
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSuccess = () => setRefreshTrigger((n) => n + 1);

  const actions = getPageActions({ router });

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <div className="p-4 space-y-5 max-w-[1200px]">

          {/* TABS */}
          <div className="flex items-center justify-between">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-0.5 gap-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer",
                    activeTab === tab.id
                      ? "bg-white text-[#1c3a5e] shadow-sm"
                      : "text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "manage" && (
              <button
                onClick={() => setUnifiedOpen(true)}
                className="flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer shadow-sm"
              >
                <span className="text-base leading-none">+</span>
                Add Group / Sub Group
              </button>
            )}
          </div>

          {/* MANAGE TAB */}
          {activeTab === "manage" && (
            <>
              {/* SUB GROUPS — top, full width */}
              <SectionCard
                title="Sub Groups"
                description="Tree structure under each Group — Sub Group → Sub Group 1 → Sub Group 2"
              >
                <SubGroupSection refreshTrigger={refreshTrigger} />
              </SectionCard>

              {/* GROUP + CATEGORY — below */}
              <div className="grid md:grid-cols-2 gap-4">
                <SectionCard
                  title="Groups"
                  description="Top-level ledger groups under Profit & Loss or Balance Sheet"
                >
                  <GroupCategorySection
                    title="Group"
                    listApi={API_ENDPOINTS.MASTER.GET_ALL_GROUP}
                    createApi={API_ENDPOINTS.MASTER.CREATE_GROUP}
                    updateApi={API_ENDPOINTS.MASTER.UPDATE_GROUP_BY_ID}
                    nameKey="groupName"
                    idKey="groupId"
                    headOptions={["Profit & Loss", "Balance Sheet"]}
                    refreshTrigger={refreshTrigger}
                  />
                </SectionCard>

                <SectionCard
                  title="Categories"
                  description="Item and ledger categories (Items, Ledger, Unit, Tax)"
                >
                  <GroupCategorySection
                    title="Category"
                    listApi={API_ENDPOINTS.MASTER.GET_ALL_CATEGORY}
                    createApi={API_ENDPOINTS.MASTER.CREATE_CATEGORY}
                    updateApi={API_ENDPOINTS.MASTER.UPDATE_CATEGORY_BY_ID}
                    nameKey="categoryName"
                    idKey="categoryId"
                    headOptions={["Items", "Ledger", "Unit", "Tax"]}
                    refreshTrigger={refreshTrigger}
                  />
                </SectionCard>
              </div>
            </>
          )}

          {/* REPORT ORDER TAB */}
          {activeTab === "order" && (
            <SectionCard
              title="Report Order"
              description="Set the display order of groups and sub-groups for P&L and Balance Sheet reports"
            >
              <GroupOrderPanel />
            </SectionCard>
          )}

        </div>
      </HeaderWrapper>

      <UnifiedAddModal
        open={unifiedOpen}
        onClose={() => setUnifiedOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
