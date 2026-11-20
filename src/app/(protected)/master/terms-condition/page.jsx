"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { toast } from "sonner";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { TERMS_MODULES, TERMS_SUB_MODULES, TERMS_TYPES } from "@/config/terms.config";

const TC = API_ENDPOINTS.MASTER.TERM;

const moduleLabel  = (v) => TERMS_MODULES.find((m) => m.value === v)?.label || v || "—";
const subLabel     = (mod, v) => (TERMS_SUB_MODULES[mod] || []).find((s) => s.value === v)?.label || v || "—";
const typeLabel    = (v) => TERMS_TYPES.find((t) => t.value === v)?.label || v || "—";

export default function Page() {
  const router  = useRouter();
  const canEdit = isMasterEditable();
  const actions = getPageActions({ router });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const fetchList = async () => {
      try {
        let list;
          const res = await apiRequest({ url: TC.LIST, method: "GET" });
          list = res.data || [];

        const mapped = list.map((item, idx) => ({
          termId:    item.termId,
          sl:        idx + 1,
          module:    moduleLabel(item.module),
          subModule: subLabel(item.module, item.subModule),
          termType:  typeLabel(item.termType),
          titles:    (item.termGroups || []).map((g) => g.title).filter(Boolean).join(" / ") || "—",
        }));

        setData(mapped);
        setFilteredData(mapped);
      } catch (err) {
        toast.error(err.message || "Failed to load terms");
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  const handleSearch = ({ search }) => {
    if (!search) { setFilteredData(data); return; }
    const q = search.toLowerCase();
    setFilteredData(
      data.filter((item) =>
        Object.values(item).some((val) => String(val).toLowerCase().includes(q))
      )
    );
  };

  const columns = [
    { header: "Sl. No",        accessor: "sl" },
    { header: "Module",        accessor: "module" },
    { header: "Sub Module",    accessor: "subModule" },
    { header: "Type",          accessor: "termType" },
    { header: "Title(s)",      accessor: "titles" },
  ];

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
            canEdit
              ? [{ label: "+ Create Terms", onClick: () => router.push("/master/terms-condition/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => router.push(`/master/terms-condition/${row.termId}`)}
        />
      </div>
    </HeaderWrapper>
  );
}
