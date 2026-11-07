"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SearchSection from "@/components/common/SearchSection";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import BRRExpandableTable from "@/components/resource/brr/BRRExpandableTable";

const fmt = (v) =>
  Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Categories linked to GRN (BRG) billing
const GRN_CATEGORIES = ["Purchases_Order", "Site_Transfer_Order", "Customer_Supply_Order"];

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "bill_receive_register", pageType: "LIST" });

  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [projectCode, setProjectCode] = useState("");

  useEffect(() => {
    const info = getLocalStorage("projectInfo") || {};
    setProjectCode(info?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    const fetchList = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.LIST}?projectCode=${projectCode}`,
          method: "GET",
        });
        const list = (res.data || []).map((item, idx) => {
          const billingType = GRN_CATEGORIES.includes(item.orderCategory) ? "grn" : "srn";
          const b = item.brb || null;

          return {
            id:            item.id ?? item.brrId,
            _origIdx:      idx,
            brrNo:         item.brrNo || "",
            brrDate:       getfmtDisplaydate(item.brrDate),
            _rawDate:      item.brrDate || "",
            partyName:     item.partyName || "",
            orderCategory: item.orderCategory || "",
            orderNo:       item.orderNo || "",
            partyBillNo:   item.partyBillNo || "",
            partyDate:     getfmtDisplaydate(item.partyDate),
            // BRR amounts (may be overridden by BRB actuals in table)
            brrBasicAmount: fmt(item.basicAmount),
            brrGstAmount:   fmt(item.gstAmount),
            brrTotalAmount: fmt(item.totalAmount),
            bookedAmount:   item.bookedAmount != null ? fmt(item.bookedAmount) : null,
            status:         item.workflowStatus || "",
            billingType,
            // Single BRB (null if none exists)
            brb: b ? {
              _id:            b.brbId,
              _billingType:   billingType,
              _brrId:         item.id ?? item.brrId,
              brbNo:          b.brbNo || "",
              brbDate:        getfmtDisplaydate(b.brbDate),
              _rawDate:       b.brbDate || "",
              workflowStatus: b.workflowStatus || "",
              basicAmount:    fmt(b.basicAmount),
              gstAmount:      fmt(b.gstAmount),
              totalAmount:    fmt(b.totalAmount),
              itemCount:      b.itemCount ?? "-",
            } : null,
          };
        });
        setData(list);
      } catch (err) {
        toast.error(err.message || "Failed to fetch BRR list");
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search: s, from, to }) => {
    setSearch(s || "");
    setFromDate(from || "");
    setToDate(to || "");
  };

  const displayData = data.filter((row) => {
    if (fromDate && row._rawDate && row._rawDate < fromDate) return false;
    if (toDate   && row._rawDate && row._rawDate > toDate)   return false;
    return true;
  });

  const handleParentRowClick = (row) => {
    router.push(`/resource-management/sub-contractor-billing/bill-receive-register/${row.id}`);
  };

  const handleCreateBilling = (row) => {
    router.push(
      `/resource-management/sub-contractor-billing/e-reconcile-bill/new?brrId=${row.id}&billingType=${row.billingType}`
    );
  };

  const handleBrbClick = (row) => {
    if (!row.brb?._id) return;
    router.push(
      `/resource-management/sub-contractor-billing/e-reconcile-bill/${row.brb._id}?billingType=${row.brb._billingType}`
    );
  };

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
              ? [{ label: "+ Create BRR", onClick: () => router.push("/resource-management/sub-contractor-billing/bill-receive-register/new") }]
              : []
          }
        />
        <div className="mt-1 text-xs text-gray-500 mb-2">
          Click <span className="font-semibold text-blue-600">BRR No</span> to open BRR details · Click <span className="font-semibold text-blue-600">BRB No</span> to open billing record
        </div>
        <BRRExpandableTable
          data={displayData}
          onParentRowClick={handleParentRowClick}
          onBrbClick={handleBrbClick}
          onCreateBilling={handleCreateBilling}
          search={search}
        />
      </div>
    </HeaderWrapper>
  );
}
