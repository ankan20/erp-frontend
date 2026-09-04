"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { Loader2 }             from "lucide-react";
import { toast }               from "sonner";

import SearchSection    from "@/components/common/SearchSection";
import PageHeader       from "@/components/layout/PageHeader";
import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions }  from "@/components/common/PageActionButtons";
import { getPageAccess }   from "@/helper/getPageAccess";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN"); } catch { return d; }
};

const fmtAmt = (val) => {
  const n = Number(val);
  return isNaN(n) || n === 0
    ? "—"
    : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const STATUS_CLASSES = {
  Approved:   "bg-green-100 text-green-700",
  Submitted:  "bg-blue-100 text-blue-700",
  Draft:      "bg-gray-100 text-gray-600",
  Rejected:   "bg-red-100 text-red-600",
  Superseded: "bg-red-100 text-red-500",
  Reback:     "bg-yellow-100 text-yellow-700",
};

export default function BudgetListPage() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "petty_cash", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    apiRequest({
      url:    `${API_ENDPOINTS.FINANCE.PETTY_CASH.BUDGET.LIST}?projectCode=${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const list = res.data?.list || res.data || [];
        setData(list);
        setFilteredData(list);
      })
      .catch(() => toast.error("Failed to fetch budget list"))
      .finally(() => setLoading(false));
  }, [projectCode, access.allowed]);

  const handleSearch = ({ search }) => {
    if (!search) { setFilteredData(data); return; }
    const q = search.toLowerCase();
    setFilteredData(
      data.filter((r) =>
        [r.budgetNo, r.month, r.weekMark, r.workflowStatus, r.preparedBy, r.approvedBy].some(
          (v) => String(v || "").toLowerCase().includes(q),
        ),
      ),
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
      <div className="p-3 space-y-3">
        <SearchSection
          onSearch={handleSearch}
          actions={
            access.canAdd
              ? [{ label: "+ Budget", onClick: () => router.push("/finance-management/account/petty-cash/budget/new") }]
              : []
          }
        />

        <div className="border border-[#9e9e9e] overflow-x-auto">
          <table className="w-full border-collapse text-[12px] min-w-[1000px]">
            <thead className="bg-[#144664]">
              <tr>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[45px]">Sl no</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[120px]">Budget ID</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[100px]">Date</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[80px]">Month</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[60px]">Week</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[100px]">From Date</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[100px]">To Date</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-right w-[120px]">Amount</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[110px]">Status</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[130px]">Prepared By</th>
                <th className="border border-[#2e5a72] px-2 py-1.5 text-white font-semibold text-left w-[130px]">Approved By</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">No budgets found</td>
                </tr>
              )}
              {filteredData.map((budget, i) => {
                const isSuperseded = budget.isSuperseded || budget.workflowStatus === "Superseded";
                const statusLabel  = isSuperseded ? "Superseded" : (budget.workflowStatus || "—");
                const statusCls    = STATUS_CLASSES[statusLabel] || "bg-gray-100 text-gray-600";

                const rowCls = isSuperseded
                  ? "bg-red-50 text-red-400 line-through cursor-pointer opacity-70"
                  : i % 2 === 0
                  ? "bg-[#f2f2f2] hover:bg-[#e8f0e8] cursor-pointer"
                  : "bg-white hover:bg-[#e8f0e8] cursor-pointer";

                return (
                  <tr
                    key={budget.id}
                    className={rowCls}
                    onClick={() =>
                      access.canOpenDetails &&
                      router.push(`/finance-management/account/petty-cash/budget/${budget.id}`)
                    }
                  >
                    <td className="border border-[#e6e4e4] px-2 py-1 text-center">{i + 1}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1 font-medium">{budget.budgetNo || "—"}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1">{fmtDate(budget.budgetDate)}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1">{budget.month || "—"}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1">{budget.weekMark || "—"}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1">{fmtDate(budget.fromDate)}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1">{fmtDate(budget.toDate)}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1 text-right font-mono">
                      {fmtAmt(budget.totalAmount ?? budget.totalBudgetedAmount)}
                    </td>
                    <td className="border border-[#e6e4e4] px-2 py-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusCls}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="border border-[#e6e4e4] px-2 py-1">{budget.preparedBy || "—"}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1">{budget.approvedBy || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </HeaderWrapper>
  );
}
