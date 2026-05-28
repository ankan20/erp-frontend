"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

export default function Page() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);

  //  INITIAL LOAD
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS,
          method: "GET",
        });

        const projects = res.data || [];

        const formatted = projects.map((p, index) => ({
          id: p.id,
          sl: index + 1,
          projectcode: p.projectCode,
          customer: p.clientName,
          projectname: p.projectName,
          state: p.state,
          gstn: p.gstn,
          status:
            p.status === "ongoing"
              ? "Ongoing"
              : p.status === "hold"
                ? "Hold"
                : p.status === "completed"
                  ? "Completed"
                  : p.status,
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch projects");
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
    { header: "Project Code", accessor: "projectcode" },
    { header: "Customar Name", accessor: "customer" },
    { header: "Project Name", accessor: "projectname" },
    { header: "State", accessor: "state" },
    { header: "GSTN", accessor: "gstn" },
    { header: "Status", accessor: "status" },
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
        <div className="p-3 ">
          {/*  SEARCH SECTION */}
          <SearchSection
            onSearch={handleSearch}
            actions={[
              {
                label: "+ Add Project Code",
                onClick: () => router.push("/settings/project-code/new"),
              },
            ]}
          />

          {/*  TABLE */}
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => {
              router.push(`/settings/project-code/${row.id}`);
            }}
          />
        </div>
      </HeaderWrapper>
    </>
  );
}
