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

const fmtNum = (val) => {
  const n = Number(val);
  if (!n || isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "purchases", pageType: "LIST" });

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
        const [billRes, voucherRes] = await Promise.all([
          apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.LIST}?projectCode=${projectCode}`, method: "GET" }),
          apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_VOUCHER.LIST}?projectCode=${projectCode}`, method: "GET" }),
        ]);

        const bills = (billRes.data || []).map((r, i) => ({
          _id:           r.id,
          _type:         "bill",
          voucherNo:     r.purchaseBillNo || "",
          date:          getfmtDisplaydate(r.processingDate) || "",
          partyName:     r.vendorName || "",
          type:          "Bill",
          amount:        fmtNum(r.totalInvoiceAmount),
          paid:          r.paidAmount ? fmtNum(r.paidAmount) : "-",
          balance:       r.balance    ? fmtNum(r.balance)    : "-",
          workflowStatus: r.workflowStatus || "",
          _raw:          r,
        }));

        const vouchers = (voucherRes.data || []).map((r, i) => ({
          _id:           r.id,
          _type:         "voucher",
          voucherNo:     r.voucherNo || "",
          date:          getfmtDisplaydate(r.processingDate) || "",
          partyName:     r.vendorName || "",
          type:          "Voucher",
          amount:        fmtNum(r.totalInvoiceAmount),
          paid:          r.paidAmount ? fmtNum(r.paidAmount) : "-",
          balance:       r.balance    ? fmtNum(r.balance)    : "-",
          workflowStatus: r.workflowStatus || "",
          _raw:          r,
        }));

        const merged = [...bills, ...vouchers].map((r, i) => ({ ...r, sl: i + 1 }));
        setData(merged);
        setFilteredData(merged);
      } catch {
        toast.error("Failed to fetch Purchases list");
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

  // Summary totals
  const bookedRows  = filteredData.filter((r) => r.workflowStatus === "Approved" || r.workflowStatus === "Booked");
  const bookedAmt   = bookedRows.reduce((s, r)  => s + Number(r._raw?.totalInvoiceAmount || 0), 0);
  const paidAmt     = filteredData.reduce((s, r) => s + Number(r._raw?.paidAmount || 0), 0);
  const liability   = bookedAmt - paidAmt;

  const columns = [
    { header: "Sl. no",     accessor: "sl",            width: "60px"  },
    { header: "Voucher No", accessor: "voucherNo",     width: "130px" },
    { header: "Date",       accessor: "date",          width: "110px" },
    { header: "Party Name", accessor: "partyName",     width: "180px" },
    { header: "Type",       accessor: "type",          width: "90px"  },
    { header: "Amount",     accessor: "amount",        width: "130px", align: "right" },
    { header: "Paid",       accessor: "paid",          width: "110px", align: "right" },
    { header: "Balance",    accessor: "balance",       width: "110px", align: "right" },
    { header: "Status",     accessor: "workflowStatus",width: "120px" },
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
              ? [
                  { label: "+ Bill Processing",    onClick: () => router.push("/finance-management/account/purchases/bill/new") },
                  { label: "+ Voucher Processing", onClick: () => router.push("/finance-management/account/purchases/voucher/new") },
                ]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (!access.canOpenDetails) return;
            if (row._type === "bill")    router.push(`/finance-management/account/purchases/bill/${row._id}`);
            if (row._type === "voucher") router.push(`/finance-management/account/purchases/voucher/${row._id}`);
          }}
        />

        {/* Summary totals */}
        <div className="flex flex-wrap gap-3 pt-1">
          {[
            ["Booked Amount", bookedAmt],
            ["Paid Amount",   paidAmt],
            ["Liability",     liability],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center border border-gray-300 rounded-sm overflow-hidden text-[13px]">
              <div className="px-4 py-1.5 bg-[#f0f4eb] font-semibold text-gray-800 border-r border-gray-300">{label}</div>
              <div className="px-4 py-1.5 bg-[#eaf2f8] font-semibold text-right min-w-[120px]">{fmtNum(val)}</div>
            </div>
          ))}
        </div>
      </div>
    </HeaderWrapper>
  );
}
