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
import { MOCK_RENTALS }    from "@/components/assetmanagement/rental-utilization/mockData";

const DIR_LABEL = { outgoing: "Rented Out", incoming: "On Rent (In)" };
const fmtCur = (v) => v ? `₹ ${Number(v).toLocaleString("en-IN")}` : "—";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_rental_utilization", pageType: "LIST", defaultToAllowed: true });

  const allRows = MOCK_RENTALS.map((r, i) => ({
    id: r.id, sl: i + 1,
    docNo: r.docNo,
    direction: DIR_LABEL[r.direction] || r.direction,
    assetName: r.assetName || "—",
    party: r.party,
    startDate: r.startDate, endDate: r.endDate,
    rentalRate: fmtCur(r.rentalRate) + `/${r.rentalBasis}`,
    totalAmount: fmtCur(r.totalAmount),
    status: r.status, _rawStatus: r.status,
  }));

  const [filteredRows, setFilteredRows] = useState(allRows);

  const columns = [
    { header: "Sl",         accessor: "sl",          width: "55px" },
    { header: "Doc No",     accessor: "docNo",       width: "130px" },
    { header: "Direction",  accessor: "direction",   width: "130px" },
    { header: "Asset / Equipment", accessor: "assetName" },
    { header: "Party",      accessor: "party",       width: "200px" },
    { header: "Start",      accessor: "startDate",   width: "105px" },
    { header: "End",        accessor: "endDate",     width: "105px" },
    { header: "Rate",       accessor: "rentalRate",  width: "130px" },
    { header: "Total",      accessor: "totalAmount", width: "120px" },
    { header: "Status",     accessor: "status",      width: "110px", render: (row) => <AmStatusBadge status={row._rawStatus} /> },
  ];

  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <div className="p-3">
        <SearchSection onSearch={({ search }) => setFilteredRows(search ? allRows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))) : allRows)}
          actions={access.canAdd ? [{ label: "+ New Agreement", onClick: () => router.push("/asset-management/rental-utilization/new") }] : []}
        />
        <DataTable columns={columns} data={filteredRows}
          onRowClick={(row) => { if (access.canOpenDetails) router.push(`/asset-management/rental-utilization/${row.id}`); }} />
      </div>
    </HeaderWrapper>
  );
}
