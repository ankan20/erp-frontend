"use client";

import { useState, useEffect, useCallback } from "react";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import { toast } from "sonner";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COLUMNS = [
  { key: "emp_code", label: "Emp Code" },
  { key: "name", label: "Employee" },
  { key: "dept", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "days_worked", label: "Days" },
  { key: "gross", label: "Gross (₹)" },
  { key: "total_deductions", label: "Deductions (₹)" },
  { key: "net_pay", label: "Net Pay (₹)" },
  { key: "status", label: "Status", isStatus: true },
];

function fmt(n) {
  return (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function PayrollPage() {
  const access = getPageAccess({ pageCode: "payroll", pageType: "LIST" });
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [deptData, setDeptData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showPayslip, setShowPayslip] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;

    const [payrollRes, deptRes] = await Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.PAYROLL.LIST, method: "GET", params }),
      apiRequest({ url: API_ENDPOINTS.HR.PAYROLL.DEPARTMENT_SUMMARY, method: "GET", params: { month, year } }),
    ]);

    if (payrollRes?.data) {
      setEntries(payrollRes.data.entries || []);
      setSummary(payrollRes.data.summary || {});
    }
    if (deptRes?.data) setDeptData(deptRes.data);
    setLoading(false);
  }, [month, year, statusFilter, search]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  const openPayslip = async (row) => {
    const res = await apiRequest({ url: `${API_ENDPOINTS.HR.PAYROLL.PAYSLIP}${row.id}`, method: "GET" });
    if (res?.data) { setSelectedEntry(res.data); setShowPayslip(true); }
  };

  const runPayroll = async () => {
    setRunning(true);
    const res = await apiRequest({
      url: API_ENDPOINTS.HR.PAYROLL.RUN,
      method: "POST",
      data: { month: Number(month), year: Number(year) },
    });
    setRunning(false);
    setShowRunModal(false);
    if (res?.data) { toast.success("Payroll run created"); fetchPayroll(); }
  };

  const maxDept = Math.max(...deptData.map((d) => d.gross), 1);

  const actions = getPageActions([
    ...(access.canAdd ? [{ label: "Run Payroll", onClick: () => setShowRunModal(true), variant: "primary" }] : []),
  ]);

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Gross Payroll", value: `₹${fmt(summary.gross_total)}`, color: "text-blue-700" },
            { label: "Net Disbursed", value: `₹${fmt(summary.net_total)}`, color: "text-emerald-600" },
            { label: "Total Deductions", value: `₹${fmt(summary.deductions_total)}`, color: "text-red-500" },
            { label: "Pending Count", value: summary.pending_count ?? 0, color: "text-yellow-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[2024, 2025, 2026].map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option>Paid</option><option>Pending</option><option>On Hold</option>
          </select>
          <input type="text" placeholder="Search employee..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : (
          <div className="flex gap-4 flex-col xl:flex-row">
            {/* Main Table */}
            <div className="flex-1">
              <DataTable columns={COLUMNS} data={entries} onRowClick={openPayslip} />
            </div>

            {/* Department Bar Chart */}
            {deptData.length > 0 && (
              <div className="w-full xl:w-72 bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Dept-wise Gross Payroll</h3>
                <div className="space-y-2">
                  {deptData.map((d) => (
                    <div key={d.department}>
                      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                        <span className="truncate max-w-[120px]">{d.department}</span>
                        <span>₹{fmt(d.gross)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${(d.gross / maxDept) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Run Payroll Modal */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Run Payroll</h2>
            <p className="text-sm text-gray-600">
              This will generate payroll entries for all active employees for{" "}
              <strong>{MONTHS[Number(month) - 1]} {year}</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRunModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={runPayroll} disabled={running} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60">
                {running ? "Processing..." : "Confirm Run"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Modal */}
      {showPayslip && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 my-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Payslip</h2>
              <button onClick={() => setShowPayslip(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4 border-b pb-4">
              <div>
                <p className="text-gray-500 text-xs">Employee</p>
                <p className="font-medium">{selectedEntry.name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Employee Code</p>
                <p className="font-medium">{selectedEntry.emp_code}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Department</p>
                <p className="font-medium">{selectedEntry.dept}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Designation</p>
                <p className="font-medium">{selectedEntry.designation}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Period</p>
                <p className="font-medium">{MONTHS[(selectedEntry.month || 1) - 1]} {selectedEntry.year}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Days Worked</p>
                <p className="font-medium">{selectedEntry.days_worked} / {selectedEntry.working_days}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Earnings</h4>
                <div className="space-y-1">
                  {[["Basic", "basic"], ["HRA", "hra"], ["Special Allowance", "special_allowance"], ["Other Allowances", "other_allowances"], ["Bonus", "bonus"]].map(([label, key]) => (
                    <div key={key} className="flex justify-between text-gray-600">
                      <span>{label}</span>
                      <span>₹{fmt(selectedEntry[key])}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-1 text-gray-800">
                    <span>Gross</span>
                    <span>₹{fmt(selectedEntry.gross)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Deductions</h4>
                <div className="space-y-1">
                  {[["Provident Fund (PF)", "pf"], ["ESI", "esi"], ["Professional Tax (PT)", "pt"], ["TDS", "tds"], ["Loss of Pay (LOP)", "lop"]].map(([label, key]) => (
                    <div key={key} className="flex justify-between text-gray-600">
                      <span>{label}</span>
                      <span>₹{fmt(selectedEntry[key])}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-1 text-gray-800">
                    <span>Total Deductions</span>
                    <span>₹{fmt(selectedEntry.total_deductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-blue-700 text-white rounded-lg px-4 py-3 flex justify-between items-center">
              <span className="font-semibold">Net Pay</span>
              <span className="text-xl font-bold">₹{fmt(selectedEntry.net_pay)}</span>
            </div>
          </div>
        </div>
      )}
    </HeaderWrapper>
  );
}
