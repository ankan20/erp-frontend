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
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const fmtNum = (val) => {
  const n = Number(val);
  if (!n || isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "sale", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [projectCode,  setProjectCode]  = useState("");

  useEffect(() => {
    const info = getLocalStorage("projectInfo") || {};
    setProjectCode(info?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    const fetchList = async () => {
      try {
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.FINANCE.SALE_BILL.LIST}?projectCode=${projectCode}`,
          method: "GET",
        });

        const list = (res.data || []).map((r, i) => ({
          id:             r.id,
          sl:             i + 1,
          invoiceNo:      r.saleBillNo         || "",
          invDate:        getfmtDisplaydate(r.invoiceDate) || "",
          saleOrderNo:    r.saleOrderNo        || r.ogSaleOrderNo || "",
          billAbstractNo: r.certifiedBillNo     || "",
          basic:          fmtNum(r.basicAmount),
          gst:            fmtNum(r.gstAmount),
          totalAmount:    fmtNum(r.totalInvoiceAmount),
          workflowStatus: r.workflowStatus     || "",
        }));

        setData(list);
        setFilteredData(list);
      } catch {
        toast.error("Failed to fetch Sale Invoice list");
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];

    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase()),
        ),
      );
    }

    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.invDate) return false;
        const d = new Date(item.invDate);
        d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0,0,0,0); if (d > t) return false; }
        return true;
      });
    }

    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. no",        accessor: "sl",             width: "65px"  },
    { header: "Invoice No.",   accessor: "invoiceNo",      width: "130px" },
    { header: "Inv. Date",     accessor: "invDate",        width: "110px" },
    { header: "Sale Order No.",accessor: "saleOrderNo",    width: "140px" },
    { header: "Bill Abs. No",  accessor: "billAbstractNo", width: "120px" },
    { header: "Basic",         accessor: "basic",          width: "120px", align: "right" },
    { header: "GST",           accessor: "gst",            width: "110px", align: "right" },
    { header: "Total Amount",  accessor: "totalAmount",    width: "130px", align: "right" },
    { header: "Status",        accessor: "workflowStatus", width: "130px" },
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
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          showDateRange
          actions={
            access.canAdd
              ? [{ label: "+ Add Sale Invoice", onClick: () => router.push("/finance-management/account/sale/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails) router.push(`/finance-management/account/sale/${row.id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
