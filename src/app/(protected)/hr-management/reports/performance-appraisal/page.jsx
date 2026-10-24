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

const REVIEW_COLS = [
  { key: "emp_code", label: "Emp Code" },
  { key: "name", label: "Employee" },
  { key: "dept", label: "Department" },
  { key: "cycle_name", label: "Cycle" },
  { key: "rating", label: "Rating" },
  { key: "goals_completion_pct", label: "Goals %" },
  { key: "next_review_date", label: "Next Review" },
  { key: "status", label: "Status", isStatus: true },
];

const DISCIPLINE_COLS = [
  { key: "case_code", label: "Case ID" },
  { key: "name", label: "Employee" },
  { key: "dept", label: "Department" },
  { key: "incident_type", label: "Incident Type" },
  { key: "incident_date", label: "Date" },
  { key: "severity", label: "Severity" },
  { key: "action_taken", label: "Action Taken" },
  { key: "status", label: "Status", isStatus: true },
];

const SEVERITIES = ["Low", "Medium", "High", "Critical"];
const EMPTY_REVIEW = { employee_id: "", cycle_name: "", rating: "", goals_completion_pct: "", status: "Pending", notes: "" };
const EMPTY_DISCIPLINE = { employee_id: "", incident_type: "", severity: "Low", incident_date: "", action_taken: "", description: "", status: "Active" };

function StarRating({ value }) {
  const n = Math.round(parseFloat(value) || 0);
  return (
    <span className="text-yellow-400">
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}

export default function PerformancePage() {
  const access = getPageAccess({ pageCode: "performance", pageType: "LIST" });
  const [tab, setTab] = useState(0); // 0=Reviews, 1=Discipline, 2=PIP
  const [reviews, setReviews] = useState([]);
  const [discipline, setDiscipline] = useState([]);
  const [reviewStats, setReviewStats] = useState({});
  const [discStats, setDiscStats] = useState({});
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [discSearch, setDiscSearch] = useState("");
  const [discSeverity, setDiscSeverity] = useState("");
  const [discStatus, setDiscStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDiscModal, setShowDiscModal] = useState(false);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW);
  const [discForm, setDiscForm] = useState(EMPTY_DISCIPLINE);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedDisc, setSelectedDisc] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [rv, dc, rs, ds] = await Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.REVIEWS_LIST, method: "GET", params: { search: reviewSearch, status: reviewStatus } }),
      apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.DISCIPLINE_LIST, method: "GET", params: { search: discSearch, severity: discSeverity, status: discStatus } }),
      apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.REVIEWS_STATS, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.DISCIPLINE_STATS, method: "GET" }),
    ]);
    if (rv?.data) setReviews(rv.data);
    if (dc?.data) setDiscipline(dc.data);
    if (rs?.data) setReviewStats(rs.data);
    if (ds?.data) setDiscStats(ds.data);
    setLoading(false);
  }, [reviewSearch, reviewStatus, discSearch, discSeverity, discStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createReview = async () => {
    const res = await apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.REVIEWS_CREATE, method: "POST", data: { ...reviewForm, employee_id: Number(reviewForm.employee_id), rating: parseFloat(reviewForm.rating) || null, goals_completion_pct: parseInt(reviewForm.goals_completion_pct) || null } });
    if (res?.data) { toast.success("Review created"); setShowReviewModal(false); setReviewForm(EMPTY_REVIEW); fetchData(); }
  };

  const createDisc = async () => {
    const res = await apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.DISCIPLINE_CREATE, method: "POST", data: { ...discForm, employee_id: Number(discForm.employee_id) } });
    if (res?.data) { toast.success("Discipline case created"); setShowDiscModal(false); setDiscForm(EMPTY_DISCIPLINE); fetchData(); }
  };

  const pipList = reviews.filter((r) => r.pip_active);

  const sevColor = (s) => {
    if (s === "Critical") return "bg-red-100 text-red-700";
    if (s === "High") return "bg-orange-100 text-orange-700";
    if (s === "Medium") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  };

  if (!access.allowed) return <PageNotAvailable />;

  const actions = getPageActions(
    access.canAdd
      ? tab === 0
        ? [{ label: "Add Review", onClick: () => setShowReviewModal(true), variant: "primary" }]
        : tab === 1
        ? [{ label: "Add Case", onClick: () => setShowDiscModal(true), variant: "primary" }]
        : []
      : []
  );

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 space-y-4">
        {/* KPI Rows */}
        {tab === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Reviews", value: reviewStats.total ?? 0, color: "text-blue-700" },
              { label: "Completed", value: reviewStats.completed ?? 0, color: "text-emerald-600" },
              { label: "Pending", value: reviewStats.pending ?? 0, color: "text-yellow-600" },
              { label: "Overdue", value: reviewStats.overdue ?? 0, color: "text-red-500" },
              { label: "PIP Active", value: reviewStats.pip_active ?? 0, color: "text-purple-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 1 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Cases", value: discStats.total ?? 0, color: "text-blue-700" },
              { label: "Active", value: discStats.active ?? 0, color: "text-yellow-600" },
              { label: "Resolved", value: discStats.resolved ?? 0, color: "text-emerald-600" },
              { label: "PIP Active", value: discStats.pip_active ?? 0, color: "text-purple-600" },
              { label: "Critical", value: discStats.critical ?? 0, color: "text-red-500" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200">
          {["Performance Reviews", "Discipline Cases", "PIP Tracker"].map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === i ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Performance Reviews */}
            {tab === 0 && (
              <div className="space-y-3">
                <div className="flex gap-3 flex-wrap">
                  <input type="text" placeholder="Search employee..." value={reviewSearch} onChange={(e) => setReviewSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Status</option>
                    <option>Pending</option><option>In Review</option><option>Completed</option><option>Overdue</option>
                  </select>
                </div>

                <div className="flex gap-4 flex-col xl:flex-row">
                  <div className="flex-1">
                    <DataTable
                      columns={REVIEW_COLS}
                      data={reviews.map((r) => ({ ...r, rating: r.rating ? `${r.rating} ★` : "—", goals_completion_pct: r.goals_completion_pct != null ? `${r.goals_completion_pct}%` : "—" }))}
                      onRowClick={(row) => setSelectedReview(reviews.find((r) => r.id === row.id))}
                    />
                  </div>

                  {/* Rating Distribution sidebar */}
                  {reviewStats.rating_distribution && (
                    <div className="w-full xl:w-56 bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Rating Distribution</h3>
                      <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = reviewStats.rating_distribution?.[String(star)] ?? 0;
                          const total = reviewStats.total || 1;
                          return (
                            <div key={star} className="flex items-center gap-2 text-xs">
                              <span className="w-8 text-yellow-500">{"★".repeat(star)}</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                              </div>
                              <span className="w-5 text-gray-500 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Discipline Cases */}
            {tab === 1 && (
              <div className="space-y-3">
                <div className="flex gap-3 flex-wrap">
                  <input type="text" placeholder="Search..." value={discSearch} onChange={(e) => setDiscSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <select value={discSeverity} onChange={(e) => setDiscSeverity(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Severities</option>
                    {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <select value={discStatus} onChange={(e) => setDiscStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Status</option>
                    <option>Active</option><option>Pending SCN</option><option>Under Investigation</option><option>PIP Active</option><option>Resolved</option>
                  </select>
                </div>
                <DataTable
                  columns={DISCIPLINE_COLS}
                  data={discipline.map((d) => ({
                    ...d,
                    severity: <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sevColor(d.severity)}`}>{d.severity}</span>,
                  }))}
                  onRowClick={(row) => setSelectedDisc(discipline.find((d) => d.id === row.id))}
                />
              </div>
            )}

            {/* PIP Tracker */}
            {tab === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pipList.length === 0 ? (
                  <div className="col-span-3 flex items-center justify-center py-16 text-gray-400">No active PIP cases</div>
                ) : (
                  pipList.map((r) => (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">{r.name}</p>
                          <p className="text-xs text-gray-500">{r.designation} · {r.dept}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">PIP Active</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Goals Progress</span>
                          <span>{r.goals_completion_pct ?? 0}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${r.goals_completion_pct ?? 0}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={`text-sm ${s <= Math.round(parseFloat(r.rating) || 0) ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                        ))}
                        <span className="text-xs text-gray-500 ml-1">{r.rating ? `${r.rating}/5` : "No rating"}</span>
                      </div>
                      {r.next_review_date && (
                        <p className="text-xs text-gray-500">Next Review: {r.next_review_date}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Performance Review Detail</h2>
              <button onClick={() => setSelectedReview(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[["Employee", selectedReview.name], ["Department", selectedReview.dept], ["Cycle", selectedReview.cycle_name], ["Status", selectedReview.status], ["Rating", selectedReview.rating ? `${selectedReview.rating} / 5` : "—"], ["Goals %", selectedReview.goals_completion_pct ? `${selectedReview.goals_completion_pct}%` : "—"], ["PIP Active", selectedReview.pip_active ? "Yes" : "No"], ["Next Review", selectedReview.next_review_date || "—"]].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-medium text-gray-800">{val}</p>
                </div>
              ))}
            </div>
            {selectedReview.notes && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{selectedReview.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discipline Detail Modal */}
      {selectedDisc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Discipline Case: {selectedDisc.case_code}</h2>
              <button onClick={() => setSelectedDisc(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[["Employee", selectedDisc.name], ["Department", selectedDisc.dept], ["Incident Type", selectedDisc.incident_type], ["Incident Date", selectedDisc.incident_date || "—"], ["Severity", selectedDisc.severity], ["Action Taken", selectedDisc.action_taken || "—"], ["Status", selectedDisc.status]].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-medium text-gray-800">{val}</p>
                </div>
              ))}
            </div>
            {selectedDisc.description && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Incident Description</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{selectedDisc.description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Performance Review</h2>
            <div className="space-y-3">
              {[["Employee ID", "employee_id", "number"], ["Cycle Name", "cycle_name", "text"], ["Rating (0-5)", "rating", "number"], ["Goals % Complete", "goals_completion_pct", "number"], ["Notes", "notes", "text"]].map(([lbl, key, type]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{lbl}</label>
                  <input type={type} value={reviewForm[key]} onChange={(e) => setReviewForm((f) => ({ ...f, [key]: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <select value={reviewForm.status} onChange={(e) => setReviewForm((f) => ({ ...f, status: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Pending</option><option>In Review</option><option>Completed</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createReview} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">Create Review</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Discipline Modal */}
      {showDiscModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Create Discipline Case</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Employee ID</label>
                <input type="number" value={discForm.employee_id} onChange={(e) => setDiscForm((f) => ({ ...f, employee_id: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Incident Type</label>
                <select value={discForm.incident_type} onChange={(e) => setDiscForm((f) => ({ ...f, incident_type: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select...</option>
                  {["Attendance", "Insubordination", "Policy Violation", "Performance Issue", "Misconduct"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Severity</label>
                <select value={discForm.severity} onChange={(e) => setDiscForm((f) => ({ ...f, severity: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Incident Date</label>
                <input type="date" value={discForm.incident_date} onChange={(e) => setDiscForm((f) => ({ ...f, incident_date: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea rows={3} value={discForm.description} onChange={(e) => setDiscForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDiscModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createDisc} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">Create Case</button>
            </div>
          </div>
        </div>
      )}
    </HeaderWrapper>
  );
}
