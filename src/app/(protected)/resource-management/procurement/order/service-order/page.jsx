"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { getLocalStorage } from "@/lib/localStorage";

const PW = API_ENDPOINTS.RESOURCE.ORDER.PROJECT_WORK;

const formatAmount = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Page() {
  const router = useRouter();

  // Access uses "order" pageCode — same as order module
  const access = getPageAccess({ pageCode: "order", pageType: "LIST" });

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectCode, setProjectCode] = useState("");

  useEffect(() => {
    const projectInfo = getLocalStorage("projectInfo") || {};
    setProjectCode(projectInfo?.projectCode || "");
  }, []);

  // INITIAL LOAD — uses PW list API
  useEffect(() => {
    if (!projectCode) return;

    const fetchOrders = async () => {
      try {
        const res = await apiRequest({
          url: `${PW.GET_ALL_ORDER}?projectCode=${projectCode}`,
          method: "GET",
        });

        const orders = res.data || [];

        const formatted = orders.map((p, index) => {
          const totalAmount = Number(p.totalAmount || 0);
          const bookedAmount = Number(p.bookedAmount || 0);
          return {
            id: p.id,
            sl: index + 1,
            orderNo: p.orderNo,
            orderDate: p.orderDate,
            partyName: p.partyName || "",
            category: p.categoryCode || "",
            basicAmount: formatAmount(p.basicAmount || 0),
            gstAmount: formatAmount(p.gstAmount || 0),
            totalAmount: formatAmount(totalAmount),
            bookedAmount: formatAmount(bookedAmount),
            totalAmountRaw: totalAmount,
            bookedAmountRaw: bookedAmount,
            status:
              p.status === "booked" ? "Booked"
              : p.status === "draft" ? "Draft"
              : p.status === "reject" ? "Reject"
              : p.status === "reback" ? "Reback"
              : p.status,
          };
        });

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch service orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [projectCode]);

  // SEARCH HANDLER
  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];

    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.orderDate) return false;
        const itemDate = new Date(item.orderDate);
        itemDate.setHours(0, 0, 0, 0);
        if (from) {
          const fromDate = new Date(from);
          fromDate.setHours(0, 0, 0, 0);
          if (itemDate < fromDate) return false;
        }
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(0, 0, 0, 0);
          if (itemDate > toDate) return false;
        }
        return true;
      });
    }

    setFilteredData(filtered);
  };

  // SUMMARY
  const summaryData = useMemo(() => {
    const categoryList = ["Work Order", "Hire Order", "Site Transfer Order", "Job Contract Order"];

    const summary = categoryList.map((categoryName) => {
      const categoryRows = filteredData.filter((item) => item.category === categoryName);
      const totalPlaced = categoryRows.reduce((sum, item) => sum + Number(item.totalAmountRaw || 0), 0);
      const totalBooked = categoryRows.reduce((sum, item) => sum + Number(item.bookedAmountRaw || 0), 0);
      return {
        category: categoryName,
        orderPlaced: totalPlaced,
        billBooked: totalBooked,
        unBilled: totalPlaced - totalBooked,
      };
    });

    const totalOrderPlaced = summary.reduce((sum, item) => sum + item.orderPlaced, 0);
    const totalBillBooked = summary.reduce((sum, item) => sum + item.billBooked, 0);
    const totalUnBilled = summary.reduce((sum, item) => sum + item.unBilled, 0);

    return {
      rows: summary,
      total: { orderPlaced: totalOrderPlaced, billBooked: totalBillBooked, unBilled: totalUnBilled },
    };
  }, [filteredData]);

  const columns = [
    { header: "Sl. no", accessor: "sl" },
    { header: "Order No", accessor: "orderNo" },
    { header: "Date", accessor: "orderDate" },
    { header: "Party Name", accessor: "partyName" },
    { header: "Category", accessor: "category" },
    { header: "Basic", accessor: "basicAmount" },
    { header: "GST", accessor: "gstAmount" },
    { header: "Total", accessor: "totalAmount" },
    { header: "Booked", accessor: "bookedAmount" },
    { header: "Status", accessor: "status" },
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
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <div className="relative min-h-[calc(100vh-220px)] p-3 overflow-hidden">
          <SearchSection
            onSearch={handleSearch}
            showDateRange={true}
            actions={
              access.canAdd
                ? [{ label: "+ Create Service Order", onClick: () => router.push("/resource-management/procurement/service-order/new") }]
                : []
            }
          />

          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => {
              router.push(`/resource-management/procurement/service-order/${row.id}`);
            }}
          />

          {/* SUMMARY BUTTON + MODAL */}
          <div className="absolute bottom-[18px] left-[18px] z-30">
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="h-[34px] min-w-[170px] rounded-[8px] border border-[#7f6f52] bg-[#efb17f] px-[22px] text-[14px] font-medium text-[#1f1f1f] shadow-[inset_0px_1px_0px_#ffd8bb] transition-all duration-200 hover:brightness-[0.98] cursor-pointer"
                >
                  Summary
                </button>
              </DialogTrigger>

              <DialogContent className="max-w-[600px] p-0">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                  <DialogTitle className="text-lg font-semibold">Service Order Summary</DialogTitle>
                </DialogHeader>

                <div className="overflow-auto max-h-[60vh] p-4">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#D3D3D3] font-semibold">
                        <th className="border px-3 py-2 text-left">Category</th>
                        <th className="border px-3 py-2 text-right">Order Placed</th>
                        <th className="border px-3 py-2 text-right">Bill Booked</th>
                        <th className="border px-3 py-2 text-right">Un-Billed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                          <td className="border px-3 py-1">{row.category}</td>
                          <td className="border px-3 py-1 text-right">{formatAmount(row.orderPlaced)}</td>
                          <td className="border px-3 py-1 text-right">{formatAmount(row.billBooked)}</td>
                          <td className="border px-3 py-1 text-right">{formatAmount(row.unBilled)}</td>
                        </tr>
                      ))}
                      <tr className="bg-[#D3D3D3] font-semibold">
                        <td className="border px-3 py-1">Total</td>
                        <td className="border px-3 py-1 text-right">{formatAmount(summaryData.total.orderPlaced)}</td>
                        <td className="border px-3 py-1 text-right">{formatAmount(summaryData.total.billBooked)}</td>
                        <td className="border px-3 py-1 text-right">{formatAmount(summaryData.total.unBilled)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </HeaderWrapper>
    </>
  );
}
