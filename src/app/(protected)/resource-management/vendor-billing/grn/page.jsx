"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import {
  Dialog, DialogContent, DialogClose, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { getFormatCategoryName } from "@/helper/getFormatCategoryName";

const formatAmount = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "billing_by_grn", pageType: "LIST" });

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectCode, setProjectCode] = useState("");

  useEffect(() => {
    const projectInfo = getLocalStorage("projectInfo") || {};
    setProjectCode(projectInfo?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    const fetchBVSList = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.VENDOR_BILLING.BVS.GET_ALL_BVS}?projectCode=${projectCode}`,
          method: "GET",
        });
        const list = res.data || [];
        const formatted = list.map((item, index) => ({
          id: item.id,
          sl: index + 1,
          bvsNo: item.bvsNo,
          bvsDate: getfmtDisplaydate(item.bvsDate),
          partyName: item.partyName || "",
          category: getFormatCategoryName(item.receivedCategory) || "",
          basicAmount: formatAmount(item.basicAmount || 0),
          gstAmount: formatAmount(Number(item.totalAmount) - Number(item.basicAmount)),
          totalAmount: formatAmount(item.totalAmount || 0),
          basicAmountRaw: Number(item.basicAmount || 0),
          gstAmountRaw: Number(item.totalAmount) - Number(item.basicAmount),
          totalAmountRaw: Number(item.totalAmount || 0),
          status:
            item.workflowStatus === "draft" ? "Draft"
            : item.workflowStatus === "reback" ? "Reback"
            : item.workflowStatus === "reject" ? "Reject"
            : item.workflowStatus === "approved" ? "Approved"
            : item.workflowStatus || "",
        }));
        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error(err.message || "Failed to fetch BVS list");
      } finally {
        setLoading(false);
      }
    };
    fetchBVSList();
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];
    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase()),
        ),
      );
    }
    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.bvsDate) return false;
        const itemDate = new Date(item.bvsDate);
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

  const summaryData = useMemo(() => {
    const categoryList = ["PurchasesOrder", "Customer Supply Order", "Site Transfer Order"];
    const rows = categoryList.map((categoryName) => {
      const categoryRows = filteredData.filter((item) => item.category === categoryName);
      return {
        category: categoryName,
        basicAmount: categoryRows.reduce((s, i) => s + i.basicAmountRaw, 0),
        gstAmount: categoryRows.reduce((s, i) => s + i.gstAmountRaw, 0),
        totalAmount: categoryRows.reduce((s, i) => s + i.totalAmountRaw, 0),
      };
    });
    return {
      rows,
      total: {
        basicAmount: rows.reduce((s, r) => s + r.basicAmount, 0),
        gstAmount: rows.reduce((s, r) => s + r.gstAmount, 0),
        totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
      },
    };
  }, [filteredData]);

  const columns = [
    { header: "Sl. no", accessor: "sl" },
    { header: "BVS No", accessor: "bvsNo" },
    { header: "Date", accessor: "bvsDate" },
    { header: "Party Name", accessor: "partyName" },
    { header: "Category", accessor: "category" },
    { header: "Basic", accessor: "basicAmount" },
    { header: "GST", accessor: "gstAmount" },
    { header: "Total", accessor: "totalAmount" },
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
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="relative min-h-[calc(100vh-220px)] p-3 overflow-hidden">
        <SearchSection
          onSearch={handleSearch}
          showDateRange={true}
          actions={
            access.canAdd
              ? [
                  {
                    label: "+ Create BVS",
                    onClick: () => router.push("/resource-management/vendor-billing/grn/new"),
                  },
                ]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            router.push(`/resource-management/vendor-billing/grn/${row.id}`);
          }}
        />

        {/* SUMMARY MODAL */}
        <div className="absolute bottom-[18px] left-[18px] z-30">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="h-[34px] min-w-[170px] rounded-[8px] border border-[#7f6f52] bg-[#efb17f] px-[22px] text-[14px] font-medium text-[#1f1f1f] shadow-[inset_0px_1px_0px_#ffd8bb] transition-all duration-200 hover:brightness-[0.98] active:scale-[0.99]"
              >
                Show Summary
              </button>
            </DialogTrigger>

            <DialogContent showCloseButton={false} className="w-[95vw] sm:w-auto sm:min-w-[580px] sm:max-w-[720px] p-0 gap-0">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#6b8f4e] bg-[#f5f5f5] rounded-t-xl">
                <DialogTitle className="text-[16px] font-semibold text-[#1f1f1f]">
                  BVS Summary
                </DialogTitle>
                <DialogClose className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">
                  <X size={16} className="text-gray-600" />
                </DialogClose>
              </div>

              <div className="overflow-x-auto px-4 pt-4 pb-5">
                <div className="rounded-[10px] border border-[#6b8f4e]">
                  <table className="min-w-[500px] w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-[#efd98d]">
                        <th className="border-r border-[#6b8f4e] px-4 py-2.5 text-left font-semibold text-[#1f1f1f] whitespace-nowrap">Category</th>
                        <th className="border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">Basic Amount</th>
                        <th className="border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">GST Amount</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.rows.map((item, index) => (
                        <tr key={index} className="border-t border-[#6b8f4e]">
                          <td className="bg-[#b7b5f2] border-r border-[#6b8f4e] px-4 py-2.5 font-medium text-[#1f1f1f] whitespace-nowrap">{item.category}</td>
                          <td className="bg-[#ececec] border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">{formatAmount(item.basicAmount)}</td>
                          <td className="bg-[#ececec] border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">{formatAmount(item.gstAmount)}</td>
                          <td className="bg-[#ececec] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">{formatAmount(item.totalAmount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-[#6b8f4e]">
                        <td className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-4 py-2.5 font-semibold text-[#1f1f1f] whitespace-nowrap">Grand Total</td>
                        <td className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">{formatAmount(summaryData.total.basicAmount)}</td>
                        <td className="bg-[#b7b7b7] border-r border-[#6b8f4e] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">{formatAmount(summaryData.total.gstAmount)}</td>
                        <td className="bg-[#b7b7b7] px-4 py-2.5 text-right font-semibold text-[#1f1f1f] whitespace-nowrap">{formatAmount(summaryData.total.totalAmount)}</td>
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
  );
}
