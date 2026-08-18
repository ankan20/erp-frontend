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
import { ACC }              from "@/components/finance/account/common/accountTheme";

const fmt = (val) => {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "payment", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    Promise.allSettled([
      apiRequest({ url: `${API_ENDPOINTS.FINANCE.PAYMENT_VOUCHER.LIST}?projectCode=${projectCode}`, method: "GET" }),
      apiRequest({ url: `${API_ENDPOINTS.FINANCE.BILL_PAYMENT.LIST}?projectCode=${projectCode}`,     method: "GET" }),
    ])
      .then(([pvRes, bpRes]) => {
        const pvRows = pvRes.status === "fulfilled"
          ? (pvRes.value?.data || []).map((r) => ({
              _id:         r.id,
              _type:       "voucher",
              paymentNo:   r.paymentVouchNo     || "—",
              date:        r.paymentDate ? getfmtDisplaydate(r.paymentDate) : "—",
              partyName:   r.vendorName         || "—",
              type:        "Voucher",
              refNumber:   r.purchaseVoucherNo  || "—",
              paymentMode: r.paymentMode        || "—",
              utrVoucherNo: r.utrVoucherNo      || "—",
              amount:      r.totalInvoiceAmount != null ? formatAmount(r.totalInvoiceAmount) : "—",
              status:      r.workflowStatus     || "Draft",
              _raw:        r,
            }))
          : [];

        const bpRows = bpRes.status === "fulfilled"
          ? (bpRes.value?.data || []).map((r) => ({
              _id:         r.id,
              _type:       "bill",
              paymentNo:   r.receiptNo          || "—",
              date:        r.paymentDate ? getfmtDisplaydate(r.paymentDate) : "—",
              partyName:   r.vendorName         || "—",
              type:        "Bill",
              refNumber:   r.purchaseBillNo     || "—",
              paymentMode: r.paymentMode        || "—",
              utrVoucherNo: r.utrVoucherNo      || "—",
              amount:      r.totalInvoiceAmount != null ? formatAmount(r.totalInvoiceAmount) : "—",
              status:      r.workflowStatus     || "Draft",
              _raw:        r,
            }))
          : [];

        if (pvRes.status === "rejected") toast.error("Failed to fetch Voucher Payments");
        if (bpRes.status === "rejected") toast.error("Failed to fetch Bill Payments");

        const combined = [...pvRows, ...bpRows].sort((a, b) => {
          const da = a._raw?.paymentDate ? new Date(a._raw.paymentDate) : new Date(0);
          const db = b._raw?.paymentDate ? new Date(b._raw.paymentDate) : new Date(0);
          return db - da;
        }).map((r, i) => ({ sl: i + 1, ...r }));

        setData(combined);
        setFilteredData(combined);
      })
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
        if (!item._raw?.paymentDate) return false;
        const d = new Date(item._raw.paymentDate);
        d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0,0,0,0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. No",          accessor: "sl",           width: "50px"  },
    { header: "Payment Voc. No", accessor: "paymentNo",    width: "130px" },
    { header: "Date",            accessor: "date",         width: "100px" },
    { header: "Party Name",      accessor: "partyName",    width: "200px" },
    { header: "Type",            accessor: "type",         width: "80px",  align: "center" },
    { header: "Ref. Number",     accessor: "refNumber",    width: "130px" },
    { header: "By Mode",         accessor: "paymentMode",  width: "85px",  align: "center" },
    { header: "UTR / Voc. No",   accessor: "utrVoucherNo", width: "145px" },
    { header: "Amount",          accessor: "amount",       width: "120px", align: "right" },
    { header: "Status",          accessor: "status",       width: "115px" },
  ];

  // Summary
  const bankTotal = filteredData.reduce((s, r) => {
    if (r.paymentMode === "Bank") {
      const n = Number(r._raw?.totalInvoiceAmount || 0);
      return s + (isNaN(n) ? 0 : n);
    }
    return s;
  }, 0);
  const cashTotal = filteredData.reduce((s, r) => {
    if (r.paymentMode === "Cash") {
      const n = Number(r._raw?.totalInvoiceAmount || 0);
      return s + (isNaN(n) ? 0 : n);
    }
    return s;
  }, 0);
  const grandTotal = bankTotal + cashTotal;

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
                  { label: "+ Bill Payment",    onClick: () => router.push("/finance-management/account/payment/new?type=bill")    },
                  { label: "+ Voucher Payment", onClick: () => router.push("/finance-management/account/payment/new?type=voucher") },
                ]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails)
              router.push(`/finance-management/account/payment/${row._id}?type=${row._type}`);
          }}
        />

        {/* Summary */}
        {filteredData.length > 0 && (
          <div className="w-full sm:max-w-[360px] mt-2 rounded-sm border border-gray-300 overflow-hidden divide-y divide-gray-300">
            {[
              { label: "Bank Payment",  value: bankTotal,  labelBg: ACC.summaryLabelBg, valueBg: ACC.summaryValueBg },
              { label: "Cash Payment",  value: cashTotal,  labelBg: ACC.summaryLabelBg, valueBg: ACC.summaryValueBg },
              { label: "Total Payment", value: grandTotal, labelBg: "bg-[#D5DBE6]",     valueBg: ACC.totalValueBg   },
            ].map(({ label, value, labelBg, valueBg }) => (
              <div key={label} className="flex items-stretch">
                <div className={`flex-1 px-3 py-[7px] text-[13px] font-semibold ${labelBg}`}>
                  {label}
                </div>
                <div className={`px-3 py-[7px] text-[13px] font-semibold text-right min-w-[130px] shrink-0 ${valueBg}`}>
                  {fmt(value)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
