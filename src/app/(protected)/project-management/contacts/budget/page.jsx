"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { formatAmount }      from "@/helper/numberFormatter";

const BASE_PATH = "/project-management/contacts/budget";

export default function BudgetMasterListPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "budget_master", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    apiRequest({
      url:    `${API_ENDPOINTS.PROJECT.BUDGET_MASTER.LIST}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.list || []);
        const rows = list.map((r, i) => ({
          _id:            r.id,
          sl:             i + 1,
          budgetNo:       r.budgetNo       || "",
          date:           getfmtDisplaydate(r.budgetDate) || "",
          saleOrderNo:    r.saleOrderNo    || "",
          saleOrderTitle: r.saleOrderTitle || "",
          initialCost:    formatAmount(r.totalInitialCost || 0),
          ccCost:         formatAmount(r.totalCcCost      || 0),
          grandTotal:     formatAmount(r.grandTotal       || 0),
          workflowStatus: r.workflowStatus || "",
          _raw:           r,
        }));
        setData(rows);
        setFilteredData(rows);
      })
      .catch(() => toast.error("Failed to fetch Budget list"))
      .finally(() => setLoading(false));
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r) =>
        ["budgetNo", "saleOrderNo", "saleOrderTitle", "workflowStatus"].some((k) =>
          String(r[k] || "").toLowerCase().includes(q),
        ),
      );
    }
    if (from || to) {
      filtered = filtered.filter((r) => {
        const raw = r._raw?.budgetDate;
        if (!raw) return false;
        const d = new Date(raw); d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0, 0, 0, 0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0, 0, 0, 0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. no",       accessor: "sl",             width: "60px"  },
    { header: "Budget No",    accessor: "budgetNo",       width: "110px" },
    { header: "Date",         accessor: "date",           width: "110px" },
    { header: "Sale Order",   accessor: "saleOrderNo",    width: "120px" },
    { header: "Order Title",  accessor: "saleOrderTitle"                 },
    { header: "Initial Cost", accessor: "initialCost",    width: "130px", align: "right" },
    { header: "CC Cost",      accessor: "ccCost",         width: "130px", align: "right" },
    { header: "Grand Total",  accessor: "grandTotal",     width: "140px", align: "right" },
    { header: "Status",       accessor: "workflowStatus", width: "120px" },
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
          showDateRange
          actions={
            access.canAdd
              ? [{ label: "+ New Budget", onClick: () => router.push(`${BASE_PATH}/new`) }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (!access.canOpenDetails) return;
            router.push(`${BASE_PATH}/${row._id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
