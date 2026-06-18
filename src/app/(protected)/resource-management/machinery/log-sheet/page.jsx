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

const LE = API_ENDPOINTS.RESOURCE.MACHINERY.LOG_ENTRY;

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "log_sheet", pageType: "LIST" });

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
          url: `${LE.LIST}?projectCode=${projectCode}`,
          method: "GET",
        });

        const list = res.data || [];
        const formatted = list.map((r, index) => ({
          sl:             index + 1,
          logBookId:      r.logBookId,
          entryId:        r.entryId || r.id,
          logBookNo:      r.logBookNo      || "",
          logUid:         r.logUid         || "",
          runningDate:    r.runningDate    || "",
          partyName:      r.partyName      || "",
          machineryName:  r.machineryName  || "",
          machineryRegNo: r.machineryRegNo || "",
          runningStartTime: r.runningStartTime || "",
          runningFinishTime : r.runningFinishTime || "",
          workflowStatus: r.workflowStatus || "",
          //will add more details
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch {
        toast.error("Failed to fetch Log Sheet list");
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
        if (!item.runningDate) return false;
        const d = new Date(item.runningDate);
        d.setHours(0, 0, 0, 0);
        if (from) {
          const f = new Date(from); f.setHours(0, 0, 0, 0);
          if (d < f) return false;
        }
        if (to) {
          const t = new Date(to); t.setHours(0, 0, 0, 0);
          if (d > t) return false;
        }
        return true;
      });
    }

    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. No",          accessor: "sl",             width: "65px" },
    {
      header: "Log Book No",
      accessor: "logBookNo",
      width: "160px",
      render: (row) =>
        row.logBookNo ? (
          <span
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (row.logBookId) router.push(`/resource-management/machinery/log-sheet/log-book/${row.logBookId}`);
            }}
          >
            {row.logBookNo}
          </span>
        ) : "-",
    },
    {
      header: "Log UID",
      accessor: "logUid",
      width: "160px",
      render: (row) =>
        row.logUid ? (
          <span
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (row.entryId) router.push(`/resource-management/machinery/log-sheet/log-entry/${row.entryId}`);
            }}
          >
            {row.logUid}
          </span>
        ) : "-",
    },
    { header: "Running Date",    accessor: "runningDate"    },
    { header: "Party Name",      accessor: "partyName"      },
    { header: "Machinery Name",  accessor: "machineryName"  },
    { header: "Reg. Number",     accessor: "machineryRegNo" },
    { header: "Status",          accessor: "workflowStatus" },
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
          actions={[
            {
              label: "View Report",
              onClick: () => toast.info("Report feature coming soon"),
              variant: "outline",
            },
            ...(access.canAdd
              ? [
                  {
                    label: "+ Create Log Book",
                    onClick: () => router.push("/resource-management/machinery/log-sheet/log-book/new"),
                  },
                  {
                    label: "+ Log Book Data Entry",
                    onClick: () => router.push("/resource-management/machinery/log-sheet/log-entry/new"),
                  },
                ]
              : []),
          ]}
        />

        <DataTable columns={columns} data={filteredData} />
      </div>
    </HeaderWrapper>
  );
}
