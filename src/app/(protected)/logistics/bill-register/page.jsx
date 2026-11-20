"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import SearchSection        from "@/components/common/SearchSection";
import BulkWorkflowTable from "@/components/common/BulkWorkflowTable";
import HeaderWrapper        from "@/components/layout/HeaderWrapper";
import PageHeader           from "@/components/layout/PageHeader";
import PageNotAvailable     from "@/components/common/PageNotAvailable";
import { getPageActions }   from "@/components/common/PageActionButtons";
import { getPageAccess }    from "@/helper/getPageAccess";
import { apiRequest }       from "@/lib/apiClient";
import { API_ENDPOINTS }    from "@/config/api.config";
import { getLocalStorage }  from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { useDeletePendingIds } from "@/hooks/useDeletePendingIds";

const LB = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.BILL_REGISTER;

const STATUS_FILTERS = ["All", "Draft", "Pending", "Approved", "Rejected"];

const fmtAmt = (v) =>
  v != null ? Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "logistics_bill_register", pageType: "LIST", defaultToAllowed: true });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [projectCode,  setProjectCode]  = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const info = getLocalStorage("projectInfo") || {};
    setProjectCode(info?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    setLoading(true);
    apiRequest({ url: `${LB.LIST}?projectCode=${projectCode}` })
      .then((res) => {
        const list = (res.data || []).map((r, i) => ({
          id:              r.id,
          sl:              i + 1,
          lbNo:            r.lbNo             || "",
          billDate:        getfmtDisplaydate(r.billDate),
          _rawDate:        r.billDate          || "",
          vendorName:      r.vendorName        || "",
          vendorInvoiceNo: r.vendorInvoiceNo   || "",
          netPayable:      r.netPayable != null ? fmtAmt(r.netPayable) : "",
          _netPayableRaw:  r.netPayable != null ? Number(r.netPayable) : 0,
          paymentStatus:   r.paymentStatus     || "Unpaid",
          workflowStatus:  r.workflowStatus    || "",
        }));
        setData(list);
        setFilteredData(list);
      })
      .catch(() => toast.error("Failed to load Logistics Bill list"))
      .finally(() => setLoading(false));
  }, [projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { Draft: 0, Pending: 0, Approved: 0, Rejected: 0 };
    data.forEach((r) => { if (r.workflowStatus in c) c[r.workflowStatus]++; });
    return c;
  }, [data]);

  const totalPayable = useMemo(
    () => data.reduce((s, r) => s + (r._netPayableRaw || 0), 0),
    [data],
  );

  const handleSearch = ({ search, from, to }) => {
    let out = statusFilter === "All" ? data : data.filter((r) => r.workflowStatus === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
    }
    if (from || to) {
      out = out.filter((r) => {
        if (!r._rawDate) return false;
        const d = new Date(r._rawDate); d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0, 0, 0, 0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0, 0, 0, 0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(out);
  };

  const handleStatusChip = (s) => {
    setStatusFilter(s);
    setFilteredData(s === "All" ? data : data.filter((r) => r.workflowStatus === s));
  };

  const columns = [
    { header: "Sl. No",      accessor: "sl"              },
    { header: "LB No",       accessor: "lbNo"            },
    { header: "Bill Date",   accessor: "billDate"        },
    { header: "Transporter", accessor: "vendorName"      },
    { header: "Invoice No",  accessor: "vendorInvoiceNo" },
    { header: "Net Payable", accessor: "netPayable",  align: "right" },
    { header: "Payment",     accessor: "paymentStatus"   },
    { header: "Status",      accessor: "workflowStatus"  },
  ];

  const actions = getPageActions({ router });
  const pendingDeleteIds = useDeletePendingIds("LB", access.allowed);

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          showDateRange
          actions={
            access.canAdd
              ? [{ label: "+ New Bill", onClick: () => router.push("/logistics/bill-register/new") }]
              : []
          }
        />

        {/* Status chips + total payable */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {STATUS_FILTERS.map((s) => {
            const count = s === "All" ? data.length : counts[s] ?? 0;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusChip(s)}
                className={`px-2.5 py-0.5 text-[12px] rounded-sm border transition-colors ${
                  active
                    ? "bg-[#144664] text-white border-[#144664]"
                    : "bg-white text-gray-600 border-gray-300 hover:border-[#144664] hover:text-[#144664]"
                }`}
              >
                {s}: {count}
              </button>
            );
          })}
          {totalPayable > 0 && (
            <span className="ml-auto text-[12px] text-gray-500">
              Total payable: <span className="font-semibold text-gray-800">₹{fmtAmt(totalPayable)}</span>
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40 text-sm text-gray-400">Loading…</div>
        ) : (
          <BulkWorkflowTable module="logistics_bill" canAct={access.canApprove} rowId="id" statusKey="workflowStatus"
            columns={columns}
            data={filteredData}
            onRowClick={(row) => access.canOpenDetails && router.push(`/logistics/bill-register/${row.id}`)}
            pendingDeleteIds={pendingDeleteIds}
            summaryRow={{ netPayable: { align: "right" } }}
          />
        )}
      </div>
    </HeaderWrapper>
  );
}
