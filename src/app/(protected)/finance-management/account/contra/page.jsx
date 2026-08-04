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
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const fmt = (val) => {
  const n = Number(val);
  return isNaN(n) || n === 0
    ? "—"
    : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SUMMARY_ITEMS = [
  { key: "bankToCash", label: "Bank to Cash" },
  { key: "cashToBank", label: "Cash to Bank" },
  { key: "bankToBank", label: "Bank to Bank" },
  { key: "cashToCash", label: "Cash to Cash" },
];

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "contra", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [summary,      setSummary]      = useState({});
  const [loading,      setLoading]      = useState(true);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.CONTRA_ENTRY.LIST}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const rows = (res.list || []).map((r, i) => ({
          sl:             i + 1,
          _id:            r.id,
          voucherNo:      r.voucherNo      || "",
          date:           getfmtDisplaydate(r.entryDate) || "",
          debitFrom:      r.debitFrom      || "",
          creditTo:       r.creditTo       || "",
          amount:         Number(r.amount  || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          }),
          workflowStatus: r.workflowStatus || "",
          _raw:           r,
        }));
        setData(rows);
        setFilteredData(rows);
        setSummary(res.summary || {});
      })
      .catch(() => toast.error("Failed to fetch Contra Entry list"))
      .finally(() => setLoading(false));
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item) =>
        ["voucherNo", "debitFrom", "creditTo", "workflowStatus"].some(
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
    { header: "Debit From", accessor: "debitFrom",      width: "200px" },
    { header: "Credit To",  accessor: "creditTo",       width: "200px" },
    { header: "Amount",     accessor: "amount",         width: "120px", align: "right" },
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
              ? [{ label: "+ Contra Entry", onClick: () => router.push("/finance-management/account/contra/new") }]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (!access.canOpenDetails) return;
            router.push(`/finance-management/account/contra/${row._id}`);
          }}
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {SUMMARY_ITEMS.map(({ key, label }) => (
            <div key={key} className="rounded-sm overflow-hidden border border-gray-200 flex">
              <div className="bg-[#9590d0] text-white text-[12px] font-medium px-3 py-2 flex items-center w-[120px] shrink-0">
                {label}
              </div>
              <div className="bg-white text-[12px] text-right px-3 py-2 flex-1 font-medium text-gray-700 tabular-nums">
                {fmt(summary[key])}
              </div>
            </div>
          ))}
        </div>

      </div>
    </HeaderWrapper>
  );
}
