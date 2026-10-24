"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import { toast } from "sonner";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";

const STATUS_COLOR = {
  Completed:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Pending:     "bg-gray-100 text-gray-500 border-gray-200",
};

function ProgressRing({ pct, size = 48 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct === 100 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .5s ease" }} />
    </svg>
  );
}

export default function OnboardingPage() {
  const access = getPageAccess({ pageCode: "onboarding", pageType: "LIST" });
  const router = useRouter();
  const [list, setList] = useState([]);
  const [stats, setStats] = useState({});
  const [joinedCandidates, setJoinedCandidates] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showInitModal, setShowInitModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [initing, setIniting] = useState(false);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "joined"

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [listRes, statsRes, joinedRes] = await Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.ONBOARDING.LIST, method: "GET", params: { search } }),
      apiRequest({ url: API_ENDPOINTS.HR.ONBOARDING.STATS, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_LIST, method: "GET", params: { stage: "Joined" } }),
    ]);
    if (listRes?.data) setList(listRes.data);
    if (statsRes?.data) setStats(statsRes.data);
    if (joinedRes?.data) setJoinedCandidates(joinedRes.data);
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

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions([
    ...(access.canAdd ? [{ label: "Start Onboarding", onClick: () => setShowInitModal(true), variant: "primary" }] : []),
  ]);

  const pendingJoined = joinedCandidates.filter(c =>
    !list.some(e => e.full_name?.toLowerCase() === c.name?.toLowerCase())
  );

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 space-y-4">

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Onboarding", value: stats.total_onboarding ?? 0, color: "text-blue-700", bg: "bg-blue-50", icon: "👥" },
            { label: "Completed", value: stats.completed ?? 0, color: "text-emerald-600", bg: "bg-emerald-50", icon: "✅" },
            { label: "In Progress", value: stats.in_progress ?? 0, color: "text-yellow-600", bg: "bg-yellow-50", icon: "⏳" },
            { label: "Pending Start", value: (stats.pending ?? 0) + pendingJoined.length, color: "text-gray-500", bg: "bg-gray-50", icon: "📋" },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} rounded-xl border border-gray-200 p-4 flex items-center gap-3`}>
              <span className="text-2xl">{kpi.icon}</span>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-3xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200 bg-white -mx-4 px-4">
          {[
            ["active", "Active Onboardings", list.length],
            ["joined", `Joined Awaiting Onboarding`, pendingJoined.length],
          ].map(([key, label, count]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === key ? "border-blue-700 text-blue-700 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {label}
              {count > 0 && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${key === "joined" && count > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>{count}</span>}
            </button>
          ))}
        </div>

        {/* Search (only for active tab) */}
        {activeTab === "active" && (
          <input type="text" placeholder="Search employee..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : activeTab === "active" ? (
          /* ── Active Onboardings ── */
          list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <p className="text-lg">No onboarding records found</p>
              {access.canAdd && <button onClick={() => setShowInitModal(true)} className="text-sm text-blue-600 hover:underline">Start onboarding for an employee →</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.map((emp) => (
                <div key={emp.id} onClick={() => router.push(`/hr-management/employee/onboarding/${emp.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group">
                  <div className="flex items-start gap-3">
                    <ProgressRing pct={emp.progress_pct} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors truncate">{emp.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{emp.designation || "—"} · {emp.department || "—"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{emp.emp_code} · Joined {emp.date_of_joining || "—"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-blue-700">{emp.progress_pct}%</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{emp.done_tasks}/{emp.total_tasks} tasks done</span>
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_COLOR[emp.onboarding_status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {emp.onboarding_status}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${emp.progress_pct === 100 ? "bg-emerald-500" : emp.progress_pct >= 50 ? "bg-blue-500" : "bg-yellow-400"}`}
                        style={{ width: `${emp.progress_pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-blue-600 group-hover:underline text-right">View Checklist →</div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ── Joined Candidates Awaiting Onboarding ── */
          pendingJoined.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <p className="text-lg">No joined candidates pending onboarding</p>
              <p className="text-sm">Candidates who complete the joining process appear here</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-orange-50">
                <p className="text-sm font-medium text-orange-700">These candidates joined through recruitment and need onboarding to be started.</p>
                <p className="text-xs text-orange-600 mt-0.5">Creating an employee record and onboarding checklist is done automatically when you mark a candidate as Joined in Recruitment.</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    {["Candidate", "Role Applied", "Source", "Stage", "Action"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingJoined.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {c.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{c.job_title || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.source || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Joined</span>
                      </td>
                      <td className="px-4 py-3">
                        {access.canAdd && (
                          <button onClick={() => { setShowInitModal(true); }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-700 text-white hover:bg-blue-800">
                            Start Onboarding
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Init Onboarding Modal */}
      {showInitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Start Onboarding</h2>
            <p className="text-sm text-gray-600">Select an employee to initialise the default onboarding checklist (19 tasks across 5 categories).</p>
            <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select employee...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.emp_code} – {e.full_name}</option>)}
            </select>
            <p className="text-xs text-gray-400">Tip: Employees auto-created when a candidate is marked Joined in Recruitment will appear here.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInitModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={initOnboarding} disabled={!selectedEmpId || initing}
                className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60">
                {initing ? "Initialising..." : "Start"}
              </button>
            </div>
          </div>
        </div>
      )}
    </HeaderWrapper>
  );
}
