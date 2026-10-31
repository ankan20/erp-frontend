"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { Loader2 }             from "lucide-react";
import { toast }               from "sonner";

import SearchSection from "@/components/common/SearchSection";
import DataTable     from "@/components/common/DataTable";
import { useDeletePendingIds } from "@/hooks/useDeletePendingIds";
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
          crName:         r.crName || "-",
          amount:         formatAmount(r.totalCredit  || 0),
          workflowStatus: r.workflowStatus || "",
          _raw:           r,
        }));
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
        ["voucherNo", "workflowStatus", "crName"].some(
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
    { header: "Name",       accessor: "crName",         width: "220px" },
    { header: "Amount",     accessor: "amount",         width: "120px", align: "right" },
    { header: "Status",     accessor: "workflowStatus", width: "120px" },
  ];

  const actions = getPageActions({ router });

  const pendingDeleteIds = useDeletePendingIds("JOURNAL_ENTRY", access.allowed);

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
          actions={[
            { label: "Voucher Docket", onClick: () => router.push("/finance-management/account/journal/docket-voucher") },
            { label: "Journal Voucher", onClick: () => router.push("/finance-management/account/journal/vouchering") },
            { label: "Journal Accounting", onClick: () => router.push("/finance-management/account/journal/accounting") },
            ...(access.canAdd ? [{ label: "+ Journal Adjustment", onClick: () => router.push("/finance-management/account/journal/new") }] : []),
          ]}
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (!access.canOpenDetails) return;
            router.push(`/finance-management/account/journal/${row._id}`);
          }}
        pendingDeleteIds={pendingDeleteIds}
        summaryRow={{ amount: { align: "right" } }}
        />

      </div>
    </HeaderWrapper>
  );
}
