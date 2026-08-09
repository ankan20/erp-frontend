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
import { getPageActions }   from "@/components/common/PageActionButtons";
import { getPageAccess }    from "@/helper/getPageAccess";
import { apiRequest }       from "@/lib/apiClient";
import { API_ENDPOINTS }    from "@/config/api.config";
import { getLocalStorage }  from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { formatAmount }     from "@/helper/numberFormatter";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "debit_note", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    apiRequest({ url: `${API_ENDPOINTS.FINANCE.DEBIT_NOTE.LIST}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => {
        const rows = (res.data || []).map((r, i) => ({
          sl:             i + 1,
          _id:            r.id,
          debitNoteNo:    r.debitNoteNo   || "—",
          entryDate:      r.entryDate ? getfmtDisplaydate(r.entryDate) : "—",
          billNumber:     r.billNumber    || "—",
          vendorName:     r.vendorName    || "—",
          basicAmount:    formatAmount(r.basicAmount),
          gstAmount:      formatAmount(r.gstAmount),
          totalAmount:    formatAmount(r.totalAmount),
          workflowStatus: r.workflowStatus || "Draft",
        }));
        setData(rows);
        setFilteredData(rows);
      })
      .catch(() => toast.error("Failed to fetch Debit Note list"))
      .finally(() => setLoading(false));
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];
    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
      );
    }
    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.entryDate) return false;
        const d = new Date(item.entryDate);
        d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0,0,0,0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. No",        accessor: "sl",             width: "55px"  },
    { header: "DN No.",        accessor: "debitNoteNo",    width: "120px" },
    { header: "Entry Date",    accessor: "entryDate",      width: "105px" },
    { header: "Bill Number",   accessor: "billNumber",     width: "140px" },
    { header: "Vendor Name",   accessor: "vendorName",     width: "200px" },
    { header: "Basic Amt",     accessor: "basicAmount",    width: "115px", align: "right" },
    { header: "GST Amt",       accessor: "gstAmount",      width: "105px", align: "right" },
    { header: "Total Amt",     accessor: "totalAmount",    width: "115px", align: "right" },
    { header: "Status",        accessor: "workflowStatus", width: "120px" },
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
              ? [{ label: "+ Add Debit Note", onClick: () => router.push("/finance-management/account/debit-note/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails) router.push(`/finance-management/account/debit-note/${row._id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
