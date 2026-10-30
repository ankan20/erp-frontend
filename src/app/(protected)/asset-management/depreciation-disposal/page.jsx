"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import SearchSection    from "@/components/common/SearchSection";
import DataTable        from "@/components/common/DataTable";
import PageHeader       from "@/components/layout/PageHeader";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { AmStatusBadge }   from "@/components/assetmanagement/shared/AmFormHelpers";
import { getDepreciationSummary } from "@/components/assetmanagement/depreciation-disposal/mockData";

const fmtCur = (v) => v ? `₹ ${Number(v).toLocaleString("en-IN")}` : "—";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_depreciation_disposal", pageType: "LIST", defaultToAllowed: true });
  const summaries = useMemo(() => getDepreciationSummary(), []);

  const allRows = summaries.map((s, i) => ({
    id: s.id, sl: i + 1,
    assetId: s.assetId,
    assetName: s.assetName,
    category: s.category,
    purchaseDate: s.purchaseDate,
    method: `${s.depreciationMethod} (${s.depreciationRate}%)`,
    currentYearDep: fmtCur(s.currentYearDep),
    accDepreciation: fmtCur(s.accDepreciation),
    netBookValue: fmtCur(s.netBookValue),
    status: s.status, _rawStatus: s.status,
  }));

  const [filteredRows, setFilteredRows] = useState(allRows);

  const columns = [
    { header: "Sl",           accessor: "sl",             width: "55px" },
    { header: "Asset ID",     accessor: "assetId",        width: "120px" },
    { header: "Asset Name",   accessor: "assetName" },
    { header: "Category",     accessor: "category",       width: "150px" },
    { header: "Purchase Date",accessor: "purchaseDate",   width: "115px" },
    { header: "Method / Rate",accessor: "method",         width: "130px" },
    { header: "Curr. Yr Dep.",accessor: "currentYearDep", width: "120px" },
    { header: "Acc. Dep.",    accessor: "accDepreciation",width: "120px" },
    { header: "Net Book Val.",accessor: "netBookValue",   width: "120px" },
    { header: "Status",       accessor: "status",         width: "110px", render: (row) => <AmStatusBadge status={row._rawStatus} /> },
  ];

  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <div className="p-3">
        <SearchSection
          onSearch={({ search }) => setFilteredRows(search
            ? allRows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(search.toLowerCase())))
            : allRows)}
          actions={access.canAdd ? [
            { label: "+ Disposal Requests", onClick: () => router.push("/asset-management/disposal-requests") },
          ] : []}
        />
        <DataTable columns={columns} data={filteredRows}
          onRowClick={(row) => { if (access.canOpenDetails) router.push(`/asset-management/depreciation-disposal/${row.id}`); }} />
      </div>
    </HeaderWrapper>
  );
}
