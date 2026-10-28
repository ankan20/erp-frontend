"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import SearchSection    from "@/components/common/SearchSection";
import DataTable        from "@/components/common/DataTable";
import PageHeader       from "@/components/layout/PageHeader";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const fmtNum = (val) => {
  const n = Number(val);
  if (!n || isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Page() {
  const router  = useRouter();
  const access  = getPageAccess({ pageCode: "uncertified_statement", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [projectCode,  setProjectCode]  = useState("");

  useEffect(() => {
    const info = getLocalStorage("projectInfo") || {};
    setProjectCode(info?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    const fetchList = async () => {
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.UNCERTAIN_ALLOCATION.LIST}?projectCode=${projectCode}`,
          method: "GET",
        });

        const list = (res.data || []).map((r, i) => ({
          id:             r.id,
          sl:             i + 1,
          uaNo:           r.uaNo            || "",
          date:           getfmtDisplaydate(r.uaDate) || "",
          totalClaim:     fmtNum(r.totalClaim),
          totalCertified: fmtNum(r.totalCertified),
          totalDifference: fmtNum(r.totalDifference),
          workflowStatus: r.workflowStatus  || "",
          remarks:        r.remarks         || "",
        }));

        setData(list);
        setFilteredData(list);
      } catch {
        toast.error("Failed to fetch Uncertified Statement list");
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search }) => {
    if (!search) { setFilteredData(data); return; }
    setFilteredData(
      data.filter((item) =>
        Object.values(item).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase()),
        ),
      ),
    );
  };

  const columns = [
    { header: "Sl. no",       accessor: "sl",             width: "65px"  },
    { header: "UA No",        accessor: "uaNo",           width: "120px" },
    { header: "Date",         accessor: "date",           width: "110px" },
    { header: "Total Claim",  accessor: "totalClaim",     width: "140px", align: "right" },
    { header: "Certified",    accessor: "totalCertified", width: "130px", align: "right" },
    { header: "Difference",   accessor: "totalDifference",width: "130px", align: "right" },
    { header: "Status",       accessor: "workflowStatus", width: "110px" },
    { header: "Remarks",      accessor: "remarks" },
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
          actions={
            access.canAdd
              ? [{ label: "+ New Uncertified Statement", onClick: () => router.push("/project-management/customer-billing/uncertified-statement/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails) router.push(`/project-management/customer-billing/uncertified-statement/${row.id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
