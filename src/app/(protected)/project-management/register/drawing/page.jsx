"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "drawing_register", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [projectCode,  setProjectCode]  = useState("");

  useEffect(() => {
    const projectInfo = getLocalStorage("projectInfo") || {};
    setProjectCode(projectInfo?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    const fetchList = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.PROJECT.REGISTER.DRAWING_REGISTER.GET_ALL_DRAWING_REGISTER}?projectCode=${projectCode}`,
          method: "GET",
        });

        const list = res.data || [];

        const formatted = list.map((r, index) => ({
          id:             r.id,
          sl:             index + 1,
          drNo:           r.drNo           || "",
          drawingNo:      r.drawingNo      || "",
          revision:       r.revision       || "",
          drawingTitle:   r.drawingTitle   || "",
          receivedDate:   getfmtDisplaydate(r.receivedDate) || "",
          receivedBy:     r.receivedBy     || "",
          workflowStatus: r.workflowStatus || "",
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch {
        toast.error("Failed to fetch Drawing Register list");
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [projectCode]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];

    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase()),
        ),
      );
    }

    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.receivedDate) return false;
        const d = new Date(item.receivedDate);
        d.setHours(0, 0, 0, 0);
        if (from) {
          const f = new Date(from);
          f.setHours(0, 0, 0, 0);
          if (d < f) return false;
        }
        if (to) {
          const t = new Date(to);
          t.setHours(0, 0, 0, 0);
          if (d > t) return false;
        }
        return true;
      });
    }

    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. No",        accessor: "sl"             },
    { header: "DR No",         accessor: "drNo"           },
    { header: "Drawing No",    accessor: "drawingNo"      },
    { header: "Revision",          accessor: "revision"       },
    { header: "Drawing Title", accessor: "drawingTitle"   },
    { header: "Received Date", accessor: "receivedDate"   },
    { header: "Received By",   accessor: "receivedBy"     },
    { header: "Status",        accessor: "workflowStatus" },
  ];

  const actions = getPageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          showDateRange={true}
          actions={
            access.canAdd
              ? [
                  {
                    label: "+ Drawing Received",
                    onClick: () =>
                      router.push(
                        "/project-management/register/drawing/new",
                      ),
                  },
                ]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails) {
              router.push(
                `/project-management/register/drawing/${row.id}`,
              );
            }
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
