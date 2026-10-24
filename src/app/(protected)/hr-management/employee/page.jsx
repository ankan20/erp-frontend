"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";

const STATUS_STYLE = {
  Active:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  Inactive:   "bg-red-100 text-red-700 border-red-200",
  "On Notice": "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const TYPE_STYLE = {
  "Full-time": "bg-blue-100 text-blue-700",
  Contract:    "bg-purple-100 text-purple-700",
  Intern:      "bg-pink-100 text-pink-700",
  "Part-time": "bg-gray-100 text-gray-600",
};

export default function EmployeeMasterPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departments, setDepartments] = useState([]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (deptFilter) params.department = deptFilter;
    if (statusFilter) params.status = statusFilter;

    const res = await apiRequest({ url: API_ENDPOINTS.HR.EMPLOYEE.LIST, method: "GET", params });
    if (res?.data) setEmployees(res.data);
    setLoading(false);
  }, [search, deptFilter, statusFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.HR.EMPLOYEE.DEPARTMENTS, method: "GET" })
      .then((r) => r?.data && setDepartments(r.data));
  }, []);

  const actions = getPageActions([
    { label: "Add Employee", onClick: () => router.push("/hr-management/employee/new"), variant: "primary" },
  ]);

  // KPI counts
  const active = employees.filter((e) => e.employee_status === "Active").length;
  const onNotice = employees.filter((e) => e.employee_status === "On Notice").length;
  const inactive = employees.filter((e) => e.employee_status === "Inactive").length;

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 space-y-4">

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Employees", value: employees.length, color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Active", value: active, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "On Notice", value: onNotice, color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Inactive", value: inactive, color: "text-red-500", bg: "bg-red-50" },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} rounded-xl border border-gray-200 p-4`}>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="Search name, code, designation..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Notice">On Notice</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <p className="text-lg">No employees found</p>
            <button onClick={() => router.push("/hr-management/employee/new")} className="text-sm text-blue-600 hover:underline">
              Add first employee →
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    {["Employee", "Emp Code", "Department", "Designation", "Type", "DOJ", "Reporting Manager", "CTC (Annual)", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} onClick={() => router.push(`/hr-management/employee/${emp.id}`)}
                      className="hover:bg-blue-50 cursor-pointer group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {emp.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 group-hover:text-blue-700 transition-colors">{emp.full_name}</p>
                            <p className="text-xs text-gray-400">{emp.work_email || emp.personal_email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{emp.emp_code}</td>
                      <td className="px-4 py-3">
                        {emp.department ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{emp.department}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{emp.designation || "—"}</td>
                      <td className="px-4 py-3">
                        {emp.employment_type ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[emp.employment_type] || "bg-gray-100 text-gray-600"}`}>
                            {emp.employment_type}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{emp.date_of_joining || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{emp.reporting_manager || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {emp.ctc_annual ? `₹ ${Number(emp.ctc_annual).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[emp.employee_status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {emp.employee_status || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              Showing {employees.length} employee{employees.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
