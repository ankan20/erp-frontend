"use client";

import { useState, useEffect, useCallback } from "react";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";

/* ─── Stage config ─────────────────────────────────────────── */
const STAGES = ["Applied", "Screening", "Interview", "Offer", "Joined", "Rejected"];

const STAGE_STYLE = {
  Applied:   "bg-gray-100 text-gray-600",
  Screening: "bg-blue-100 text-blue-700",
  Interview: "bg-purple-100 text-purple-700",
  Offer:     "bg-yellow-100 text-yellow-700",
  Joined:    "bg-emerald-100 text-emerald-700",
  Rejected:  "bg-red-100 text-red-600",
};

const STAGE_BAR = {
  Applied:   "bg-blue-600",
  Screening: "bg-teal-500",
  Interview: "bg-purple-500",
  Offer:     "bg-yellow-500",
  Joined:    "bg-emerald-500",
  Rejected:  "bg-red-400",
};

const EMPTY_JOB = {
  title: "", department: "", location: "", openings_count: 1,
  experience_required: "", job_type: "Full-time", status: "Open",
  salary_band: "", deadline: "", description: "",
};

const EMPTY_CANDIDATE = {
  name: "", email: "", mobile: "", source: "",
  current_ctc: "", expected_ctc: "", notice_period: "",
  stage: "Applied", job_opening_id: "",
};

/* ─── Helpers ──────────────────────────────────────────────── */
function StageBadge({ stage }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STAGE_STYLE[stage] || "bg-gray-100 text-gray-500"}`}>
      {stage}
    </span>
  );
}

function SourceBadge({ source }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{source || "—"}</span>
  );
}

/* ─── Tabs ─────────────────────────────────────────────────── */
const TABS = [
  { key: "overview",   label: "Overview" },
  { key: "vacancies",  label: "Vacancies" },
  { key: "candidates", label: "Candidates" },
  { key: "interviews", label: "Interviews" },
];

/* ═══════════════════════════════════════════════════════════ */
export default function RecruitmentPage() {
  const [tab, setTab] = useState("overview");
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  /* filters */
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [candSearch, setCandSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  /* modals */
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState(EMPTY_JOB);
  const [showCandModal, setShowCandModal] = useState(false);
  const [candForm, setCandForm] = useState(EMPTY_CANDIDATE);
  const [selectedCand, setSelectedCand] = useState(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [showIvModal, setShowIvModal] = useState(false);
  const [ivForm, setIvForm] = useState({ candidate_id: "", scheduled_date: "", scheduled_time: "", round_name: "", mode: "Video Call", interviewer: "" });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [jr, cr, sr, ivr] = await Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.JOBS_LIST, method: "GET", params: { search: jobSearch, status: jobStatus } }),
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_LIST, method: "GET", params: { search: candSearch, stage: stageFilter } }),
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.PIPELINE_STATS, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.INTERVIEWS_LIST, method: "GET" }),
    ]);
    if (jr?.data) setJobs(jr.data);
    if (cr?.data) setCandidates(cr.data);
    if (sr?.data) setStats(sr.data);
    if (ivr?.data) setInterviews(ivr.data);
    setLoading(false);
  }, [jobSearch, jobStatus, candSearch, stageFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createJob = async () => {
    const res = await apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.JOBS_CREATE, method: "POST", data: jobForm });
    if (res?.data) { toast.success("Job posted"); setShowJobModal(false); setJobForm(EMPTY_JOB); fetchAll(); }
  };

  const createCandidate = async () => {
    const res = await apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_CREATE, method: "POST", data: { ...candForm, job_opening_id: Number(candForm.job_opening_id) } });
    if (res?.data) { toast.success("Candidate added"); setShowCandModal(false); setCandForm(EMPTY_CANDIDATE); fetchAll(); }
  };

  const updateCandStage = async (candId, stage, cand) => {
    // Client-side lock check
    if (stage === "Joined") {
      if (!cand.offer_letter_generated) { toast.error("Generate Offer Letter first before marking as Joined"); return; }
      if (!cand.appointment_letter_generated) { toast.error("Generate Appointment Letter first before marking as Joined"); return; }
    }
    setUpdatingStage(true);
    const r = await apiRequest({ url: `${API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_UPDATE}${candId}`, method: "PUT", data: { stage } });
    setUpdatingStage(false);
    if (r?.data) {
      toast.success(`Stage → ${stage}${stage === "Joined" ? " 🎉 Onboarding auto-initiated!" : ""}`);
      setSelectedCand((p) => p ? { ...p, stage } : p);
      fetchAll();
    } else if (r?.message) {
      toast.error(r.message);
    }
  };

  const scheduleInterview = async () => {
    if (!ivForm.candidate_id || !ivForm.scheduled_date) { toast.error("Select candidate and date"); return; }
    const r = await apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.INTERVIEWS_CREATE, method: "POST", data: { ...ivForm, candidate_id: Number(ivForm.candidate_id) } });
    if (r?.data) { toast.success("Interview scheduled"); setShowIvModal(false); setIvForm({ candidate_id: "", scheduled_date: "", scheduled_time: "", round_name: "", mode: "Video Call", interviewer: "" }); fetchAll(); }
  };

  const pipeline = stats.pipeline || {};
  const maxPipeline = Math.max(...STAGES.map((s) => pipeline[s] || 0), 1);
  const totalActive = STAGES.filter(s => s !== "Joined" && s !== "Rejected").reduce((a, s) => a + (pipeline[s] || 0), 0);
  const interviewCandidates = candidates.filter((c) => c.stage === "Interview");
  const recentJoins = candidates.filter((c) => c.stage === "Joined" || c.stage === "Offer");

  return (
    <HeaderWrapper>
      <PageHeader />
      <div className="p-4 space-y-4">

        {/* Tab nav */}
        <div className="flex gap-0 border-b border-gray-200 bg-white -mx-4 px-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? "border-blue-700 text-blue-700 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.key === "vacancies" && <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{jobs.length}</span>}
              {t.key === "candidates" && <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{candidates.length}</span>}
              {t.key === "interviews" && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{interviewCandidates.length}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">Loading...</div>
        ) : (
          <>
            {/* ══ OVERVIEW ══ */}
            {tab === "overview" && (
              <div className="space-y-4">
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Open Positions", value: stats.open_positions ?? 0, color: "text-blue-700", sub: `${jobs.filter(j => j.status === "Open").length} active vacancies` },
                    { label: "In Pipeline", value: totalActive, color: "text-purple-600", sub: "Across all stages" },
                    { label: "Offers Extended", value: pipeline.Offer ?? 0, color: "text-yellow-600", sub: `${pipeline.Joined ?? 0} accepted / joined` },
                    { label: "Joined", value: pipeline.Joined ?? 0, color: "text-emerald-600", sub: `${pipeline.Rejected ?? 0} rejected` },
                  ].map((k) => (
                    <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{k.label}</p>
                      <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                      <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Pipeline funnel */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Hiring Pipeline</h3>
                    <div className="space-y-3">
                      {STAGES.map((stage) => {
                        const count = pipeline[stage] || 0;
                        const pct = maxPipeline > 0 ? (count / maxPipeline) * 100 : 0;
                        return (
                          <div key={stage} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-20 flex-shrink-0">{stage}</span>
                            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                              <div
                                className={`h-full rounded flex items-center px-2 text-xs font-semibold text-white transition-all ${STAGE_BAR[stage]}`}
                                style={{ width: `${Math.max(pct, count ? 6 : 0)}%` }}
                              >
                                {count > 5 ? count : ""}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-gray-700 w-6 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right side: upcoming interviews + recent joins */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Candidates in Interview</h3>
                        <button onClick={() => { setStageFilter("Interview"); setTab("interviews"); }} className="text-xs text-blue-600 hover:underline">View all →</button>
                      </div>
                      {interviewCandidates.length === 0 ? (
                        <p className="text-xs text-gray-400 py-4 text-center">No candidates in interview stage</p>
                      ) : interviewCandidates.slice(0, 4).map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {c.name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.job_title}</p>
                          </div>
                          <StageBadge stage={c.stage} />
                        </div>
                      ))}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Offers & Recent Joins</h3>
                        <button onClick={() => { setStageFilter(""); setTab("candidates"); }} className="text-xs text-blue-600 hover:underline">View all →</button>
                      </div>
                      {recentJoins.length === 0 ? (
                        <p className="text-xs text-gray-400 py-4 text-center">No recent offers or joins</p>
                      ) : recentJoins.slice(0, 4).map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {c.name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.job_title}</p>
                          </div>
                          <StageBadge stage={c.stage} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ VACANCIES ══ */}
            {tab === "vacancies" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex gap-3 flex-wrap">
                    <input type="text" placeholder="Search role..." value={jobSearch} onChange={(e) => setJobSearch(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <select value={jobStatus} onChange={(e) => setJobStatus(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">All Status</option>
                      <option>Open</option><option>On Hold</option><option>Closed</option>
                    </select>
                  </div>
                  <button onClick={() => setShowJobModal(true)}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-medium">
                    + Post Vacancy
                  </button>
                </div>

                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                    <p>No vacancies found</p>
                    <button onClick={() => setShowJobModal(true)} className="text-sm text-blue-600 hover:underline">Post your first vacancy →</button>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                          {["Role", "Department", "Openings", "Applied", "In Progress", "Salary Band", "Deadline", "Status"].map((h) => (
                            <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {jobs.map((j) => (
                          <tr key={j.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-800">{j.title}</p>
                              <p className="text-xs text-gray-400">{j.experience_required} · {j.job_type}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{j.department || "—"}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-700">{j.openings_count}</td>
                            <td className="px-4 py-3 text-center font-semibold text-blue-700">{j.applied_count ?? 0}</td>
                            <td className="px-4 py-3 text-center font-semibold text-teal-600">{j.in_progress_count ?? 0}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{j.salary_band || "—"}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{j.deadline || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                j.status === "Open" ? "bg-emerald-100 text-emerald-700" :
                                j.status === "On Hold" ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-600"
                              }`}>{j.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ══ CANDIDATES ══ */}
            {tab === "candidates" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex gap-3 flex-wrap">
                    <input type="text" placeholder="Search candidate..." value={candSearch} onChange={(e) => setCandSearch(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">All Stages</option>
                      {STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setShowCandModal(true)}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-medium">
                    + Add Candidate
                  </button>
                </div>

                {candidates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                    <p>No candidates found</p>
                    <button onClick={() => setShowCandModal(true)} className="text-sm text-blue-600 hover:underline">Add a candidate →</button>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                          {["Candidate", "Applied For", "Source", "Applied On", "CTC Details", "Notice", "Stage"].map((h) => (
                            <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {candidates.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCand(c)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {c.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-800">{c.name}</p>
                                  <p className="text-xs text-gray-400">{c.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{c.job_title || "—"}</td>
                            <td className="px-4 py-3"><SourceBadge source={c.source} /></td>
                            <td className="px-4 py-3 text-xs text-gray-500">{c.applied_date || "—"}</td>
                            <td className="px-4 py-3 text-xs">
                              {c.current_ctc && <span className="text-gray-500">Curr: {c.current_ctc}</span>}
                              {c.current_ctc && c.expected_ctc && <br />}
                              {c.expected_ctc && <span className="text-blue-600 font-medium">Exp: {c.expected_ctc}</span>}
                              {!c.current_ctc && !c.expected_ctc && <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{c.notice_period || "—"}</td>
                            <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ══ INTERVIEWS ══ */}
            {tab === "interviews" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Scheduled", value: interviews.filter(i => i.status === "Scheduled").length, color: "text-blue-700" },
                    { label: "Completed", value: interviews.filter(i => i.status === "Completed").length, color: "text-emerald-600" },
                    { label: "In Interview Stage", value: pipeline.Interview ?? 0, color: "text-purple-700" },
                    { label: "Cancelled", value: interviews.filter(i => i.status === "Cancelled").length, color: "text-red-500" },
                  ].map((k) => (
                    <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{k.label}</p>
                      <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">Interview Schedule</h3>
                    <button onClick={() => setShowIvModal(true)} className="px-4 py-2 text-xs rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-medium">+ Schedule Interview</button>
                  </div>
                  {interviews.length === 0 ? (
                    <div className="py-16 text-center text-gray-400">
                      <p className="text-base mb-1">No interviews scheduled yet</p>
                      <button onClick={() => setShowIvModal(true)} className="text-sm text-blue-600 hover:underline">Schedule one →</button>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                          {["Date & Time", "Candidate", "Role", "Round", "Mode", "Interviewer", "Status", "Score / Decision"].map((h) => (
                            <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {interviews.map((iv) => (
                          <tr key={iv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-800 text-xs">{iv.scheduled_time || "—"}</p>
                              <p className="text-xs text-gray-400">{iv.scheduled_date || "—"}</p>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">{iv.candidate_name}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{iv.job_title || "—"}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{iv.round_name || "—"}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {iv.mode === "Video Call" ? "📹" : iv.mode === "In-Person" ? "🏢" : "📞"} {iv.mode}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{iv.interviewer || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                iv.status === "Completed" ? "bg-emerald-100 text-emerald-700" :
                                iv.status === "Cancelled" ? "bg-red-100 text-red-600" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>{iv.status}</span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {iv.score ? <span className={`font-bold ${iv.score >= 75 ? "text-emerald-600" : iv.score >= 50 ? "text-yellow-600" : "text-red-500"}`}>{iv.score}%</span> : <span className="text-gray-400">—</span>}
                              {iv.decision && <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${iv.decision === "Advance" ? "bg-emerald-100 text-emerald-700" : iv.decision === "Reject" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>{iv.decision}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ POST JOB MODAL ══ */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowJobModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Post New Vacancy</h2>
              <button onClick={() => setShowJobModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["Job Title *", "title", "text"], ["Department", "department", "text"], ["Location", "location", "text"], ["Experience Required", "experience_required", "text"], ["Salary Band", "salary_band", "text"], ["Deadline", "deadline", "date"]].map(([lbl, key, type]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{lbl}</label>
                  <input type={type} value={jobForm[key]} onChange={(e) => setJobForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Openings</label>
                <input type="number" min={1} value={jobForm.openings_count} onChange={(e) => setJobForm((f) => ({ ...f, openings_count: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Job Type</label>
                <select value={jobForm.job_type} onChange={(e) => setJobForm((f) => ({ ...f, job_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Job Description</label>
                <textarea value={jobForm.description} onChange={(e) => setJobForm((f) => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowJobModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createJob} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">Post Vacancy</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD CANDIDATE MODAL ══ */}
      {showCandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCandModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Add Candidate</h2>
              <button onClick={() => setShowCandModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["Full Name *", "name", "text"], ["Email", "email", "email"], ["Mobile", "mobile", "tel"], ["Current CTC", "current_ctc", "text"], ["Expected CTC", "expected_ctc", "text"], ["Notice Period", "notice_period", "text"]].map(([lbl, key, type]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{lbl}</label>
                  <input type={type} value={candForm[key]} onChange={(e) => setCandForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Job Opening *</label>
                <select value={candForm.job_opening_id} onChange={(e) => setCandForm((f) => ({ ...f, job_opening_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select job...</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} ({j.department})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Source</label>
                <select value={candForm.source} onChange={(e) => setCandForm((f) => ({ ...f, source: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select source...</option>
                  {["LinkedIn", "Naukri", "Referral", "Job Portal", "Walk-in", "Campus", "GitHub Jobs"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Initial Stage</label>
                <select value={candForm.stage} onChange={(e) => setCandForm((f) => ({ ...f, stage: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCandModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createCandidate} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">Add Candidate</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SCHEDULE INTERVIEW MODAL ══ */}
      {showIvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowIvModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Schedule Interview</h2>
              <button onClick={() => setShowIvModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Candidate *</label>
                <select value={ivForm.candidate_id} onChange={(e) => setIvForm(f => ({ ...f, candidate_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select candidate...</option>
                  {candidates.map(c => <option key={c.id} value={c.id}>{c.name} — {c.job_title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date *</label>
                  <input type="date" value={ivForm.scheduled_date} onChange={(e) => setIvForm(f => ({ ...f, scheduled_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Time</label>
                  <input type="time" value={ivForm.scheduled_time} onChange={(e) => setIvForm(f => ({ ...f, scheduled_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Round</label>
                  <select value={ivForm.round_name} onChange={(e) => setIvForm(f => ({ ...f, round_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select round...</option>
                    {["Screening Call", "Technical R1", "Technical R2", "HR Round", "Panel Interview", "Final Round"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Mode</label>
                  <select value={ivForm.mode} onChange={(e) => setIvForm(f => ({ ...f, mode: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Video Call</option><option>In-Person</option><option>Phone</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Interviewer(s)</label>
                <input type="text" placeholder="e.g. Anika Mehta" value={ivForm.interviewer} onChange={(e) => setIvForm(f => ({ ...f, interviewer: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowIvModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={scheduleInterview} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CANDIDATE DETAIL MODAL ══ */}
      {selectedCand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedCand(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-blue-700 text-white p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                {selectedCand.name?.charAt(0)}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{selectedCand.name}</h2>
                <p className="text-sm text-blue-200">{selectedCand.job_title} · {selectedCand.source}</p>
                <p className="text-xs text-blue-300 mt-0.5">{selectedCand.email} · {selectedCand.mobile}</p>
              </div>
              <button onClick={() => setSelectedCand(null)} className="text-white/70 hover:text-white text-lg">✕</button>
            </div>

            {/* Profile grid */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Current CTC", selectedCand.current_ctc],
                  ["Expected CTC", selectedCand.expected_ctc],
                  ["Notice Period", selectedCand.notice_period],
                  ["Applied On", selectedCand.applied_date],
                  ["Source", selectedCand.source],
                  ["Stage", null],
                ].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
                    {label === "Stage" ? (
                      <StageBadge stage={selectedCand.stage} />
                    ) : (
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">{val || "—"}</p>
                    )}
                  </div>
                ))}
              </div>

              {selectedCand.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedCand.notes}</p>
                </div>
              )}

              {/* Letter status */}
              <div className="flex gap-3">
                <div className={`flex-1 rounded-lg p-3 border ${selectedCand.offer_letter_generated ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
                  <p className="text-xs font-semibold">{selectedCand.offer_letter_generated ? "✅" : "🔒"} Offer Letter</p>
                  <p className={`text-xs mt-0.5 ${selectedCand.offer_letter_generated ? "text-emerald-700" : "text-orange-700"}`}>
                    {selectedCand.offer_letter_generated ? "Generated" : "Not yet generated"}
                  </p>
                </div>
                <div className={`flex-1 rounded-lg p-3 border ${selectedCand.appointment_letter_generated ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
                  <p className="text-xs font-semibold">{selectedCand.appointment_letter_generated ? "✅" : "🔒"} Appointment Letter</p>
                  <p className={`text-xs mt-0.5 ${selectedCand.appointment_letter_generated ? "text-emerald-700" : "text-orange-700"}`}>
                    {selectedCand.appointment_letter_generated ? "Generated" : "Not yet generated"}
                  </p>
                </div>
              </div>

              {/* Stage update */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Move to Stage</p>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((s) => {
                    const isJoinedLocked = s === "Joined" && (!selectedCand.offer_letter_generated || !selectedCand.appointment_letter_generated);
                    return (
                      <button
                        key={s}
                        disabled={s === selectedCand.stage || updatingStage}
                        onClick={() => updateCandStage(selectedCand.id, s, selectedCand)}
                        title={isJoinedLocked ? "Generate both letters first" : ""}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                          s === selectedCand.stage
                            ? "bg-blue-700 text-white border-blue-700 cursor-default"
                            : isJoinedLocked
                            ? "border-orange-300 text-orange-500 cursor-pointer hover:bg-orange-50"
                            : "border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        }`}
                      >
                        {isJoinedLocked ? "🔒 " : ""}{s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </HeaderWrapper>
  );
}
