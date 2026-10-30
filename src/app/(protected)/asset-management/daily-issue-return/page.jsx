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
import { MOCK_ISSUES }     from "@/components/assetmanagement/daily-issue-return/mockData";
import { isOverdue }       from "@/components/assetmanagement/shared/mockAssets";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "am_daily_issue_return", pageType: "LIST", defaultToAllowed: true });

  const allRows = MOCK_ISSUES.map((r, i) => {
    const overdue = isOverdue(r.expectedReturn) && ["issued"].includes(r.status);
    return {
      id: r.id, sl: i + 1,
      docNo: r.docNo,
      assetId: r.assetId, assetName: r.assetName,
      issuedTo: r.issuedTo, department: r.department || "—",
      issueDate: r.issueDate, expectedReturn: r.expectedReturn,
      conditionAtIssue: r.conditionAtIssue,
      status: overdue ? "overdue" : r.status,
      _rawStatus: overdue ? "overdue" : r.status,
      _overdue: overdue,
    };
  });

  const [filteredRows, setFilteredRows] = useState(allRows);

  const columns = [
    { header: "Sl",           accessor: "sl",              width: "55px" },
    { header: "Doc No",       accessor: "docNo",           width: "125px" },
    { header: "Asset ID",     accessor: "assetId",         width: "115px" },
    { header: "Asset Name",   accessor: "assetName" },
    { header: "Issued To",    accessor: "issuedTo",        width: "160px" },
    { header: "Dept",         accessor: "department",      width: "110px" },
    { header: "Issue Date",   accessor: "issueDate",       width: "105px" },
    { header: "Exp. Return",  accessor: "expectedReturn",  width: "105px" },
    { header: "Condition",    accessor: "conditionAtIssue",width: "95px" },
    { header: "Status",       accessor: "status",          width: "120px",
      render: (row) => (
        <div className="flex items-center gap-1">
          <AmStatusBadge status={row._rawStatus} />
          {row._overdue && <span className="text-red-500 text-xs">⚠</span>}
        </div>
      )
    },
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
            { label: "+ Issue Asset", onClick: () => router.push("/asset-management/daily-issue-return/new") },
          ] : []}
        />
        <DataTable columns={columns} data={filteredRows}
          onRowClick={(row) => { if (access.canOpenDetails) router.push(`/asset-management/daily-issue-return/${row.id}`); }} />
      </div>
    </HeaderWrapper>
  );
}
