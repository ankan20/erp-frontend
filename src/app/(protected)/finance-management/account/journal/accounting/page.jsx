"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter }             from "next/navigation";
import { Loader2 }               from "lucide-react";
import { toast }                 from "sonner";

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
import { formatAmount }      from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const PAGE_SIZE = 10;

function Paginator({ page, totalPages, total, onPage, loading }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);
  return (
    <div className="flex items-center justify-between px-2 py-1.5 border-t border-[#d5e8f5] bg-[#f7fbff] text-[11.5px] text-gray-600">
      <span>Page {page} of {totalPages} · {total} record{total !== 1 ? "s" : ""}</span>
      <div className="flex items-center gap-1">
        <button disabled={page === 1 || loading} onClick={() => onPage(page - 1)}
          className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition">‹ Prev</button>
        {pages.map((p, i) =>
          p === "…" ? <span key={`e-${i}`} className="px-1">…</span> : (
            <button key={p} disabled={loading} onClick={() => onPage(p)}
              className={`px-2 py-0.5 border rounded transition ${p === page ? "bg-[#144664] border-[#144664] text-white font-semibold" : "border-[#9e9e9e] hover:bg-[#e6e6e6]"}`}>
              {p}
            </button>
          )
        )}
        <button disabled={page === totalPages || loading} onClick={() => onPage(page + 1)}
          className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition">Next ›</button>
      </div>
    </div>
  );
}

export default function Page() {
  const router      = useRouter();
  const access      = getPageAccess({ pageCode: "journal", pageType: "LIST" });
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [list,       setList]       = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [searchQ,    setSearchQ]    = useState("");
  const [fromDate,   setFromDate]   = useState("");
  const [toDate,     setToDate]     = useState("");

  const fetchList = useCallback(async (p = 1, q = searchQ, from = fromDate, to = toDate) => {
    if (!projectCode) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectCode, page: p, pageSize: PAGE_SIZE });
      if (q)    params.set("search",   q);
      if (from) params.set("fromDate", from);
      if (to)   params.set("toDate",   to);
      const res = await apiRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ACCOUNTING.LIST}?${params}`, method: "GET" });
      setList(res.data?.list || []);
      setPagination(res.data?.pagination || null);
    } catch {
      toast.error("Failed to fetch list");
    } finally {
      setLoading(false);
    }
  }, [projectCode, searchQ, fromDate, toDate]);

  useEffect(() => {
    if (projectCode && access.allowed) fetchList(1, "", "", "");
  }, [projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = ({ search, from, to }) => {
    const q = search || "", f = from || "", t = to || "";
    setSearchQ(q); setFromDate(f); setToDate(t);
    setPage(1);
    fetchList(1, q, f, t);
  };

  const handlePage = (p) => { setPage(p); fetchList(p); };

  const columns = [
    { header: "Sl.",           accessor: "sl",               width: "50px"  },
    { header: "Voucher No",    accessor: "voucherNo",         width: "130px" },
    { header: "Date",          accessor: "voucherDate",       width: "105px" },
    { header: "JV No",         accessor: "journalVoucherNo",  width: "120px" },
    { header: "Fund Source",   accessor: "fundSource",        width: "110px" },
    { header: "Total Amount",  accessor: "totalAmount",       width: "130px", align: "right" },
    { header: "Status",        accessor: "workflowStatus",    width: "120px" },
    { header: "Created By",    accessor: "createdBy",         width: "110px" },
  ];

  const tableData = list.map((r, i) => ({
    sl:               (page - 1) * PAGE_SIZE + i + 1,
    _id:              r.id,
    voucherNo:        r.voucherNo        || "—",
    voucherDate:      getfmtDisplaydate(r.voucherDate) || "—",
    journalVoucherNo: r.journalVoucherNo || "—",
    fundSource:       r.fundSource       || "—",
    totalAmount:      formatAmount(r.totalAmount || 0),
    workflowStatus:   (r.workflowStatus  || "—").replace(/_/g, " "),
    createdBy:        r.createdBy        || "—",
  }));

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <div className="p-3 space-y-3">
        <SearchSection
          onSearch={handleSearch}
          showDateRange
          actions={
            access.canAdd
              ? [{ label: "+ Journal Accounting", onClick: () => router.push("/finance-management/account/journal/accounting/new") }]
              : []
          }
        />

        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : (
          <div className="border border-[#c5d8e8] rounded-sm overflow-hidden">
            <DataTable
              columns={columns}
              data={tableData}
              onRowClick={(row) => {
                if (!access.canOpenDetails || !row._id) return;
                router.push(`/finance-management/account/journal/accounting/${row._id}`);
              }}
            />
            {pagination && pagination.totalPages > 1 && (
              <Paginator page={page} totalPages={pagination.totalPages} total={pagination.total} onPage={handlePage} loading={loading} />
            )}
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
