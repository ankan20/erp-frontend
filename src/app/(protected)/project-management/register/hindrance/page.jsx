"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import SearchSection  from "@/components/common/SearchSection";
import DataTable      from "@/components/common/DataTable";
import PageHeader     from "@/components/layout/PageHeader";
import HeaderWrapper  from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "hindrance_register", pageType: "LIST" });

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
          url:    `${API_ENDPOINTS.PROJECT.REGISTER.HINDRANCE_REGISTER.LIST}?projectCode=${projectCode}`,
          method: "GET",
        });

        const list = res.data || [];

        const formatted = list.map((r, index) => ({
          id:                  r.id,
          sl:                  index + 1,
          hindranceNo:         r.hindranceNo         || "",
          hindranceDate:       getfmtDisplaydate(r.hindranceDate) || "",
          titleOfHindrance:    r.titleOfHindrance    || "",
          totalEffectedAmount: r.totalEffectedAmount != null ? String(r.totalEffectedAmount) : "",
          intimationTo:        r.intimationTo        || "",
          workflowStatus:      r.workflowStatus      || "",
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch {
        toast.error("Failed to fetch Hindrance Register list");
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
        if (!item.hindranceDate) return false;
        const d = new Date(item.hindranceDate);
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
    { header: "Sl. No",               accessor: "sl"                  },
    { header: "Hindrance No",          accessor: "hindranceNo"         },
    { header: "Hindrance Date",        accessor: "hindranceDate"       },
    { header: "Title of Hindrance",    accessor: "titleOfHindrance"    },
    { header: "Total Effected Amt",    accessor: "totalEffectedAmount" },
    { header: "Intimation To",         accessor: "intimationTo"        },
    { header: "Status",                accessor: "workflowStatus"      },
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
                    label:   "+ New Hindrance",
                    onClick: () => router.push("/project-management/register/hindrance/new"),
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
              router.push(`/project-management/register/hindrance/${row.id}`);
            }
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
