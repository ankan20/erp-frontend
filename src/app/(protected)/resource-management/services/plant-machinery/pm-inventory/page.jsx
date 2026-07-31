"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import SearchSection from "@/components/common/SearchSection";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import StockTable from "@/components/resource/stock/StockTable";
import StockItemDetailModal from "@/components/resource/stock/StockItemDetailModal";

const PAGE_LIMIT = 10;
const PM_CC_CODES = "AETT,APNM,AELE";

export default function PMInventoryPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "pm_inventory", pageType: "LIST" });

  const [projectCode, setProjectCode] = useState("");
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [appliedSearch, setAppliedSearch] = useState({ search: "", from: "", to: "" });
  const [selectedItem, setSelectedItem] = useState(null);

  const headerActions = getPageActions({ router });

  useEffect(() => {
    const projectInfo = getLocalStorage("projectInfo") || {};
    setProjectCode(projectInfo?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    const fetchData = async () => {
      if (page === 1 && rawData.length === 0) setLoading(true);
      else setTableLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.STOCK.LIST}?project_code=${projectCode}&cc_code=${PM_CC_CODES}&page=${page}&limit=${PAGE_LIMIT}`,
          method: "GET",
        });
        setRawData(res.data?.data || []);
        setPagination(res.data?.pagination || null);
      } catch {
        toast.error("Failed to fetch PM inventory data");
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    };
    fetchData();
  }, [projectCode, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredData = useMemo(() => {
    const { search: s } = appliedSearch;
    if (!s) return rawData;
    const lower = s.toLowerCase();
    return rawData
      .map((group) => {
        let items = (group.items || []).filter(
          (item) =>
            item.itemName?.toLowerCase().includes(lower) ||
            item.itemCode?.toLowerCase().includes(lower) ||
            group.ccCode?.toLowerCase().includes(lower) ||
            group.ccName?.toLowerCase().includes(lower)
        );
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0 || group.ccCode?.toLowerCase().includes(lower) || group.ccName?.toLowerCase().includes(lower));
  }, [rawData, appliedSearch]);

  if (!access.allowed) return <PageNotAvailable />;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  const pageActions = [
    { label: "+ P&M ID", onClick: () => router.push("/resource-management/services/plant-machinery/pm-inventory/pm-id") },
    { label: "+ Service Data", onClick: () => router.push("/resource-management/services/plant-machinery/pm-inventory/service-data") },
  ];

  return (
    <HeaderWrapper header={<PageHeader actions={headerActions} />}>
      <div className="px-3 py-3">
        <SearchSection
          onSearch={(v) => setAppliedSearch(v)}
          showDateRange
          actions={pageActions}
        />
        <StockTable
          data={filteredData}
          onItemClick={(item) => setSelectedItem(item)}
          pagination={pagination}
          onPageChange={(p) => setPage(p)}
          tableLoading={tableLoading}
        />
        {selectedItem && (
          <StockItemDetailModal
            item={selectedItem}
            projectCode={projectCode}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </div>
    </HeaderWrapper>
  );
}
