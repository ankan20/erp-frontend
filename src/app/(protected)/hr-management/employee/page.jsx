"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";

const STATUS_STYLE = {
  Active:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  Inactive:    "bg-red-100 text-red-700 border-red-200",
  "On Notice": "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const TYPE_COLOR = {
  "Full-time": { bar: "bg-blue-500",   badge: "bg-blue-50 text-blue-700" },
  Contract:    { bar: "bg-purple-500", badge: "bg-purple-50 text-purple-700" },
  Intern:      { bar: "bg-pink-500",   badge: "bg-pink-50 text-pink-700" },
  "Part-time": { bar: "bg-gray-400",   badge: "bg-gray-100 text-gray-600" },
};

const DEPT_COLORS = ["bg-blue-500","bg-indigo-500","bg-violet-500","bg-fuchsia-500","bg-pink-500","bg-rose-500","bg-orange-500","bg-amber-500","bg-teal-500","bg-cyan-500"];

function DistBar({ label, count, total, colorClass, badge }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-700 font-medium truncate max-w-[160px]">{label}</span>
        <span className="text-gray-400 ml-2 flex-shrink-0">{count} · {pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
    { label: "+ Add Employee", onClick: () => router.push("/hr-management/employee/new"), variant: "primary" },
  ]);

  // KPI counts
  const active   = employees.filter((e) => e.employee_status === "Active").length;
  const onNotice = employees.filter((e) => e.employee_status === "On Notice").length;
  const inactive = employees.filter((e) => e.employee_status === "Inactive").length;
  const fullTime = employees.filter((e) => e.employment_type === "Full-time").length;

  // Dept distribution (unfiltered for sidebar)
  const deptCounts = departments.map((d) => ({
    dept: d,
    count: employees.filter((e) => e.department === d).length,
  })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);

  // Employment type distribution
  const typeCounts = Object.keys(TYPE_COLOR).map((t) => ({
    type: t,
    count: employees.filter((e) => e.employment_type === t).length,
  })).filter((x) => x.count > 0);

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 space-y-4">

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Employees", value: employees.length, icon: "👥", color: "text-blue-700", bg: "bg-blue-50 border-blue-100", sub: `${departments.length} departments` },
            { label: "Active",          value: active,   icon: "✅", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", sub: `${employees.length ? Math.round((active/employees.length)*100) : 0}% of total` },
            { label: "On Notice",       value: onNotice, icon: "⚠️", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100", sub: "Serving notice period" },
            { label: "Full-time",       value: fullTime, icon: "🏢", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", sub: `${inactive} inactive` },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} rounded-xl border p-4 flex items-start gap-3`}>
              <div className="text-2xl mt-0.5 flex-shrink-0">{k.icon}</div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
                <p className={`text-3xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main body: table + sidebar */}
        <div className="flex gap-4 flex-col xl:flex-row items-start">

          {/* Employee Register */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Table header bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">📋 Employee Register</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{employees.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                  </svg>
                  <input type="text" placeholder="Search name, code, role..."
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 text-xs w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Notice">On Notice</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading employees...</div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                <p className="text-base font-medium">No employees found</p>
                <button onClick={() => router.push("/hr-management/employee/new")} className="text-sm text-blue-600 hover:underline">
                  Add first employee →
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-left">
                        {["Employee", "Department", "Designation", "Type", "Date of Joining", "CTC (Annual)", "Status"].map((h) => (
                          <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {employees.map((emp) => (
                        <tr key={emp.id} onClick={() => router.push(`/hr-management/employee/${emp.id}`)}
                          className="hover:bg-blue-50/60 cursor-pointer group transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                                {emp.full_name?.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">{emp.full_name}</p>
                                <p className="text-xs text-gray-400 font-mono">{emp.emp_code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {emp.department
                              ? <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{emp.department}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{emp.designation || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3">
                            {emp.employment_type
                              ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[emp.employment_type]?.badge || "bg-gray-100 text-gray-600"}`}>{emp.employment_type}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{emp.date_of_joining || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap font-medium">
                            {emp.ctc_annual ? `₹ ${Number(emp.ctc_annual).toLocaleString("en-IN")}` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[emp.employee_status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                              {emp.employee_status || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-blue-500 group-hover:text-blue-700 font-medium whitespace-nowrap">View →</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-gray-50 bg-gray-50 text-xs text-gray-400">
                  Showing {employees.length} employee{employees.length !== 1 ? "s" : ""}
                  {(deptFilter || statusFilter || search) && " (filtered)"}
                </div>
              </>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-full xl:w-72 flex-shrink-0 space-y-4">

            {/* Department Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700">🏬 Department Distribution</span>
              </div>
              {deptCounts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {deptCounts.map((d, i) => (
                    <DistBar key={d.dept} label={d.dept} count={d.count} total={employees.length}
                      colorClass={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </div>
              )}
            </div>

            {/* Employment Type Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700">📊 Employment Type</span>
              </div>
              {typeCounts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {typeCounts.map((t) => (
                    <DistBar key={t.type} label={t.type} count={t.count} total={employees.length}
                      colorClass={TYPE_COLOR[t.type]?.bar || "bg-gray-400"} />
                  ))}
                </div>
              )}
            </div>

            {/* Status Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700">🔵 Status Overview</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Active",    count: active,   colorClass: "bg-emerald-500" },
                  { label: "On Notice", count: onNotice, colorClass: "bg-yellow-400" },
                  { label: "Inactive",  count: inactive, colorClass: "bg-red-400" },
                ].filter((s) => employees.length > 0).map((s) => (
                  <DistBar key={s.label} label={s.label} count={s.count} total={employees.length} colorClass={s.colorClass} />
                ))}
                {employees.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No data yet</p>}
              </div>
            </div>

          </div>
        </div>
      </div>
    </HeaderWrapper>
  );
}
