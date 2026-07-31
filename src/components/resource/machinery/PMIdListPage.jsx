"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import DataTable from "@/components/common/DataTable";
import SearchSection from "@/components/common/SearchSection";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const columns = [
  { header: "Sl. No",                accessor: "sl" },
  { header: "Machine ID",            accessor: "machineId" },
  { header: "Machine Type",          accessor: "machineryType" },
  { header: "Registration Number",   accessor: "registrationNumber" },
  { header: "Registration Validity", accessor: "registrationValidity" },
  { header: "Insurance Validity",    accessor: "insuranceValidity" },
  { header: "PUC Validity",          accessor: "pucValidity" },
  { header: "Road Tax Validity",     accessor: "roadTaxValidity" },
];

export default function PMIdListPage({ canAdd = false }) {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  const actions = getPageActions({ router });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiRequest({ url: API_ENDPOINTS.RESOURCE.MACHINERY.PM_ID.LIST, method: "GET" });
        const list = Array.isArray(res?.data) ? res.data : [];
        const formatted = list.map((r, i) => ({
          ...r,
          sl: i + 1,
          machineId:            r.machineId            || r.pmUid || "",
          machineryType:        r.machineryType        || "-",
          registrationNumber:   r.registrationNumber   || "-",
          registrationValidity: getfmtDisplaydate(r.registrationValidity || r.registrationDate),
          insuranceValidity:    getfmtDisplaydate(r.insuranceValidity    || r.insuranceDate),
          pucValidity:          getfmtDisplaydate(r.pucValidity          || r.pucDate),
          roadTaxValidity:      getfmtDisplaydate(r.roadTaxValidity      || r.roadTaxDate),
        }));
        setData(formatted);
        setFiltered(formatted);
      } catch {
        toast.error("Failed to load P&M ID list");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSearch = ({ search, from, to }) => {
    let result = data;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        [r.machineId, r.machineryType, r.registrationNumber].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      );
    }
    setFiltered(result);
  };

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
          showDateRange={false}
          actions={
            canAdd
              ? [{ label: "+ Machinery ID", onClick: () => router.push("/resource-management/services/plant-machinery/pm-inventory/pm-id/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => router.push(`/resource-management/services/plant-machinery/pm-inventory/pm-id/${row.id}`)}
        />
      </div>
    </HeaderWrapper>
  );
}
