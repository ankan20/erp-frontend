"use client";

import { useState, useEffect, useCallback } from "react";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/layout/PageHeader";
import { toast } from "sonner";

const JOB_COLS = [
  { key: "title", label: "Job Title" },
  { key: "department", label: "Department" },
  { key: "location", label: "Location" },
  { key: "openings_count", label: "Openings" },
  { key: "experience_required", label: "Experience" },
  { key: "applied_count", label: "Applied" },
  { key: "status", label: "Status", isStatus: true },
];

const CANDIDATE_COLS = [
  { key: "name", label: "Candidate Name" },
  { key: "job_title", label: "Position" },
  { key: "applied_date", label: "Applied On" },
  { key: "source", label: "Source" },
  { key: "current_ctc", label: "Current CTC" },
  { key: "expected_ctc", label: "Expected CTC" },
  { key: "notice_period", label: "Notice Period" },
  { key: "stage", label: "Stage", isStatus: true },
];

const STAGES = ["Applied", "Screening", "Interview", "Offer", "Joined", "Rejected"];
const EMPTY_JOB = { title: "", department: "", location: "", openings_count: 1, experience_required: "", job_type: "Full-time", status: "Open", description: "" };
const EMPTY_CANDIDATE = { name: "", email: "", mobile: "", source: "", current_ctc: "", expected_ctc: "", notice_period: "", stage: "Applied", job_opening_id: "" };

export default function RecruitmentPage() {
  const [view, setView] = useState("pipeline"); // pipeline | jobs | candidates
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({});
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCandModal, setShowCandModal] = useState(false);
  const [jobForm, setJobForm] = useState(EMPTY_JOB);
  const [candForm, setCandForm] = useState(EMPTY_CANDIDATE);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [jobsRes, candsRes, statsRes] = await Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.JOBS_LIST, method: "GET", params: { search: jobSearch, status: jobStatus } }),
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_LIST, method: "GET", params: { search: candidateSearch, stage: stageFilter } }),
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.PIPELINE_STATS, method: "GET" }),
    ]);
    if (jobsRes?.data) setJobs(jobsRes.data);
    if (candsRes?.data) setCandidates(candsRes.data);
    if (statsRes?.data) setStats(statsRes.data);
    setLoading(false);
  }, [jobSearch, jobStatus, candidateSearch, stageFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createJob = async () => {
    const res = await apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.JOBS_CREATE, method: "POST", data: jobForm });
    if (res?.data) { toast.success("Job opening created"); setShowJobModal(false); setJobForm(EMPTY_JOB); fetchAll(); }
  };

  const createCandidate = async () => {
    const res = await apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_CREATE, method: "POST", data: { ...candForm, job_opening_id: Number(candForm.job_opening_id) } });
    if (res?.data) { toast.success("Candidate added"); setShowCandModal(false); setCandForm(EMPTY_CANDIDATE); fetchAll(); }
  };

  const pipelineStats = stats.pipeline || {};
  const openPositions = stats.open_positions || 0;

  const actions = getPageActions([
    { label: "Add Candidate", onClick: () => setShowCandModal(true), variant: "secondary" },
    { label: "Post Job", onClick: () => setShowJobModal(true), variant: "primary" },
  ]);

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Open Positions", value: openPositions, color: "text-blue-700" },
            { label: "In Pipeline", value: Object.values(pipelineStats).reduce((a, b) => a + b, 0) - (pipelineStats.Rejected || 0) - (pipelineStats.Joined || 0), color: "text-yellow-600" },
            { label: "Offers Made", value: pipelineStats.Offer || 0, color: "text-purple-600" },
            { label: "Joined This Cycle", value: pipelineStats.Joined || 0, color: "text-emerald-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Pipeline funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recruitment Pipeline</h3>
          <div className="flex gap-2 flex-wrap">
            {STAGES.map((stage) => (
              <button
                key={stage}
                onClick={() => { setStageFilter(stage === stageFilter ? "" : stage); setView("candidates"); }}
                className={`flex flex-col items-center px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${stageFilter === stage ? "bg-blue-700 text-white border-blue-700" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}
              >
                <span className="text-lg font-bold">{pipelineStats[stage] ?? 0}</span>
                <span className="text-xs">{stage}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 border-b border-gray-200">
          {[["pipeline", "Pipeline View"], ["jobs", "Job Openings"], ["candidates", "All Candidates"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : (
          <>
            {view === "jobs" && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <input type="text" placeholder="Search jobs..." value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <select value={jobStatus} onChange={(e) => setJobStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Status</option>
                    <option>Open</option><option>Closed</option><option>On Hold</option>
                  </select>
                </div>
                <DataTable columns={JOB_COLS} data={jobs} />
              </div>
            )}

            {(view === "candidates" || view === "pipeline") && (
              <div className="space-y-3">
                <div className="flex gap-3 flex-wrap">
                  <input type="text" placeholder="Search candidates..." value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Stages</option>
                    {STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <DataTable columns={CANDIDATE_COLS} data={candidates} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Job Modal */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Post New Job Opening</h2>
            <div className="grid grid-cols-2 gap-4">
              {[["Job Title", "title"], ["Department", "department"], ["Location", "location"], ["Experience Required", "experience_required"]].map(([lbl, key]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{lbl}</label>
                  <input type="text" value={jobForm[key]} onChange={(e) => setJobForm((f) => ({ ...f, [key]: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Openings</label>
                <input type="number" value={jobForm.openings_count} onChange={(e) => setJobForm((f) => ({ ...f, openings_count: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Job Type</label>
                <select value={jobForm.job_type} onChange={(e) => setJobForm((f) => ({ ...f, job_type: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Full-time</option><option>Contract</option><option>Intern</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowJobModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createJob} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">Post Job</button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Modal */}
      {showCandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Candidate</h2>
            <div className="grid grid-cols-2 gap-4">
              {[["Name", "name"], ["Email", "email"], ["Mobile", "mobile"], ["Current CTC", "current_ctc"], ["Expected CTC", "expected_ctc"], ["Notice Period", "notice_period"]].map(([lbl, key]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{lbl}</label>
                  <input type="text" value={candForm[key]} onChange={(e) => setCandForm((f) => ({ ...f, [key]: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Job Opening</label>
                <select value={candForm.job_opening_id} onChange={(e) => setCandForm((f) => ({ ...f, job_opening_id: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select...</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Source</label>
                <select value={candForm.source} onChange={(e) => setCandForm((f) => ({ ...f, source: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select...</option>
                  {["LinkedIn", "Referral", "Job Portal", "Walk-in", "Campus"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCandModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createCandidate} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">Add Candidate</button>
            </div>
          </div>
        </div>
      )}
    </HeaderWrapper>
  );
}
