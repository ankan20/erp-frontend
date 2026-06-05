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


export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "goods_received_note", pageType: "LIST" });

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
          url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.GET_ALL_GRN}?projectCode=${projectCode}`,
        });
        const list = res.data || [];
        const formatted = list.map((r, i) => ({
          id:               r.id,
          sl:               i + 1,
          grnNo:            r.grnNo            || "",
          grnDate:          getfmtDisplaydate(r.grnDate),
          _rawDate:         r.grnDate          || "",
          partyName:        r.partyName        || "",
          orderNo:          r.orderNo          || "",
          receivedCategory: r.receivedCategory || "",
          costHead:         r.costHead         || "",
          workflowStatus:   r.workflowStatus   || "",
        }));
        setData(formatted);
        setFilteredData(formatted);
      } catch {
        toast.error("Failed to load GRN list");
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
        Object.values(item).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase())
        )
      );
    }
    if (from || to) {
      filtered = filtered.filter((item) => {
        const s = String(item._rawDate || "").replace(/-/g, "");
        if (!s) return false;
        const d = s.length === 8
          ? new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`)
          : new Date(item._rawDate);
        if (isNaN(d)) return true;
        d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0,0,0,0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. No",            accessor: "sl"               },
    { header: "GRN No",            accessor: "grnNo"            },
    { header: "Date",              accessor: "grnDate"          },
    { header: "Party Name",        accessor: "partyName"        },
    { header: "Order No",          accessor: "orderNo"          },
    { header: "Received Category", accessor: "receivedCategory" },
    { header: "Cost Head",         accessor: "costHead"         },
    { header: "GRN Status",        accessor: "workflowStatus"   },
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
          showDateRange
          actions={
            access.canAdd
              ? [{ label: "+ New GRN", onClick: () => router.push("/resource-management/material/grn/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails)
              router.push(`/resource-management/material/grn/${row.id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
