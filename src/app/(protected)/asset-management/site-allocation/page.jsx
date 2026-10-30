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
import { MOCK_ALLOCATIONS } from "@/components/assetmanagement/site-allocation-transfer/mockData";

const TYPE_LABEL = { allocation: "New Allocation", transfer: "Transfer", return: "Return to Base" };

const buildRows = (list) =>
  list.map((r, i) => ({
    id: r.id, sl: i + 1,
    docNo: r.docNo,
    txnDate: r.txnDate,
    type: TYPE_LABEL[r.type] || r.type,
    assetId: r.assetId,
    assetName: r.assetName,
    fromLocation: r.fromLocation || "—",
    toLocation: r.toLocation,
    toCustodian: r.toCustodian || "—",
    requestedBy: r.requestedBy,
    status: r.status,
    _rawStatus: r.status,
  }));

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_site_allocation", pageType: "LIST", defaultToAllowed: true });

  const [allRows]        = useState(buildRows(MOCK_ALLOCATIONS));
  const [filteredRows, setFilteredRows] = useState(buildRows(MOCK_ALLOCATIONS));

  const handleSearch = ({ search }) => {
    setFilteredRows(
      search
        ? allRows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(search.toLowerCase())))
        : allRows
    );
  };

  const columns = [
    { header: "Sl",           accessor: "sl",          width: "55px" },
    { header: "Doc No",       accessor: "docNo",       width: "130px" },
    { header: "Date",         accessor: "txnDate",     width: "110px" },
    { header: "Type",         accessor: "type",        width: "140px" },
    { header: "Asset ID",     accessor: "assetId",     width: "130px" },
    { header: "Asset Name",   accessor: "assetName" },
    { header: "From",         accessor: "fromLocation",width: "150px" },
    { header: "To",           accessor: "toLocation",  width: "150px" },
    { header: "Receiver",     accessor: "toCustodian", width: "130px" },
    { header: "Requested By", accessor: "requestedBy", width: "130px" },
    { header: "Status",       accessor: "status", width: "120px",
      render: (row) => <AmStatusBadge status={row._rawStatus} /> },
  ];

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <div className="p-3">
        <SearchSection onSearch={handleSearch}
          actions={access.canAdd ? [{ label: "+ New Request", onClick: () => router.push("/asset-management/site-allocation/new") }] : []}
        />
        <DataTable columns={columns} data={filteredRows}
          onRowClick={(row) => { if (access.canOpenDetails) router.push(`/asset-management/site-allocation/${row.id}`); }}
        />
      </div>
    </HeaderWrapper>
  );
}
