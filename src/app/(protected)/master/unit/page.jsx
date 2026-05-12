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
    const fetchUnits = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.GET_ALL_UNIT,
          method: "GET",
        });

        const units = res.data || [];

        const formatted = units.map((p, index) => ({
          unitId: p.unitId,
          sl: index + 1,
          unitName: p.unitName,
          shortName: p.shortName,
          unitType: p.unitType,
          parentUnitName: p.parentUnitName || "N/A",
          parentUnitMultiplyFactor: p.parentUnitMultiplyFactor,
          categoryName: p.categoryName,
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch unit deatils.");
      } finally {
        setLoading(false);
      }
    };

    fetchUnits();
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
    { header: "Unit Name", accessor: "unitName" },
    { header: "Short Name", accessor: "shortName" },
    { header: "Unit Type", accessor: "unitType" },
    { header: "Parent Unit", accessor: "parentUnitName" },
    { header: "Multiply Factor", accessor: "parentUnitMultiplyFactor" },
    { header: "Unit Category", accessor: "categoryName" },
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
                label: "+ New Unit",
                onClick: () => router.push("/master/unit/new"),
              },
            ]}
          />

          {/*  TABLE */}
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => {
              router.push(`/master/unit/${row.unitId}`);
            }}
          />
        </div>
      </HeaderWrapper>
    </>
  );
}
