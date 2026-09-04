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
import { formatAmount }      from "@/helper/numberFormatter";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "journal", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [totals,       setTotals]       = useState({ debit: 0, credit: 0 });
  const [loading,      setLoading]      = useState(true);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.LIST}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const rows = (res.data?.list || []).map((r, i) => ({
          sl:             i + 1,
          _id:            r.id,
          voucherNo:      r.voucherNo      || "",
          date:           getfmtDisplaydate(r.entryDate) || "",
          totalDebit:     formatAmount(r.totalDebit  || 0),
          totalCredit:    formatAmount(r.totalCredit || 0),
          workflowStatus: r.workflowStatus || "",
          _raw:           r,
        }));
        const list = res.data?.list || [];
        setTotals({
          debit:  list.reduce((s, r) => s + Number(r.totalDebit  || 0), 0),
          credit: list.reduce((s, r) => s + Number(r.totalCredit || 0), 0),
        });
        setData(rows);
        setFilteredData(rows);
      })
      .catch(() => toast.error("Failed to fetch Journal Entry list"))
      .finally(() => setLoading(false));
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item) =>
        ["voucherNo", "workflowStatus"].some(
          (k) => String(item[k]).toLowerCase().includes(q),
        ),
      );
    }
    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.date) return false;
        const d = new Date(item.date);
        d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0, 0, 0, 0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0, 0, 0, 0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. no",     accessor: "sl",             width: "60px"  },
    { header: "Voucher No", accessor: "voucherNo",      width: "130px" },
    { header: "Date",       accessor: "date",           width: "110px" },
    { header: "Debit",      accessor: "totalDebit",     width: "120px", align: "right" },
    { header: "Credit",     accessor: "totalCredit",    width: "120px", align: "right" },
    { header: "Status",     accessor: "workflowStatus", width: "120px" },
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
              ? [{ label: "+ Journal Entry", onClick: () => router.push("/finance-management/account/journal/new") }]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (!access.canOpenDetails) return;
            router.push(`/finance-management/account/journal/${row._id}`);
          }}
        />

        {/* Summary cards — totals computed from the fetched list */}
        <div className="flex flex-col gap-1 pt-1 w-fit">
          {[
            { label: "Total Debit",  value: totals.debit  },
            { label: "Total Credit", value: totals.credit },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-sm overflow-hidden border border-gray-200 flex">
              <div className="bg-[#9590d0] text-white text-[12px] font-medium px-3 py-2 flex items-center w-[140px] shrink-0">
                {label}
              </div>
              <div className="bg-white text-[12px] text-right px-3 py-2 min-w-[80px] sm:min-w-[140px] font-medium text-gray-700 tabular-nums">
                {formatAmount(value)}
              </div>
            </div>
          ))}
        </div>

      </div>
    </HeaderWrapper>
  );
}
