"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
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
import { formatAmount }    from "@/helper/numberFormatter";

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
          sl:           i + 1,
          _id:          r.id,
          receiptNo:    r.receiptNo    || "—",
          date:         r.entryDate    ? getfmtDisplaydate(r.entryDate) : "—",
          paymentMode:  r.paymentMode  || "—",
          utrVoucherNo: r.utrVoucherNo || "—",
          totalAmount:  r.totalAmount  != null ? formatAmount(r.totalAmount) : "—",
          billingCount: r.billingCount != null ? r.billingCount : 0,
          _raw:         r,
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
        if (!item._raw?.entryDate) return false;
        const d = new Date(item._raw.entryDate);
        d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0,0,0,0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. No",       accessor: "sl",           width: "55px"  },
    { header: "Receipt No",   accessor: "receiptNo",    width: "130px" },
    { header: "Date",         accessor: "date",         width: "100px" },
    { header: "Payment Mode", accessor: "paymentMode",  width: "110px" },
    { header: "UTR / Voc. No",accessor: "utrVoucherNo", width: "150px" },
    { header: "Total Amount", accessor: "totalAmount",  width: "130px", align: "right" },
    { header: "Billings",     accessor: "billingCount", width: "80px",  align: "center" },
    {
      header:  "Add Billing",
      accessor: "_action",
      width:   "90px",
      align:   "center",
      render:  (row) =>
        access.canAdd ? (
          <button
            type="button"
            title="Add child billing under this receipt"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/finance-management/account/receipt-billing/new?receiptId=${row._id}`);
            }}
            className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-sm border border-[#3b6ea5] text-[#3b6ea5] hover:bg-[#3b6ea5] hover:text-white transition"
          >
            <ArrowRightLeft size={14} />
          </button>
        ) : null,
    },
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
