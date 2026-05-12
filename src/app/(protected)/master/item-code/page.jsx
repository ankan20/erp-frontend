"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

export default function Page() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);

  const actions = getPageActions({
    onHome: () => router.push("/dashboard"),
    onBack: () => router.back(),
  });

  //  INITIAL LOAD
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.GET_ALL_ITEM,
          method: "GET",
        });

        const items = res.data || [];

        const formatted = items.map((p, index) => ({
          itemId: p.itemId,
          sl: index + 1,
          itemCode: p.itemCode,
          itemName: p.itemName,
          itemCategoryName: p.itemCategoryName,
          hsnSac: p.hsnSac,
          gstPercentage: p.gstPercentage,
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch item details.");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  // SEARCH HANDLER
  const handleSearch = ({ search }) => {
    if (!search) {
      setFilteredData(data);
      return;
    }

    const filtered = data.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(search.toLowerCase()),
      ),
    );

    setFilteredData(filtered);
  };

  //  TABLE COLUMNS
  const columns = [
    { header: "Sl. no", accessor: "sl" },
    { header: "Item Code", accessor: "itemCode" },
    { header: "Item Name", accessor: "itemName" },
    { header: "Category", accessor: "itemCategoryName" },
    { header: "HSN", accessor: "hsnSac" },
    { header: "GST%", accessor: "gstPercentage" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <div className="p-3">
          {/*  SEARCH SECTION */}
          <SearchSection
            onSearch={handleSearch}
            actions={[
              {
                label: "+ New Item Code",
                onClick: () => router.push("/master/item-code/new"),
              },
            ]}
          />

          {/*  TABLE */}
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => {
              router.push(`/master/item-code/${row.itemId}`);
            }}
          />
        </div>
      </HeaderWrapper>
    </>
  );
}
