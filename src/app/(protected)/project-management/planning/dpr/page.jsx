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
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

import { DPR_BASE as BASE, todayIST, useProjectCode } from "@/lib/dpr";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "daily_progress_report", pageType: "LIST" });

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const projectCode = useProjectCode();

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    apiRequest({ url: `${API_ENDPOINTS.PROJECT.DPR.LIST}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => {
        const rows = (res.data || []).map((r, i) => ({
          sl: i + 1,
          reportDate: r.reportDate,
          dateLabel: getfmtDisplaydate(r.reportDate) || r.reportDate,
          dprNo: r.dprNo || "—",
          photos: r.photosWaitingForAi ? `${r.photoCount} (${r.photosWaitingForAi} reading…)` : String(r.photoCount),
          manpower: r.manpowerTotal != null ? String(r.manpowerTotal) : "",
          summary: r.summary ? (r.summary.length > 120 ? `${r.summary.slice(0, 120)}…` : r.summary) : "",
          workflowStatus: r.workflowStatus || "",
        }));
        setData(rows);
        setFilteredData(rows);
      })
      .catch(() => toast.error("Failed to fetch Daily Progress Reports"))
      .finally(() => setLoading(false));
  }, [projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = ({ search, from, to }) => {
    let list = [...data];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(s)));
    }
    if (from) list = list.filter((r) => r.reportDate >= from);
    if (to) list = list.filter((r) => r.reportDate <= to);
    setFilteredData(list);
  };

  const columns = [
    { header: "Sl. No", accessor: "sl" },
    { header: "Date", accessor: "dateLabel" },
    { header: "DPR No", accessor: "dprNo" },
    { header: "Photos", accessor: "photos" },
    { header: "Manpower", accessor: "manpower" },
    { header: "Summary", accessor: "summary" },
    { header: "Status", accessor: "workflowStatus" },
  ];

  const actions = getPageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;

  if (loading && projectCode) {
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
              ? [{ label: "+ Today's Photos & Report", onClick: () => router.push(`${BASE}/${todayIST()}`) }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => access.canOpenDetails && router.push(`${BASE}/${row.reportDate}`)}
        />
      </div>
    </HeaderWrapper>
  );
}
