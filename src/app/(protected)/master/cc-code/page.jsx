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

  const actions = getPageActions({
    router,
  });

  //  INITIAL LOAD
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE,
          method: "GET",
        });

        const respdata = res.data || [];

        const formatted = respdata.map((c, index) => ({
          ccId: c.ccId,
          sl: index + 1,
          ccCategoryName: c.ccCategoryName,
          ccCode: c.ccCode,
          ccGroupName: c.ccGroupName,
          ccName: c.ccName,
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch CC Code data");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
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
    { header: "CC Code", accessor: "ccCode" },
    { header: "CC Name", accessor: "ccName" },
    { header: "Category", accessor: "ccCategoryName" },
    { header: "Group", accessor: "ccGroupName" },
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
            actions={
              canEdit ?
              [
              {
                label: "+ New CC Code",
                onClick: () => router.push("/master/cc-code/new"),
              },
            ]:[]}
          />

          {/*  TABLE */}
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => {
              router.push(`/master/cc-code/${row.ccId}`);
            }}
          />
        </div>
      </HeaderWrapper>
    </>
  );
}
