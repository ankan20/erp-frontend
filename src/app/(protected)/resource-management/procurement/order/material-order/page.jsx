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
  DialogClose,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { getFormatCategoryName } from "@/helper/getFormatCategoryName";

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
    if (!projectCode || !access.allowed) {
      return;
    };
    const fetchOrders = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.GET_ALL_ORDER}?projectCode=${projectCode}`,
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
            orderDate: getfmtDisplaydate(p.orderDate),
            partyName: p.partyName || "",
            categoryCode: p.categoryCode || "",
            category: getFormatCategoryName(p.categoryCode) || "",
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

  // SUMMARY
  const summaryData = useMemo(() => {
    const categoryList = [
      { code: "Purchases_Order", label: "Purchases Order" },
      { code: "Customer_Supply_Order", label: "Customer Supply Order" },
      { code: "Site_Transfer_Order", label: "Site Transfer Order" },
    ];

    const summary = categoryList.map(({ code, label: categoryName }) => {
      const categoryRows = filteredData.filter(
        (item) => item.categoryCode === code,
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
        <div className="p-3">
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

          {/* SUMMARY BUTTON + MODAL */}
          <div className="mt-3">
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

              {/* showCloseButton=false — we render our own in the header row for full layout control */}
              <DialogContent
                showCloseButton={false}
                className="w-[95vw] sm:w-auto sm:min-w-[560px] sm:max-w-[680px] p-0 gap-0"
              >
                {/* TITLE ROW with custom close button */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#6b8f4e] bg-[#f5f5f5] rounded-t-xl">
                  <DialogTitle className="text-[16px] font-semibold text-[#1f1f1f]">
                    Order Summary
                  </DialogTitle>
                  <DialogClose className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">
                    <X size={16} className="text-gray-600" />
                  </DialogClose>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto px-4 pt-4 pb-5">
                  <div className="rounded-[10px] border border-[#6b8f4e]">
                    <table className="min-w-[480px] w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="bg-[#efd98d]">
                          <th className="border-r border-[#6b8f4e] px-4 py-2.5 text-left font-semibold text-[#1f1f1f] whitespace-nowrap">
                            Category
                          </th>
                          <th className="border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                            Order Placed
                          </th>
                          <th className="border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                            Bill Booked
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                            Un-Billed
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.rows.map((item, index) => (
                          <tr key={index} className="border-t border-[#6b8f4e]">
                            <td className="bg-[#b7b5f2] border-r border-[#6b8f4e] px-4 py-2.5 font-medium text-[#1f1f1f] whitespace-nowrap">
                              {item.category}
                            </td>
                            <td className="bg-[#ececec] border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                              {formatAmount(item.orderPlaced)}
                            </td>
                            <td className="bg-[#ececec] border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                              {formatAmount(item.billBooked)}
                            </td>
                            <td className="bg-[#ececec] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                              {formatAmount(item.unBilled)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-[#6b8f4e]">
                          <td className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-4 py-2.5 font-semibold text-[#1f1f1f] whitespace-nowrap">
                            Total Order
                          </td>
                          <td className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                            {formatAmount(summaryData.total.orderPlaced)}
                          </td>
                          <td className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                            {formatAmount(summaryData.total.billBooked)}
                          </td>
                          <td className="bg-[#b7b7b7] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">
                            {formatAmount(summaryData.total.unBilled)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
