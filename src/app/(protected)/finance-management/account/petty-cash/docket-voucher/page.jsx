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

export default function DocketVoucherListPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "petty_cash", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.LIST}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const list = res.data?.list || res.data || [];
        const rows = list.map((r, i) => ({
          sl:             i + 1,
          _id:            r.id,
          voucherNo:      r.voucherNo                       || "",
          date:           getfmtDisplaydate(r.voucherDate)  || "",
          budgetNo:       r.budgetNo                        || "",
          expensesBy:     r.expensesBy                      || "",
          modeOfPayment:  r.modeOfPayment                   || "",
          fundSource:     r.fundSource                      || "",
          paymentRefId:   r.paymentRefId                    || "",
          amount:         Number(r.totalAmount || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          }),
          workflowStatus: r.workflowStatus || "",
          createdBy:      r.createdBy      || "",
          _raw:           r,
        }));
        setData(rows);
        setFilteredData(rows);
      })
      .catch(() => toast.error("Failed to fetch docket voucher list"))
      .finally(() => setLoading(false));
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r) =>
        ["voucherNo", "budgetNo", "expensesBy", "modeOfPayment", "fundSource", "workflowStatus", "createdBy"].some(
          (k) => String(r[k] || "").toLowerCase().includes(q),
        ),
      );
    }
    if (from || to) {
      filtered = filtered.filter((r) => {
        const raw = data.find((d) => d._id === r._id)?._raw?.voucherDate;
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
    { header: "Sl. no",       accessor: "sl",             width: "55px"  },
    { header: "Docket No",    accessor: "voucherNo",      width: "120px" },
    { header: "Date",         accessor: "date",           width: "100px" },
    { header: "Budget Ref",   accessor: "budgetNo",       width: "110px" },
    { header: "Expenses By",  accessor: "expensesBy",     width: "130px" },
    { header: "Payment Mode", accessor: "modeOfPayment",  width: "120px" },
    { header: "Fund Source",  accessor: "fundSource",     width: "110px" },
    { header: "Trans. ID",    accessor: "paymentRefId",   width: "120px" },
    { header: "Amount",       accessor: "amount",         width: "110px", align: "right" },
    { header: "Status",       accessor: "workflowStatus", width: "110px" },
    { header: "Created By",   accessor: "createdBy",      width: "120px" },
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
              ? [{ label: "+ Docket Voucher", onClick: () => router.push("/finance-management/account/petty-cash/docket-voucher/new") }]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (!access.canOpenDetails) return;
            router.push(`/finance-management/account/petty-cash/docket-voucher/${row._id}`);
          }}
        />
      </div>
    </HeaderWrapper>
  );
}
