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

import AssetStatusBadge from "@/components/assetmanagement/asset-register/components/AssetStatusBadge";
import { MOCK_ASSETS }  from "@/components/assetmanagement/asset-register/mockData";

const formatCurrency = (v) =>
  v != null ? `₹ ${Number(v).toLocaleString("en-IN")}` : "—";

const buildRows = (list) =>
  list.map((a, i) => ({
    id:             a.id,
    sl:             i + 1,
    assetId:        a.assetId,
    assetName:      a.assetName,
    category:       a.category,
    trackingType:   a.trackingType === "batch" ? `Batch (${a.batchQty})` : "Individual",
    serialNo:       a.serialNo || (a.batchQty ? `${a.batchQty} units` : "—"),
    location:       a.location,
    assignedTo:     a.assignedTo,
    purchaseDate:   a.purchaseDate,
    purchaseValue:  formatCurrency(a.purchaseValue),
    status:         a.status,
    _rawStatus:     a.status,
  }));

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_asset_register", pageType: "LIST" });

  const [allRows]       = useState(buildRows(MOCK_ASSETS));
  const [filteredRows, setFilteredRows] = useState(buildRows(MOCK_ASSETS));

  const handleSearch = ({ search, from, to }) => {
    let rows = [...allRows];
    if (search) {
      rows = rows.filter((r) =>
        Object.values(r).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase())
        )
      );
    }
    setFilteredRows(rows);
  };

  const columns = [
    { header: "Sl. No",         accessor: "sl",           width: "60px" },
    { header: "Asset ID",       accessor: "assetId",      width: "140px" },
    { header: "Asset Name",     accessor: "assetName" },
    { header: "Category",       accessor: "category",     width: "170px" },
    { header: "Tracking",       accessor: "trackingType", width: "120px" },
    { header: "Serial / Units", accessor: "serialNo",     width: "130px" },
    { header: "Location",       accessor: "location",     width: "160px" },
    { header: "Assigned To",    accessor: "assignedTo",   width: "140px" },
    { header: "Purchase Date",  accessor: "purchaseDate", width: "120px" },
    { header: "Value",          accessor: "purchaseValue",width: "120px" },
    {
      header: "Status",
      accessor: "status",
      width: "130px",
      render: (row) => <AssetStatusBadge status={row._rawStatus} />,
    },
  ];

  const actions = getPageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          actions={
            access.canAdd || access.canEdit
              ? [{ label: "+ Register Asset", onClick: () => router.push("/asset-management/asset-register/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredRows}
          onRowClick={(row) => {
            if (access.canOpenDetails)
              router.push(`/asset-management/asset-register/${row.id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
