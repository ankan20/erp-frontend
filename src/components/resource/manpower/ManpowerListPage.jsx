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

const columns = [
  { header: "Sl. No",         accessor: "sl" },
  { header: "Man ID",         accessor: "manId" },
  { header: "Worker Name",    accessor: "fullName" },
  { header: "Category",       accessor: "categoryDisplay" },
  { header: "Vendor Name",    accessor: "vendorName" },
  { header: "Rate / Manday",  accessor: "ratePerMandayDisplay" },
  { header: "Date of Joining", accessor: "dateOfJoining" },
  { header: "Status",         accessor: "status" },
];

export default function ManpowerListPage({ canAdd = false }) {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  const actions = getPageActions({ router });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiRequest({ url: API_ENDPOINTS.RESOURCE.MANPOWER.LABOUR_ID.LIST, method: "GET" });
        const list = Array.isArray(res?.data) ? res.data : [];
        const formatted = list.map((w, i) => ({
          ...w,
          sl: i + 1,
          ratePerMandayDisplay: w.ratePerManday != null ? `₹ ${Number(w.ratePerManday).toLocaleString("en-IN")}` : "—",
          vendorName: w.vendorName || "—",
          categoryDisplay: w.categoryDisplay || w.category || "—",
          dateOfJoining: w.dateOfJoining || "—",
        }));
        setData(formatted);
        setFiltered(formatted);
      } catch (err) {
        toast.error(err?.message || "Failed to load workers");
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
        [r.manId, r.fullName, r.categoryDisplay, r.vendorName, r.status]
          .some((v) => String(v || "").toLowerCase().includes(q))
      );
    }

    if (from || to) {
      result = result.filter((r) => {
        const doj = r.dateOfJoining && r.dateOfJoining !== "—" ? r.dateOfJoining : null;
        if (!doj) return false;
        if (from && doj < from) return false;
        if (to && doj > to) return false;
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
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          showDateRange
          actions={
            canAdd
              ? [{ label: "+ Add Labour / Manpower", onClick: () => router.push("/resource-management/services/manpower/labour-id/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => router.push(`/resource-management/services/manpower/labour-id/${row.id}`)}
        />
      </div>
    </HeaderWrapper>
  );
}
