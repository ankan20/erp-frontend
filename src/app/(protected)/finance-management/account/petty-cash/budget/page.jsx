"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { Loader2 }             from "lucide-react";
import { toast }               from "sonner";

import SearchSection    from "@/components/common/SearchSection";
import DataTable        from "@/components/common/DataTable";
import PageHeader       from "@/components/layout/PageHeader";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }    from "@/components/common/PageActionButtons";
import { getPageAccess }     from "@/helper/getPageAccess";
import { apiRequest }        from "@/lib/apiClient";
import { API_ENDPOINTS }     from "@/config/api.config";
import { getLocalStorage }   from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

export default function BudgetListPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "petty_cash", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.LIST}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const list = res.data?.list || res.data || [];
        const rows = list.map((r, i) => ({
          sl:             i + 1,
          _id:            r.id,
          budgetNo:       r.budgetNo                      || "",
          date:           getfmtDisplaydate(r.budgetDate) || "",
          frequency:      r.budgetFrequency               || "",
          fromDate:       getfmtDisplaydate(r.fromDate)   || "",
          toDate:         getfmtDisplaydate(r.toDate)     || "",
          amount:         Number(r.totalBudgetAmount || r.totalAmount || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          }),
          workflowStatus: r.workflowStatus || "",
          createdBy:      r.createdBy      || "",
          _raw:           r,
        }));
        setData(rows);
        setFilteredData(rows);
      })
      .catch(() => toast.error("Failed to fetch budget list"))
      .finally(() => setLoading(false));
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search }) => {
    if (!search) { setFilteredData(data); return; }
    const q = search.toLowerCase();
    setFilteredData(
      data.filter((r) =>
        ["budgetNo", "frequency", "workflowStatus", "createdBy"].some(
          (k) => String(r[k] || "").toLowerCase().includes(q),
        ),
      ),
    );
  };

  const columns = [
    { header: "Sl. no",      accessor: "sl",             width: "55px"  },
    { header: "Budget ID",   accessor: "budgetNo",       width: "120px" },
    { header: "Date",        accessor: "date",           width: "100px" },
    { header: "Frequency",   accessor: "frequency",      width: "100px" },
    { header: "From Date",   accessor: "fromDate",       width: "100px" },
    { header: "To Date",     accessor: "toDate",         width: "100px" },
    { header: "Amount",      accessor: "amount",         width: "120px", align: "right" },
    { header: "Status",      accessor: "workflowStatus", width: "110px" },
    { header: "Prepared By", accessor: "createdBy",      width: "130px" },
  ];

  const actions = getPageActions({ router });

  if (!access.allowed) return <PageNotAvailable />;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <SearchSection
          onSearch={handleSearch}
          actions={
            access.canAdd
              ? [{ label: "+ Budget", onClick: () => router.push("/finance-management/account/petty-cash/budget/new") }]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (!access.canOpenDetails) return;
            router.push(`/finance-management/account/petty-cash/budget/${row._id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
