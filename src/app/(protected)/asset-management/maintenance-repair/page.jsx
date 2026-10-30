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
import { MOCK_MAINTENANCE } from "@/components/assetmanagement/maintenance-repair/mockData";

const TYPE_LABEL = { preventive: "Preventive", breakdown: "Breakdown", annual: "Annual Overhaul", amc: "AMC", inspection: "Inspection" };
const PRI_CLS = { low: "text-gray-500", medium: "text-blue-600", high: "text-orange-600 font-semibold", critical: "text-red-600 font-bold" };

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_maintenance_repair", pageType: "LIST", defaultToAllowed: true });

  const allRows = MOCK_MAINTENANCE.map((r, i) => ({
    id: r.id, sl: i + 1,
    docNo: r.docNo, reportedDate: r.reportedDate,
    type: TYPE_LABEL[r.type] || r.type,
    priority: r.priority,
    assetId: r.assetId, assetName: r.assetName,
    vendor: r.vendorName || "—",
    scheduledDate: r.scheduledDate || "—",
    totalCost: r.totalCost ? `₹ ${Number(r.totalCost).toLocaleString("en-IN")}` : "—",
    status: r.status, _rawStatus: r.status,
  }));

  const [filteredRows, setFilteredRows] = useState(allRows);

  const columns = [
    { header: "Sl",         accessor: "sl",          width: "55px" },
    { header: "Doc No",     accessor: "docNo",       width: "130px" },
    { header: "Date",       accessor: "reportedDate",width: "110px" },
    { header: "Type",       accessor: "type",        width: "145px" },
    { header: "Priority",   accessor: "priority",    width: "90px",
      render: (row) => <span className={`text-[12px] capitalize ${PRI_CLS[row.priority] || ""}`}>{row.priority}</span> },
    { header: "Asset ID",   accessor: "assetId",     width: "130px" },
    { header: "Asset Name", accessor: "assetName" },
    { header: "Vendor",     accessor: "vendor",      width: "180px" },
    { header: "Scheduled",  accessor: "scheduledDate",width: "110px" },
    { header: "Cost",       accessor: "totalCost",   width: "110px" },
    { header: "Status",     accessor: "status", width: "120px",
      render: (row) => <AmStatusBadge status={row._rawStatus} /> },
  ];

  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <div className="p-3">
        <SearchSection onSearch={({ search }) => setFilteredRows(search ? allRows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))) : allRows)}
          actions={access.canAdd ? [{ label: "+ New Request", onClick: () => router.push("/asset-management/maintenance-repair/new") }] : []}
        />
        <DataTable columns={columns} data={filteredRows}
          onRowClick={(row) => { if (access.canOpenDetails) router.push(`/asset-management/maintenance-repair/${row.id}`); }} />
      </div>
    </HeaderWrapper>
  );
}
