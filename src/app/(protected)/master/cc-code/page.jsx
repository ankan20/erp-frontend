"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";

function ExpandableHeader({ label, expanded, onToggle }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {label}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="shrink-0 opacity-70 hover:opacity-100 text-white"
        title={expanded ? "Collapse" : "Expand sub groups"}
      >
        {expanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
      </button>
    </span>
  );
}

export default function Page() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const canEdit = isMasterEditable();

  // Column-level expand toggles (expand all rows at once)
  const [bsExpanded, setBsExpanded] = useState(false);
  const [plExpanded, setPlExpanded] = useState(false);

  const actions = getPageActions({ router });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE,
          method: "GET",
        });

        const respdata = res.data || [];

        const formatted = respdata.map((c, index) => {
          const bsLevels = c.ccSubGroupLevels || [];
          const plLevels = c.plSubGroupLevels || [];
          return {
            ccId:           c.ccId,
            sl:             index + 1,
            ccCode:         c.ccCode,
            ccName:         c.ccName,
            ccCategoryName: c.ccCategoryName,
            headUnder:      c.headUnder,
            // BS — flat fields for each level
            bsGroup:  c.ccGroupName  || "—",
            bsLevel0: bsLevels[0]?.subGroupName || "—",
            bsLevel1: bsLevels[1]?.subGroupName || "—",
            bsLevel2: bsLevels[2]?.subGroupName || "—",
            // PL — flat fields
            plGroup:  c.plLinked ? (c.plGroupName || "—") : "—",
            plLevel0: c.plLinked ? (plLevels[0]?.subGroupName || "—") : "—",
            plLevel1: c.plLinked ? (plLevels[1]?.subGroupName || "—") : "—",
            plLevel2: c.plLinked ? (plLevels[2]?.subGroupName || "—") : "—",
          };
        });

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch CC Code data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = ({ search }) => {
    if (!search) {
      setFilteredData(data);
      return;
    }
    const q = search.toLowerCase();
    const filtered = data.filter((item) =>
      [item.ccCode, item.ccName, item.ccCategoryName, item.headUnder,
       item.bsGroup, item.bsPath, item.plGroup, item.plPath]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
    setFilteredData(filtered);
  };

  const bsCols = bsExpanded
    ? [
        { header: <ExpandableHeader label="BS Group" expanded={bsExpanded} onToggle={() => setBsExpanded(false)} />, accessor: "bsGroup" },
        { header: "Sub Group",   accessor: "bsLevel0" },
        { header: "Sub Group 1", accessor: "bsLevel1" },
        { header: "Sub Group 2", accessor: "bsLevel2" },
      ]
    : [{ header: <ExpandableHeader label="Balance Sheet" expanded={bsExpanded} onToggle={() => setBsExpanded(true)} />, accessor: "bsGroup" }];

  const plCols = plExpanded
    ? [
        { header: <ExpandableHeader label="P&L Group" expanded={plExpanded} onToggle={() => setPlExpanded(false)} />, accessor: "plGroup" },
        { header: "Sub Group",   accessor: "plLevel0" },
        { header: "Sub Group 1", accessor: "plLevel1" },
        { header: "Sub Group 2", accessor: "plLevel2" },
      ]
    : [{ header: <ExpandableHeader label="Profit & Loss" expanded={plExpanded} onToggle={() => setPlExpanded(true)} />, accessor: "plGroup" }];

  const columns = [
    { header: "Sl. no",   accessor: "sl" },
    { header: "CC Code",  accessor: "ccCode" },
    { header: "CC Name",  accessor: "ccName" },
    { header: "Category", accessor: "ccCategoryName" },
    { header: "Head",     accessor: "headUnder" },
    ...bsCols,
    ...plCols,
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <div className="p-3">
          <SearchSection
            onSearch={handleSearch}
            actions={
              canEdit
                ? [{ label: "+ New CC Code", onClick: () => router.push("/master/cc-code/new") }]
                : []
            }
          />
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => router.push(`/master/cc-code/${row.ccId}`)}
          />
        </div>
      </HeaderWrapper>
    </>
  );
}
