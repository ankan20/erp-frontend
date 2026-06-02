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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getLocalStorage } from "@/lib/localStorage";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({
    pageCode: "order",
    pageType: "LIST",
  });

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectCode, setProjectCode] = useState("");

  useEffect(() => {
    const projectInfo = getLocalStorage("projectInfo") || {};
    setProjectCode(projectInfo?.projectCode || "");
  }, []);

  //  INITIAL LOAD
  useEffect(() => {
    if (!projectCode) {
      return;
    };
    const fetchOrders = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.ORDER.GET_ALL_ORDER}?projectCode=${projectCode}`,
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
            // RAW VALUES FOR SUMMARY
            totalAmountRaw: totalAmount,
            bookedAmountRaw: bookedAmount,
            status:
              p.status === "booked"
                ? "Booked"
                : p.status === "draft"
                  ? "Draft"
                  : p.status === "reject"
                    ? "Reject"
                    : p.status === "reback"
                      ? "Reback"
                      : p.status,
          };
        });

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [projectCode]);

  // SEARCH HANDLER
  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];

    // TEXT SEARCH
    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase()),
        ),
      );
    }

    // DATE FILTER
    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.orderDate) return false;

        const itemDate = new Date(item.orderDate);

        itemDate.setHours(0, 0, 0, 0);

        // FROM DATE
        if (from) {
          const fromDate = new Date(from);
          fromDate.setHours(0, 0, 0, 0);

          if (itemDate < fromDate) {
            return false;
          }
        }

        // TO DATE
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(0, 0, 0, 0);

          if (itemDate > toDate) {
            return false;
          }
        }

        return true;
      });
    }

    setFilteredData(filtered);
  };

  // FORMAT AMOUNT
  const formatAmount = (value) => {
    return Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // SUMMARY DATA //need to change here category changed 
  const summaryData = useMemo(() => {
    const categoryList = ["Purchase Order", "Work Order", "Service Order"];

    const summary = categoryList.map((categoryName) => {
      const categoryRows = filteredData.filter(
        (item) => item.category === categoryName,
      );

      const totalPlaced = categoryRows.reduce(
        (sum, item) => sum + Number(item.totalAmountRaw || 0),
        0,
      );

      const totalBooked = categoryRows.reduce(
        (sum, item) => sum + Number(item.bookedAmountRaw || 0),
        0,
      );

      const unBilled = totalPlaced - totalBooked;

      return {
        category: categoryName,
        orderPlaced: totalPlaced,
        billBooked: totalBooked,
        unBilled,
      };
    });

    const totalOrderPlaced = summary.reduce(
      (sum, item) => sum + item.orderPlaced,
      0,
    );

    const totalBillBooked = summary.reduce(
      (sum, item) => sum + item.billBooked,
      0,
    );

    const totalUnBilled = summary.reduce((sum, item) => sum + item.unBilled, 0);

    return {
      rows: summary,
      total: {
        orderPlaced: totalOrderPlaced,
        billBooked: totalBillBooked,
        unBilled: totalUnBilled,
      },
    };
  }, [filteredData]);

  //  TABLE COLUMNS
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
  const actions = getPageActions({
    router,
  });

  if (!access.allowed) {
    return <PageNotAvailable />;
  }

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
        <div className="relative min-h-[calc(100vh-220px)] p-3 overflow-hidden ">
          {/*  SEARCH SECTION */}
          <SearchSection
            onSearch={handleSearch}
            showDateRange={true}
            actions={
              access.canAdd
                ? [
                    {
                      label: "+ Create Order",
                      onClick: () =>
                        router.push(
                          "/resource-management/procurement/order/material-order/new",
                        ),
                    },
                  ]
                : []
            }
          />

          {/*  TABLE */}
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => {
              router.push(`/resource-management/procurement/order/material-order/${row.id}`);
            }}
          />
          {/* SUMMARY SECTION */}
          {/* SUMMARY BUTTON + MODAL */}
          <div className="absolute bottom-[18px] left-[18px] z-30">
            {" "}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="
          h-[34px]
          min-w-[170px]
          rounded-[8px]
          border
          border-[#7f6f52]
          bg-[#efb17f]
          px-[22px]
          text-[14px]
          font-medium
          text-[#1f1f1f]
          shadow-[inset_0px_1px_0px_#ffd8bb]
          transition-all
          duration-200
          hover:brightness-[0.98]
          active:scale-[0.99]
        "
                >
                  Show Summary
                </button>
              </DialogTrigger>

              <DialogContent className="max-w-[820px] overflow-hidden border-[#6b8f4e] p-0">
                <DialogHeader className="border-b border-[#6b8f4e] bg-[#f5f5f5] px-6 py-4">
                  <DialogTitle className="text-[18px] font-semibold text-[#1f1f1f]">
                    Order Summary
                  </DialogTitle>
                </DialogHeader>

                <div className="p-5">
                  <div className="overflow-hidden rounded-[12px] border border-[#6b8f4e]">
                    {/* HEADER */}
                    <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr] bg-[#efd98d]">
                      <div className="border-r border-[#6b8f4e] px-[18px] py-[11px] text-[15px] font-semibold text-[#1f1f1f]">
                        Category
                      </div>

                      <div className="border-r border-[#6b8f4e] px-[14px] py-[11px] text-center text-[15px] font-semibold text-[#1f1f1f]">
                        Order Placed
                      </div>

                      <div className="border-r border-[#6b8f4e] px-[14px] py-[11px] text-center text-[15px] font-semibold text-[#1f1f1f]">
                        Bill Booked
                      </div>

                      <div className="px-[14px] py-[11px] text-center text-[15px] font-semibold text-[#1f1f1f]">
                        Un-Billed
                      </div>
                    </div>

                    {/* BODY */}
                    {summaryData.rows.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[2.2fr_1fr_1fr_1fr] border-t border-[#6b8f4e]"
                      >
                        <div className="bg-[#b7b5f2] border-r border-[#6b8f4e] px-[18px] py-[9px] text-[15px] font-medium text-[#1f1f1f]">
                          {item.category}
                        </div>

                        <div className="bg-[#ececec] border-r border-[#6b8f4e] px-[16px] py-[9px] text-right text-[15px] font-semibold text-[#1f1f1f]">
                          {formatAmount(item.orderPlaced)}
                        </div>

                        <div className="bg-[#ececec] border-r border-[#6b8f4e] px-[16px] py-[9px] text-right text-[15px] font-semibold text-[#1f1f1f]">
                          {formatAmount(item.billBooked)}
                        </div>

                        <div className="bg-[#ececec] px-[16px] py-[9px] text-right text-[15px] font-semibold text-[#1f1f1f]">
                          {formatAmount(item.unBilled)}
                        </div>
                      </div>
                    ))}

                    {/* TOTAL */}
                    <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr] border-t border-[#6b8f4e]">
                      <div className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-[18px] py-[11px] text-[15px] font-semibold text-[#1f1f1f]">
                        Total Order
                      </div>

                      <div className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-[16px] py-[11px] text-right text-[15px] font-semibold text-[#1f1f1f]">
                        {formatAmount(summaryData.total.orderPlaced)}
                      </div>

                      <div className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-[16px] py-[11px] text-right text-[15px] font-semibold text-[#1f1f1f]">
                        {formatAmount(summaryData.total.billBooked)}
                      </div>

                      <div className="bg-[#b7b7b7] px-[16px] py-[11px] text-right text-[15px] font-semibold text-[#1f1f1f]">
                        {formatAmount(summaryData.total.unBilled)}
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </HeaderWrapper>
    </>
  );
}
