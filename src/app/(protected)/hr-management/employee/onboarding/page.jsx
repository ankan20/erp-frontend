"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import { toast } from "sonner";

const STATUS_COLOR = {
  Completed: "bg-emerald-100 text-emerald-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Pending: "bg-gray-100 text-gray-600",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [list, setList] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showInitModal, setShowInitModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [initing, setIniting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [listRes, statsRes] = await Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.ONBOARDING.LIST, method: "GET", params: { search } }),
      apiRequest({ url: API_ENDPOINTS.HR.ONBOARDING.STATS, method: "GET" }),
    ]);
    if (listRes?.data) setList(listRes.data);
    if (statsRes?.data) setStats(statsRes.data);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.HR.EMPLOYEE.LIST, method: "GET" }).then(
      (r) => r?.data && setEmployees(r.data)
    );
  }, []);

  const initOnboarding = async () => {
    if (!selectedEmpId) return;
    setIniting(true);
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.ONBOARDING.INIT}${selectedEmpId}/init`,
      method: "POST",
      data: {},
    });
    setIniting(false);
    if (res?.data) {
      toast.success("Onboarding initialised");
      setShowInitModal(false);
      setSelectedEmpId("");
      fetchData();
    }
  };

  const actions = getPageActions([
    { label: "Start Onboarding", onClick: () => setShowInitModal(true), variant: "primary" },
  ]);

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Onboarding", value: stats.total_onboarding ?? 0, color: "text-blue-700" },
            { label: "Completed", value: stats.completed ?? 0, color: "text-emerald-600" },
            { label: "In Progress", value: stats.in_progress ?? 0, color: "text-yellow-600" },
            { label: "Pending", value: stats.pending ?? 0, color: "text-gray-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <p className="text-lg">No onboarding records found</p>
            <p className="text-sm">Click "Start Onboarding" to initialise for an employee</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Employee</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Department</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Date of Joining</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Progress</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/hr-management/employee/onboarding/${emp.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {emp.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{emp.full_name}</p>
                          <p className="text-xs text-gray-400">{emp.emp_code} · {emp.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.department || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.date_of_joining || "—"}</td>
                    <td className="px-4 py-3 w-48">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{ width: `${emp.progress_pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {emp.done_tasks}/{emp.total_tasks}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[emp.onboarding_status] || "bg-gray-100 text-gray-600"}`}>
                        {emp.onboarding_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/hr-management/employee/onboarding/${emp.id}`); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View Checklist →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Init Onboarding Modal */}
      {showInitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Start Onboarding</h2>
            <p className="text-sm text-gray-600">Select an employee to initialise the default onboarding checklist.</p>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.emp_code} – {e.full_name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInitModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={initOnboarding} disabled={!selectedEmpId || initing} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60">
                {initing ? "Initialising..." : "Start"}
              </button>
            </div>
          </div>
        </div>
      )}
    </HeaderWrapper>
  );
}
