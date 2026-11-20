"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { toast } from "sonner";
import { EdoxMark } from "@/components/common/EdoxLoader";
import SearchSection from "@/components/common/SearchSection";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import StockTable from "@/components/resource/stock/StockTable";
import StockItemDetailModal from "@/components/resource/stock/StockItemDetailModal";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";

const PAGE_LIMIT = 10;

export default function StockReportPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "stock_report", pageType: "LIST" });

  const [projectCode, setProjectCode] = useState("");
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);

  const [appliedSearch, setAppliedSearch] = useState({ search: "", from: "", to: "" });

  useEffect(() => {
    const projectInfo = getLocalStorage("projectInfo") || {};
    setProjectCode(projectInfo?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    const fetchStock = async () => {
      if (page === 1 && rawData.length === 0) {
        setLoading(true);
      } else {
        setTableLoading(true);
      }
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.STOCK.LIST}?project_code=${projectCode}&item_category=MAT_001&page=${page}&limit=${PAGE_LIMIT}`,
          method: "GET",
        });
        setRawData(res.data?.data || []);
        setPagination(res.data?.pagination || null);
      } catch {
        toast.error("Failed to fetch stock data");
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    };
    fetchStock();
  }, [projectCode, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = ({ search: s, from, to }) => {
    setAppliedSearch({ search: s, from, to });
  };

  const filteredData = useMemo(() => {
    const { search: s } = appliedSearch;
    if (!s) return rawData;

    return rawData
      .map((group) => {
        let items = group.items || [];
        const lower = s.toLowerCase();
        items = items.filter(
          (item) =>
            item.itemName?.toLowerCase().includes(lower) ||
            item.itemCode?.toLowerCase().includes(lower) ||
            group.ccCode?.toLowerCase().includes(lower) ||
            group.ccName?.toLowerCase().includes(lower)
        );
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [rawData, appliedSearch]);

  // Must be called before any early returns — getPageActions uses a hook internally
  const headerActions = getPageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <EdoxMark size={32} />
      </div>
    );
  }

  const pageActions = [
    {
      label: "Closing Stock List",
      onClick: () => toast.info("Closing Stock List — coming soon"),
    },
    {
      label: "+ Create Closing Stock",
      onClick: () => toast.info("Create Closing Stock — coming soon"),
    },
  ];

  return (
    <HeaderWrapper header={<PageHeader actions={headerActions} />}>
      <div className="px-3 py-3">
        <SearchSection
          onSearch={handleSearch}
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
