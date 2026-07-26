"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import DataTable from "@/components/common/DataTable";
import SearchSection from "@/components/common/SearchSection";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

const columns = [
  { header: "Sl. No",        accessor: "sl" },
  { header: "DLR No",        accessor: "dlrNo" },
  { header: "DLR Date",      accessor: "dlrDate" },
  { header: "Supplier Name", accessor: "vendorName" },
  { header: "Report By",     accessor: "reportBy" },
  { header: "Status",        accessor: "status" },
];

export default function DLRListPage({ canAdd = false }) {
  const router = useRouter();
  const [data,     setData]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res  = await apiRequest({ url: API_ENDPOINTS.RESOURCE.MANPOWER.DLR.LIST, method: "GET" });
        const list = Array.isArray(res?.data) ? res.data : [];
        const formatted = list.map((w, i) => ({
          ...w,
          sl:         i + 1,
          vendorName: w.vendorName || "—",
          reportBy:   w.reportBy  || "—",
          status:     w.workflowStatus || "—",
        }));
        setData(formatted);
        setFiltered(formatted);
      } catch (err) {
        toast.error(err?.message || "Failed to load DLR list");
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
        [r.dlrNo, r.vendorName, r.reportBy, r.status]
          .some((v) => String(v || "").toLowerCase().includes(q))
      );
    }

    if (from || to) {
      result = result.filter((r) => {
        const d = r.dlrDate && r.dlrDate !== "—" ? r.dlrDate : null;
        if (!d) return false;
        if (from && d < from) return false;
        if (to   && d > to)   return false;
        return true;
      });
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
    <div className="p-3">
      <SearchSection
        onSearch={handleSearch}
        showDateRange
        actions={
          canAdd
            ? [{ label: "+ Add DLR", onClick: () => router.push("/resource-management/services/manpower/dlr/new") }]
            : []
        }
      />
      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/resource-management/services/manpower/dlr/${row.id}`)}
      />
    </div>
  );
}
