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


export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "receipt", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    apiRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.LIST}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => {
        const rows = (res.data || []).map((r, i) => ({
          sl:             i + 1,
          _id:            r.id,
          receiptNo:      r.receiptNo      || "",
          date:           getfmtDisplaydate(r.entryDate) || "",
          partyName:      r.customerName   || r.vendorName || "",
          refNo:          r.ogSaleOrderNo  || "",
          byMode:         r.paymentMode    || "",
          source:         r.bankAcName     || r.cashAcName || "-",
          utrVoucherNo:   r.utrVoucherNo   || "-",
          amount:         Number(r.totalInvoiceAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          workflowStatus: r.workflowStatus || "",
          _raw:           r,
        }));
        setData(rows);
        setFilteredData(rows);
      })
      .catch(() => toast.error("Failed to fetch Receipt list"))
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
        if (!item.date) return false;
        const d = new Date(item.date);
        d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0,0,0,0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. no",          accessor: "sl",             width: "60px"  },
    { header: "Receipt Voc. No", accessor: "receiptNo",      width: "140px" },
    { header: "Date",            accessor: "date",           width: "110px" },
    { header: "Customer Name",   accessor: "partyName",      width: "180px" },
    { header: "Ref. Number",     accessor: "refNo",          width: "150px" },
    { header: "By Mode",         accessor: "byMode",         width: "90px"  },
    { header: "Source",          accessor: "source",         width: "130px" },
    { header: "UTR / Voc. No",   accessor: "utrVoucherNo",   width: "130px" },
    { header: "Amount",          accessor: "amount",         width: "120px", align: "right" },
    { header: "Status",          accessor: "workflowStatus", width: "120px" },
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
              ? [{ label: "+ Add Receipt", onClick: () => router.push("/finance-management/account/receipt/new") }]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (!access.canOpenDetails) return;
            router.push(`/finance-management/account/receipt/${row._id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
