"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { toast } from "sonner";

import DataTable from "@/components/common/DataTable";
import SearchSection from "@/components/common/SearchSection";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { TYPE_LABEL } from "./NatureOfServiceSelect";

const columns = [
  { header: "Sl. No",                   accessor: "sl" },
  { header: "Supplier ID",              accessor: "supplierCode" },
  { header: "Supplier / Concern Name",  accessor: "supplierName" },
  { header: "Address",                  accessor: "address" },
  { header: "Mobile Number",            accessor: "mobileNumber" },
  { header: "Nature of Product",        accessor: "natureOfService" },
  { header: "Product Details / List",   accessor: "serviceDescriptionShort" },
];

/**
 * pageType: "materials" | "work_force" | "plant_machinery"
 * basePath: e.g. "/resource-management/contact-dairy/materials"
 * pageLabel: e.g. "Materials"
 */
export default function SupplierListPage({ pageType, basePath, pageLabel, canAdd = false }) {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  const actions = getPageActions({ router });

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.SUPPLIER.LIST,
          method: "GET",
          params: { supplierType: pageType },
        });
        const list = Array.isArray(res?.data) ? res.data : [];
        const formatted = list.map((s, i) => ({
          createdTs: s.createdTs,
          ...s,
          sl: i + 1,
          address: s.registeredAddress || s.corporateAddress || "—",
          serviceDescriptionShort: s.serviceDescription
            ? s.serviceDescription.length > 40
              ? s.serviceDescription.slice(0, 40) + "…"
              : s.serviceDescription
            : "—",
          natureOfService: Array.isArray(s.natureOfService) ? s.natureOfService.join(", ") || "—" : s.natureOfService || "—",
        }));
        setData(formatted);
        setFiltered(formatted);
      } catch (err) {
        toast.error(err?.message || "Failed to load suppliers");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [pageType]);

  const handleSearch = ({ search }) => {
    if (!search) { setFiltered(data); return; }
    const q = search.toLowerCase();
    setFiltered(
      data.filter((r) =>
        [r.supplierName, r.supplierCode, r.address, r.mobileNumber, r.natureOfService]
          .some((v) => String(v || "").toLowerCase().includes(q))
      )
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <EdoxMark size={32} />
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          actions={
            canAdd
              ? [{ label: `+ ${pageLabel} Supplier`, onClick: () => router.push(`${basePath}/new`) }]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => router.push(`${basePath}/${row.supplierId}`)}
        />
      </div>
    </HeaderWrapper>
  );
}
