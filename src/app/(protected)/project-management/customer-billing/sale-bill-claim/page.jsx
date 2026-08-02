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
  const router  = useRouter();
  const access  = getPageAccess({ pageCode: "sale_claim_bill", pageType: "LIST" });

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
          url:    `${API_ENDPOINTS.PROJECT.SALE_CLAIM_BILL.LIST}?projectCode=${projectCode}&mode=sale_order_bill`,
          method: "GET",
        });

        const list = (res.data || []).map((r, i) => ({
          id:             r.id,
          sl:             i + 1,
          billingNo:      r.billingNo            || "",
          date:           getfmtDisplaydate(r.billingDate) || "",
          orderNo:        r.ogSaleOrderNo        || "",
          title:          r.title               || "",
          thisBillClaim:  fmtNum(r.thisBillClaim),
          gstAmount:      fmtNum(r.gstAmount),
          totalClaim:     fmtNum(r.totalClaim),
          workflowStatus: r.workflowStatus       || "",
        }));

        setData(list);
        setFilteredData(list);
      } catch {
        toast.error("Failed to fetch Sale Bill list");
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
    { header: "Sl. no",        accessor: "sl",            width: "65px"  },
    { header: "Billing No",    accessor: "billingNo",     width: "120px" },
    { header: "Bill Date",     accessor: "date",          width: "110px" },
    { header: "Order No",      accessor: "orderNo",       width: "120px" },
    { header: "Title",         accessor: "title"                         },
    { header: "This Bill",     accessor: "thisBillClaim", width: "130px", align: "right" },
    { header: "GST Amount",    accessor: "gstAmount",     width: "120px", align: "right" },
    { header: "Total Claim",   accessor: "totalClaim",    width: "120px", align: "right" },
    { header: "Status",        accessor: "workflowStatus",width: "110px" },
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
              ? [{ label: "+ New Sale Bill", onClick: () => router.push("/project-management/customer-billing/sale-bill-claim/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails) router.push(`/project-management/customer-billing/sale-bill-claim/${row.id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
