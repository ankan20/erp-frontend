"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";

const STATUS_STYLE = {
  Active:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  Inactive:    "bg-red-100 text-red-700 border-red-200",
  "On Notice": "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const TYPE_COLOR = {
  "Full-time": { bar: "bg-blue-500",   hex: "#3b82f6", badge: "bg-blue-50 text-blue-700" },
  Contract:    { bar: "bg-purple-500", hex: "#a855f7", badge: "bg-purple-50 text-purple-700" },
  Intern:      { bar: "bg-pink-500",   hex: "#ec4899", badge: "bg-pink-50 text-pink-700" },
  "Part-time": { bar: "bg-gray-400",   hex: "#9ca3af", badge: "bg-gray-100 text-gray-600" },
};

const DEPT_COLORS = ["bg-blue-500","bg-indigo-500","bg-violet-500","bg-fuchsia-500","bg-pink-500","bg-rose-500","bg-orange-500","bg-amber-500","bg-teal-500","bg-cyan-500"];

const RATING_BANDS = [
  { label: "Outstanding",          range: "4.5 – 5.0", min: 4.5, max: 5.0,  barColor: "bg-emerald-500", hex: "#10b981", stars: 5 },
  { label: "Exceeds Expectations", range: "4.0 – 4.4", min: 4.0, max: 4.49, barColor: "bg-blue-500",    hex: "#3b82f6", stars: 4 },
  { label: "Meets Expectations",   range: "3.0 – 3.9", min: 3.0, max: 3.99, barColor: "bg-amber-400",   hex: "#fbbf24", stars: 3 },
  { label: "Needs Improvement",    range: "2.0 – 2.9", min: 2.0, max: 2.99, barColor: "bg-orange-400",  hex: "#fb923c", stars: 2 },
  { label: "Unsatisfactory",       range: "< 2.0",     min: 0,   max: 1.99, barColor: "bg-red-400",     hex: "#f87171", stars: 1 },
];

// Donut chart built from SVG — no library needed
function DonutChart({ segments, size = 130, hole = 0.62 }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 6, r = R * hole;
  let start = -Math.PI / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        if (!seg.value) return null;
        const sweep = (seg.value / total) * 2 * Math.PI;
        const end = start + sweep;
        const large = sweep > Math.PI ? 1 : 0;
        const cos = (a) => Math.cos(a), sin = (a) => Math.sin(a);
        const path = [
          `M ${cx + R * cos(start)} ${cy + R * sin(start)}`,
          `A ${R} ${R} 0 ${large} 1 ${cx + R * cos(end)} ${cy + R * sin(end)}`,
          `L ${cx + r * cos(end)} ${cy + r * sin(end)}`,
          `A ${r} ${r} 0 ${large} 0 ${cx + r * cos(start)} ${cy + r * sin(start)}`,
          "Z",
        ].join(" ");
        const el = <path key={i} d={path} fill={seg.color} className="transition-all" />;
        start = end;
        return el;
      })}
    </svg>
  );
}

function Stars({ count, size = "w-3 h-3" }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <svg key={i} className={`${size} ${i <= count ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

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
  const access = getPageAccess({ pageCode: "employee_management", pageType: "LIST" });
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departments, setDepartments] = useState([]);
  const [reviews, setReviews] = useState([]);

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
    apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.REVIEWS_LIST, method: "GET" })
      .then((r) => r?.data && setReviews(r.data));
  }, []);

  const actions = getPageActions([
    ...(access.canAdd ? [{ label: "+ Add Employee", onClick: () => router.push("/hr-management/employee/new"), variant: "primary" }] : []),
  ]);

  // KPI counts
  const active   = employees.filter((e) => e.employee_status === "Active").length;
  const onNotice = employees.filter((e) => e.employee_status === "On Notice").length;
  const inactive = employees.filter((e) => e.employee_status === "Inactive").length;
  const fullTime = employees.filter((e) => e.employment_type === "Full-time").length;

  // Rating distribution from performance reviews
  const ratingBandCounts = RATING_BANDS.map((b) => ({
    ...b,
    count: reviews.filter((r) => {
      const v = parseFloat(r.rating);
      return !isNaN(v) && v >= b.min && v <= b.max;
    }).length,
  }));
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + (parseFloat(r.rating) || 0), 0) / reviews.length).toFixed(1)
    : null;

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

  if (!access.allowed) return <PageNotAvailable />;

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
                {access.canAdd && (
                  <button onClick={() => router.push("/hr-management/employee/new")} className="text-sm text-blue-600 hover:underline">
                    Add first employee →
                  </button>
                )}
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

            {/* Rating Distribution — donut + bars */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-0.5">⭐ Rating Distribution</p>
              <p className="text-xs text-gray-400 mb-3">{reviews.length} performance review{reviews.length !== 1 ? "s" : ""}</p>
              {reviews.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No reviews yet</p>
              ) : (
                <>
                  {/* Donut chart */}
                  <div className="flex items-center justify-center mb-4 relative">
                    <DonutChart
                      size={130}
                      segments={ratingBandCounts.map((b) => ({ value: b.count, color: b.hex }))}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-gray-800">{avgRating ?? "—"}</span>
                      <span className="text-[10px] text-gray-400">avg rating</span>
                    </div>
                  </div>
                  {/* Legend rows */}
                  <div className="space-y-2">
                    {ratingBandCounts.map((b) => (
                      <div key={b.label} className="flex items-center gap-2">
                        <Stars count={b.stars} size="w-2.5 h-2.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] text-gray-600 truncate">{b.label}</span>
                            <span className="text-[11px] font-bold text-gray-700 ml-1 flex-shrink-0">{b.count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${reviews.length ? (b.count / reviews.length) * 100 : 0}%`, backgroundColor: b.hex }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 w-7 text-right flex-shrink-0">
                          {reviews.length ? Math.round((b.count / reviews.length) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Employment Type — donut + legend */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">📊 Employment Type</p>
              {typeCounts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 relative">
                      <DonutChart size={100}
                        segments={typeCounts.map((t) => ({ value: t.count, color: TYPE_COLOR[t.type]?.hex || "#9ca3af" }))}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-lg font-bold text-gray-700">{employees.length}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {typeCounts.map((t) => (
                        <div key={t.type} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLOR[t.type]?.hex || "#9ca3af" }} />
                          <span className="text-xs text-gray-600 flex-1 truncate">{t.type}</span>
                          <span className="text-xs font-bold text-gray-700">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Department Distribution — bar chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">🏬 Department Distribution</p>
              {deptCounts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {deptCounts.map((d, i) => (
                    <div key={d.dept} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 w-24 truncate flex-shrink-0">{d.dept}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                        <div className={`h-full ${DEPT_COLORS[i % DEPT_COLORS.length]} rounded transition-all`}
                          style={{ width: `${employees.length ? (d.count / employees.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-gray-600 w-5 text-right flex-shrink-0">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status — donut + legend */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">🔵 Status Overview</p>
              {employees.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 relative">
                    <DonutChart size={100}
                      segments={[
                        { value: active,   color: "#10b981" },
                        { value: onNotice, color: "#fbbf24" },
                        { value: inactive, color: "#f87171" },
                      ]}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-lg font-bold text-gray-700">{employees.length}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { label: "Active",    count: active,   hex: "#10b981" },
                      { label: "On Notice", count: onNotice, hex: "#fbbf24" },
                      { label: "Inactive",  count: inactive, hex: "#f87171" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.hex }} />
                        <span className="text-xs text-gray-600 flex-1">{s.label}</span>
                        <span className="text-xs font-bold text-gray-700">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </HeaderWrapper>
  );
}
