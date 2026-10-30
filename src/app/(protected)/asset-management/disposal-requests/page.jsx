"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection    from "@/components/common/SearchSection";
import DataTable        from "@/components/common/DataTable";
import PageHeader       from "@/components/layout/PageHeader";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { AmStatusBadge }   from "@/components/assetmanagement/shared/AmFormHelpers";
import { MOCK_DISPOSALS, DISPOSAL_TYPES } from "@/components/assetmanagement/depreciation-disposal/mockData";

const fmtCur = (v) => v ? `₹ ${Number(v).toLocaleString("en-IN")}` : "—";
const typeLabel = (v) => DISPOSAL_TYPES.find((d) => d.value === v)?.label || v;

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_depreciation_disposal", pageType: "LIST", defaultToAllowed: true });

  const allRows = MOCK_DISPOSALS.map((d, i) => ({
    id: d.id, sl: i + 1,
    docNo: d.docNo,
    assetId: d.assetId,
    assetName: d.assetName,
    disposalType: typeLabel(d.disposalType),
    requestDate: d.requestDate,
    bookValue: fmtCur(d.bookValue),
    saleProceeds: d.saleProceeds ? fmtCur(d.saleProceeds) : "—",
    requestedBy: d.requestedBy,
    status: d.status, _rawStatus: d.status,
  }));

  const [filteredRows, setFilteredRows] = useState(allRows);

  const columns = [
    { header: "Sl",          accessor: "sl",           width: "55px" },
    { header: "Doc No",      accessor: "docNo",        width: "125px" },
    { header: "Asset ID",    accessor: "assetId",      width: "115px" },
    { header: "Asset Name",  accessor: "assetName" },
    { header: "Type",        accessor: "disposalType", width: "130px" },
    { header: "Req. Date",   accessor: "requestDate",  width: "105px" },
    { header: "Book Value",  accessor: "bookValue",    width: "115px" },
    { header: "Proceeds",    accessor: "saleProceeds", width: "115px" },
    { header: "Requested By",accessor: "requestedBy",  width: "140px" },
    { header: "Status",      accessor: "status",       width: "115px", render: (row) => <AmStatusBadge status={row._rawStatus} /> },
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
            { label: "+ New Disposal Request", onClick: () => router.push("/asset-management/disposal-requests/new") },
          ] : []}
        />
        <DataTable columns={columns} data={filteredRows}
          onRowClick={(row) => { if (access.canOpenDetails) router.push(`/asset-management/disposal-requests/${row.id}`); }} />
      </div>
    </HeaderWrapper>
  );
}
