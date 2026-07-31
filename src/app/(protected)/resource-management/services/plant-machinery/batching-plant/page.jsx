"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import DataTable from "@/components/common/DataTable";
import SearchSection from "@/components/common/SearchSection";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const BP = API_ENDPOINTS.RESOURCE.BATCHING_PLANT;

const columns = [
  { header: "Sl. No",           accessor: "sl",              width: "65px" },
  { header: "Despatch No",      accessor: "despatchNo" },
  { header: "Production Date",  accessor: "productionDateFmt" },
  { header: "Type of Materials",accessor: "materialType" },
  { header: "Grade",            accessor: "grade" },
  { header: "Unit",             accessor: "unitOfConcrete" },
  { header: "Volume",           accessor: "volume" },
  { header: "Supplier Name",    accessor: "vendorName" },
  { header: "Vehicle No",       accessor: "vehicleNumber" },
  { header: "Requisition By",   accessor: "requisitionBy" },
  { header: "Status",           accessor: "workflowStatus" },
];

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "batching_plant", pageType: "LIST" });

  const [data,     setData]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!access.allowed) return;
    const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

    const fetchList = async () => {
      try {
        const res = await apiRequest({
          url: `${BP.LIST}?projectCode=${projectCode}`,
          method: "GET",
        });
        const list = Array.isArray(res?.data) ? res.data : [];
        const formatted = list.map((r, i) => ({
          ...r,
          sl:               i + 1,
          despatchNo:       r.despatchNo       || "-",
          productionDateFmt: getfmtDisplaydate(r.productionDate),
          materialType:     r.materialType     || "-",
          grade:            r.grade            || "-",
          unitOfConcrete:   r.unitOfConcrete   || "-",
          volume:           r.volumeOfConcrete != null ? String(r.volumeOfConcrete) : "-",
          vendorName:       r.vendorName       || "-",
          vehicleNumber:    r.vehicleNumber    || "-",
          requisitionBy:    r.requisitionBy    || "-",
          workflowStatus:   r.workflowStatus   || "-",
        }));
        setData(formatted);
        setFiltered(formatted);
      } catch {
        toast.error("Failed to load Batching Plant list");
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let result = data;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        [r.despatchNo, r.materialType, r.grade, r.vendorName, r.vehicleNumber, r.workflowStatus].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      );
    }
    if (from || to) {
      result = result.filter((r) => {
        if (!r.productionDate) return false;
        const d = new Date(r.productionDate); d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0, 0, 0, 0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0, 0, 0, 0); if (d > t) return false; }
        return true;
      });
    }
    setFiltered(result);
  };

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
              ? [{ label: "+ Create Docket", onClick: () => router.push("/resource-management/services/plant-machinery/batching-plant/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => router.push(`/resource-management/services/plant-machinery/batching-plant/${row.id}`)}
        />
      </div>
    </HeaderWrapper>
  );
}
