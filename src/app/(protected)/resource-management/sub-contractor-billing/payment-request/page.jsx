"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import SearchSection    from "@/components/common/SearchSection";
import DataTable        from "@/components/common/DataTable";
import { useDeletePendingIds } from "@/hooks/useDeletePendingIds";
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

const BASE_PATH = "/resource-management/sub-contractor-billing/payment-request";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "payment_request", pageType: "LIST" });

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
          url: `${API_ENDPOINTS.RESOURCE.PAYMENT_REQUEST.LIST}?projectCode=${projectCode}`,
          method: "GET",
        });
        const formatted = (res.data || []).map((r, i) => ({
          id:              r.id,
          sl:              i + 1,
          prNo:            r.prNo || "",
          prDate:          getfmtDisplaydate(r.prDate),
          _rawDate:        r.prDate || "",
          brrNo:           r.brrNo || "",
          partyName:       r.partyName || "",
          partyBillNo:     r.partyBillNo || "",
          billAmount:      formatAmount(r.billAmount),
          requestedAmount: formatAmount(r.requestedAmount),
          deductionAmount: formatAmount(r.deductionAmount),
          netPayable:      formatAmount(r.netPayable),
          paymentMode:     r.paymentMode || "",
          workflowStatus:  r.workflowStatus || "",
        }));
        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to load Payment Request list");
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item) =>
        Object.values(item).some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (from) filtered = filtered.filter((item) => !item._rawDate || item._rawDate >= from);
    if (to)   filtered = filtered.filter((item) => !item._rawDate || item._rawDate <= to);
    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. No",          accessor: "sl"              },
    { header: "PR No",           accessor: "prNo"            },
    { header: "Date",            accessor: "prDate"          },
    { header: "BRR No",          accessor: "brrNo"           },
    { header: "Party Name",      accessor: "partyName"       },
    { header: "Party Bill No",   accessor: "partyBillNo"     },
    { header: "Bill Amount",     accessor: "billAmount",      align: "right" },
    { header: "Requested",       accessor: "requestedAmount", align: "right" },
    { header: "Deduction",       accessor: "deductionAmount", align: "right" },
    { header: "Net Payable",     accessor: "netPayable",      align: "right" },
    { header: "Mode",            accessor: "paymentMode"     },
    { header: "Status",          accessor: "workflowStatus"  },
  ];

  const actions = getPageActions({ router });
  const pendingDeleteIds = useDeletePendingIds("PAYMENT_REQUEST", access.allowed);

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
              ? [{ label: "+ Raise Payment Request", onClick: () => router.push(`${BASE_PATH}/new`) }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails) router.push(`${BASE_PATH}/${row.id}`);
          }}
          pendingDeleteIds={pendingDeleteIds}
        />
      </div>
    </HeaderWrapper>
  );
}
