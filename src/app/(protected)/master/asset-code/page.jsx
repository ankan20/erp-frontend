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
import { isMasterEditable } from "@/helper/getMasterAccess";

export default function Page() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const canEdit = isMasterEditable();

  //  INITIAL LOAD
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.GET_ALL_ASSET,
          method: "GET",
        });

        const assets = res.data || [];

        const formatted = assets.map((p, index) => ({
          assetId: p.assetId,
          sl: index + 1,
          assetDisplayCode: p.assetDisplayCode,
          assetName: p.assetName,
          assetCategoryName: p.assetCategoryName,
          unit: p.unit,
          hsnSac: p.hsnSac,
          gstPercentage: p.gstPercentage,
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch asset deatils.");
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
    { header: "Asset Code", accessor: "assetDisplayCode" },
    { header: "Asset Name", accessor: "assetName" },
    { header: "Category", accessor: "assetCategoryName" },
    { header: "Unit", accessor: "unit" },
    { header: "HSN", accessor: "hsnSac" },
    { header: "GST%", accessor: "gstPercentage" },
  ];

  const actions = getPageActions({
    router,
  });

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
            actions={
              canEdit
                ? [
                    {
                      label: "+ New Asset Code",

                      onClick: () => router.push("/master/asset-code/new"),
                    },
                  ]
                : []
            }
          />

          {/*  TABLE */}
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => {
              router.push(`/master/asset-code/${row.assetId}`);
            }}
          />
        </div>
      </HeaderWrapper>
    </>
  );
}
