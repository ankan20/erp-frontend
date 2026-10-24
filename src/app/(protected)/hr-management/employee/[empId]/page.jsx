"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import { toast } from "sonner";

const TABS = [
  "Personal",
  "Employment",
  "Payroll & Salary",
  "Qualifications",
  "Documents",
  "IT & Access",
  "Performance",
];

// ─── Reusable field components ────────────────────────────────────────────────

function Field({ label, value, edit, onChange, type = "text" }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {edit ? (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      ) : (
        <span className="text-sm text-gray-800">{value || "—"}</span>
      )}
    </div>
  );
}

function SelectField({ label, value, edit, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {edit ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select...</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <span className="text-sm text-gray-800">{value || "—"}</span>
      )}
    </div>
  );
}

// ─── Star rating display ───────────────────────────────────────────────────────
function Stars({ rating }) {
  const n = Math.round(Number(rating) || 0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-4 h-4 ${i <= n ? "text-amber-400" : "text-gray-300"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────
const SEVERITY_STYLE = {
  Low: "bg-blue-100 text-blue-700",
  Medium: "bg-yellow-100 text-yellow-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};
const STATUS_STYLE_REVIEW = {
  Completed: "bg-emerald-100 text-emerald-700",
  Pending: "bg-yellow-100 text-yellow-700",
  Overdue: "bg-red-100 text-red-700",
};
const STATUS_STYLE_DISC = {
  Active: "bg-red-100 text-red-700",
  Resolved: "bg-emerald-100 text-emerald-700",
  "PIP Active": "bg-orange-100 text-orange-700",
};

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const { empId } = useParams();
  const router = useRouter();

  // Core employee state
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Performance state
  const [reviews, setReviews] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDisciplineModal, setShowDisciplineModal] = useState(false);
  const [savingPerf, setSavingPerf] = useState(false);

  const [reviewForm, setReviewForm] = useState({
    cycle_name: "", rating: "", goals_completion_pct: "", status: "Pending",
    pip_active: false, notes: "", next_review_date: "",
  });
  const [disciplineForm, setDisciplineForm] = useState({
    incident_type: "", severity: "Low", incident_date: "",
    action_taken: "", status: "Active", description: "",
  });

  // Document link management (in-memory, saved to other_doc_urls JSON)
  const [docLinks, setDocLinks] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", url: "" });

  // Load employee
  useEffect(() => {
    if (!empId || empId === "new") return;
    apiRequest({ url: `${API_ENDPOINTS.HR.EMPLOYEE.GET_BY_ID}${empId}`, method: "GET" }).then((r) => {
      if (r?.data) {
        setEmp(r.data);
        setForm(r.data);
        // parse stored document links
        try {
          const parsed = JSON.parse(r.data.other_doc_urls || "[]");
          setDocLinks(Array.isArray(parsed) ? parsed : []);
        } catch { setDocLinks([]); }
      }
    });
  }, [empId]);

  // Load performance when tab switches to Performance (index 6)
  const loadPerformance = useCallback(async () => {
    if (!empId) return;
    setLoadingPerf(true);
    const [rv, dc] = await Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.REVIEWS_LIST, method: "GET", params: { employee_id: empId } }),
      apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.DISCIPLINE_LIST, method: "GET", params: { employee_id: empId } }),
    ]);
    if (rv?.data) setReviews(rv.data);
    if (dc?.data) setDisciplines(dc.data);
    setLoadingPerf(false);
  }, [empId]);

  useEffect(() => {
    if (activeTab === 6) loadPerformance();
  }, [activeTab, loadPerformance]);

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, other_doc_urls: JSON.stringify(docLinks) };
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.EMPLOYEE.UPDATE}${empId}`,
      method: "PUT",
      data: payload,
    });
    if (res?.data) {
      setEmp(res.data);
      setForm(res.data);
      toast.success("Employee updated");
      setEditing(false);
    }
    setSaving(false);
  };

  // Save performance review
  const handleSaveReview = async () => {
    setSavingPerf(true);
    const res = await apiRequest({
      url: API_ENDPOINTS.HR.PERFORMANCE.REVIEWS_LIST,
      method: "POST",
      data: { ...reviewForm, employee_id: Number(empId) },
    });
    if (res?.data) {
      toast.success("Review added");
      setShowReviewModal(false);
      setReviewForm({ cycle_name: "", rating: "", goals_completion_pct: "", status: "Pending", pip_active: false, notes: "", next_review_date: "" });
      loadPerformance();
    }
    setSavingPerf(false);
  };

  // Save discipline case
  const handleSaveDiscipline = async () => {
    setSavingPerf(true);
    const res = await apiRequest({
      url: API_ENDPOINTS.HR.PERFORMANCE.DISCIPLINE_LIST,
      method: "POST",
      data: { ...disciplineForm, employee_id: Number(empId) },
    });
    if (res?.data) {
      toast.success("Discipline case added");
      setShowDisciplineModal(false);
      setDisciplineForm({ incident_type: "", severity: "Low", incident_date: "", action_taken: "", status: "Active", description: "" });
      loadPerformance();
    }
    setSavingPerf(false);
  };

  // Add document link and auto-save
  const handleAddDoc = async () => {
    if (!docForm.name.trim() || !docForm.url.trim()) return;
    const newLinks = [...docLinks, { ...docForm, id: Date.now() }];
    setDocLinks(newLinks);
    setDocForm({ name: "", url: "" });
    setShowDocModal(false);
    await apiRequest({
      url: `${API_ENDPOINTS.HR.EMPLOYEE.UPDATE}${empId}`,
      method: "PUT",
      data: { other_doc_urls: JSON.stringify(newLinks) },
    });
    toast.success("Document added");
  };

  const handleRemoveDoc = async (idx) => {
    const newLinks = docLinks.filter((_, i) => i !== idx);
    setDocLinks(newLinks);
    await apiRequest({
      url: `${API_ENDPOINTS.HR.EMPLOYEE.UPDATE}${empId}`,
      method: "PUT",
      data: { other_doc_urls: JSON.stringify(newLinks) },
    });
    toast.success("Document removed");
  };

  const actions = getPageActions(
    editing
      ? [
          { label: "Save Changes", onClick: handleSave, variant: "primary", loading: saving },
          { label: "Cancel", onClick: () => { setForm(emp); setEditing(false); }, variant: "secondary" },
        ]
      : [{ label: "Edit", onClick: () => setEditing(true), variant: "primary" }]
  );

  if (!emp) {
    return (
      <HeaderWrapper>
        <PageHeader />
        <div className="flex items-center justify-center py-24 text-gray-500">Loading...</div>
      </HeaderWrapper>
    );
  }

  const statusColor =
    emp.employee_status === "Active" ? "bg-emerald-100 text-emerald-700"
    : emp.employee_status === "Inactive" ? "bg-red-100 text-red-700"
    : "bg-yellow-100 text-yellow-700";

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 space-y-4">

        {/* Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-blue-700 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {emp.full_name?.charAt(0) || "E"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900">{emp.full_name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                {emp.employee_status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{emp.designation} · {emp.department}</p>
            <p className="text-xs text-gray-400 mt-1">
              {emp.emp_code} · Joined {emp.date_of_joining || "—"} · {emp.employment_type}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {TABS.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === i ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5">

            {/* ── Personal ── */}
            {activeTab === 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                <Field label="Full Name" value={form.full_name} edit={editing} onChange={set("full_name")} />
                <Field label="Date of Birth" value={form.date_of_birth} edit={editing} onChange={set("date_of_birth")} type="date" />
                <SelectField label="Gender" value={form.gender} edit={editing} onChange={set("gender")} options={["Male", "Female", "Other"]} />
                <Field label="Blood Group" value={form.blood_group} edit={editing} onChange={set("blood_group")} />
                <Field label="Nationality" value={form.nationality} edit={editing} onChange={set("nationality")} />
                <Field label="Mother Tongue" value={form.mother_tongue} edit={editing} onChange={set("mother_tongue")} />
                <SelectField label="Marital Status" value={form.marital_status} edit={editing} onChange={set("marital_status")} options={["Single", "Married", "Divorced", "Widowed"]} />
                <Field label="Personal Mobile" value={form.personal_mobile} edit={editing} onChange={set("personal_mobile")} />
                <Field label="Personal Email" value={form.personal_email} edit={editing} onChange={set("personal_email")} />
                <div className="col-span-2">
                  <Field label="Current Address" value={form.current_address} edit={editing} onChange={set("current_address")} />
                </div>
                <div className="col-span-2">
                  <Field label="Permanent Address" value={form.permanent_address} edit={editing} onChange={set("permanent_address")} />
                </div>
                <Field label="Aadhaar (Masked)" value={form.aadhaar_masked} edit={editing} onChange={set("aadhaar_masked")} />
                <Field label="PAN Number" value={form.pan_number} edit={editing} onChange={set("pan_number")} />
                <Field label="Passport No." value={form.passport_number} edit={editing} onChange={set("passport_number")} />
                <Field label="Passport Expiry" value={form.passport_expiry} edit={editing} onChange={set("passport_expiry")} type="date" />
                <Field label="Emergency Contact" value={form.emergency_contact_name} edit={editing} onChange={set("emergency_contact_name")} />
                <Field label="Relation" value={form.emergency_contact_relation} edit={editing} onChange={set("emergency_contact_relation")} />
                <Field label="Emergency Mobile" value={form.emergency_contact_mobile} edit={editing} onChange={set("emergency_contact_mobile")} />
              </div>
            )}

            {/* ── Employment ── */}
            {activeTab === 1 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                <Field label="Employee Code" value={form.emp_code} edit={false} onChange={() => {}} />
                <Field label="Designation" value={form.designation} edit={editing} onChange={set("designation")} />
                <Field label="Department" value={form.department} edit={editing} onChange={set("department")} />
                <Field label="Date of Joining" value={form.date_of_joining} edit={editing} onChange={set("date_of_joining")} type="date" />
                <SelectField label="Employment Type" value={form.employment_type} edit={editing} onChange={set("employment_type")} options={["Full-time", "Contract", "Intern", "Part-time"]} />
                <SelectField label="Status" value={form.employee_status} edit={editing} onChange={set("employee_status")} options={["Active", "Inactive", "On Notice"]} />
                <Field label="Grade Band" value={form.grade_band} edit={editing} onChange={set("grade_band")} />
                <Field label="Work Location" value={form.work_location} edit={editing} onChange={set("work_location")} />
                <Field label="Cost Centre" value={form.cost_centre} edit={editing} onChange={set("cost_centre")} />
                <Field label="Probation End Date" value={form.probation_end_date} edit={editing} onChange={set("probation_end_date")} type="date" />
                <Field label="Confirmation Date" value={form.confirmation_date} edit={editing} onChange={set("confirmation_date")} type="date" />
                <Field label="Work Email" value={form.work_email} edit={editing} onChange={set("work_email")} />
                <Field label="Desk / Seat No." value={form.desk_seat_number} edit={editing} onChange={set("desk_seat_number")} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reporting Manager</label>
                  {editing ? (
                    <input type="text" placeholder="Manager name or ID" value={form.reporting_manager ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, reporting_manager: e.target.value }))}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  ) : (
                    <span className="text-sm text-gray-800">{emp.reporting_manager || "—"}</span>
                  )}
                </div>
              </div>
            )}

            {/* ── Payroll ── */}
            {activeTab === 2 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                <Field label="Annual CTC (₹)" value={form.ctc_annual} edit={editing} onChange={set("ctc_annual")} type="number" />
                <Field label="Basic Monthly (₹)" value={form.basic_monthly} edit={editing} onChange={set("basic_monthly")} type="number" />
                <Field label="HRA Monthly (₹)" value={form.hra_monthly} edit={editing} onChange={set("hra_monthly")} type="number" />
                <Field label="Special Allowance (₹)" value={form.special_allowance} edit={editing} onChange={set("special_allowance")} type="number" />
                <Field label="Other Allowances (₹)" value={form.other_allowances} edit={editing} onChange={set("other_allowances")} type="number" />
                <Field label="PF UAN" value={form.pf_uan} edit={editing} onChange={set("pf_uan")} />
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="pf" checked={!!form.pf_applicable} onChange={(e) => editing && set("pf_applicable")(e.target.checked)} />
                  <label htmlFor="pf" className="text-sm text-gray-700">PF Applicable</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="esi" checked={!!form.esi_applicable} onChange={(e) => editing && set("esi_applicable")(e.target.checked)} />
                  <label htmlFor="esi" className="text-sm text-gray-700">ESI Applicable</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="grat" checked={!!form.gratuity_eligible} onChange={(e) => editing && set("gratuity_eligible")(e.target.checked)} />
                  <label htmlFor="grat" className="text-sm text-gray-700">Gratuity Eligible</label>
                </div>
                <Field label="Bank Name" value={form.bank_name} edit={editing} onChange={set("bank_name")} />
                <Field label="Account (Masked)" value={form.bank_account_masked} edit={editing} onChange={set("bank_account_masked")} />
                <Field label="IFSC Code" value={form.ifsc_code} edit={editing} onChange={set("ifsc_code")} />
                <SelectField label="Payment Mode" value={form.payment_mode} edit={editing} onChange={set("payment_mode")} options={["NEFT", "RTGS", "Cheque", "Cash"]} />
              </div>
            )}

            {/* ── Qualifications ── */}
            {activeTab === 3 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                <Field label="Degree" value={form.degree} edit={editing} onChange={set("degree")} />
                <Field label="Specialization" value={form.specialization} edit={editing} onChange={set("specialization")} />
                <Field label="University" value={form.university} edit={editing} onChange={set("university")} />
                <Field label="Year of Passing" value={form.year_of_passing} edit={editing} onChange={set("year_of_passing")} type="number" />
                <Field label="Percentage / CGPA" value={form.percentage_cgpa} edit={editing} onChange={set("percentage_cgpa")} />
                <Field label="Total Experience (yrs)" value={form.total_experience} edit={editing} onChange={set("total_experience")} type="number" />
                <Field label="Relevant Experience (yrs)" value={form.relevant_experience} edit={editing} onChange={set("relevant_experience")} type="number" />
                <div className="col-span-2">
                  <Field label="Primary Skills" value={form.primary_skills} edit={editing} onChange={set("primary_skills")} />
                </div>
                <div className="col-span-2">
                  <Field label="Secondary Skills" value={form.secondary_skills} edit={editing} onChange={set("secondary_skills")} />
                </div>
              </div>
            )}

            {/* ── Documents ── */}
            {activeTab === 4 && (
              <div className="space-y-6">
                {/* CV */}
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Resume / CV</p>
                  {editing ? (
                    <div className="flex flex-col gap-1 max-w-lg">
                      <label className="text-xs text-gray-500 font-medium uppercase">CV URL (Google Drive, OneDrive, etc.)</label>
                      <input type="url" value={form.cv_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, cv_url: e.target.value }))}
                        placeholder="https://drive.google.com/..."
                        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-2xl">📄</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700">Resume / CV</p>
                        {form.cv_url ? (
                          <a href={form.cv_url} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline break-all">{form.cv_url}</a>
                        ) : (
                          <p className="text-xs text-gray-400">Not uploaded — click Edit to add a CV link</p>
                        )}
                      </div>
                      {form.cv_url && (
                        <a href={form.cv_url} target="_blank" rel="noreferrer"
                          className="px-3 py-1.5 text-xs rounded-lg bg-blue-700 text-white hover:bg-blue-800 flex-shrink-0">View CV</a>
                      )}
                    </div>
                  )}
                </div>

                {/* Identity */}
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Identity & KYC</p>
                  <div className="space-y-2">
                    {[
                      { label: "PAN Card", value: emp.pan_number, icon: "🪪" },
                      { label: "Aadhaar Card", value: emp.aadhaar_masked, icon: "🪪" },
                      { label: "Passport", value: emp.passport_number ? `${emp.passport_number}${emp.passport_expiry ? ` (exp: ${emp.passport_expiry})` : ""}` : null, icon: "📘" },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                        <div className="flex items-center gap-3">
                          <span>{icon}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-700">{label}</p>
                            {value && <p className="text-xs text-gray-500 font-mono">{value}</p>}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${value ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}>
                          {value ? "On File" : "Not Provided"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Other Documents */}
                <div>
                  <div className="flex items-center justify-between mb-3 border-b pb-2">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest">Other Documents</p>
                    <button onClick={() => setShowDocModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Upload Document
                    </button>
                  </div>
                  {docLinks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">No documents uploaded yet.</p>
                      <p className="text-xs mt-1">Click "Upload Document" to add a link.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {docLinks.map((doc, i) => (
                        <div key={doc.id || i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-lg">📎</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-700">{doc.name}</p>
                              <a href={doc.url} target="_blank" rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline truncate block">{doc.url}</a>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <a href={doc.url} target="_blank" rel="noreferrer"
                              className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">View</a>
                            <button onClick={() => handleRemoveDoc(i)}
                              className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200">Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── IT & Access ── */}
            {activeTab === 5 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-2 font-medium text-gray-600">System / Tool</th>
                      <th className="px-4 py-2 font-medium text-gray-600">Asset ID</th>
                      <th className="px-4 py-2 font-medium text-gray-600">Access Level</th>
                      <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { system: "Laptop", asset: "LAP-" + (emp.emp_code || "XXX"), access: "Full", status: "Issued" },
                      { system: "ERP System", asset: emp.work_email || "—", access: "Role-based", status: "Active" },
                      { system: "Email (Work)", asset: emp.work_email || "—", access: "Standard", status: "Active" },
                      { system: "VPN Access", asset: "—", access: "Limited", status: "Inactive" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-800">{row.system}</td>
                        <td className="px-4 py-2 text-gray-500">{row.asset}</td>
                        <td className="px-4 py-2 text-gray-600">{row.access}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.status === "Active" || row.status === "Issued" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Performance ── */}
            {activeTab === 6 && (
              <div className="space-y-6">
                {loadingPerf ? (
                  <div className="py-12 text-center text-gray-400">Loading performance data...</div>
                ) : (
                  <>
                    {/* Performance Reviews section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700">Performance Reviews</h3>
                        <button onClick={() => setShowReviewModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add Review
                        </button>
                      </div>

                      {reviews.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center text-gray-400">
                          <p className="text-sm">No performance reviews yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {reviews.map((rev) => (
                            <div key={rev.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-sm font-semibold text-gray-800">{rev.cycle_name || "—"}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE_REVIEW[rev.status] || "bg-gray-100 text-gray-600"}`}>
                                      {rev.status}
                                    </span>
                                    {rev.pip_active && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">PIP Active</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-2">
                                    <Stars rating={rev.rating} />
                                    <span className="text-xs text-gray-500">{rev.rating ? `${rev.rating}/5` : "Not rated"}</span>
                                  </div>
                                  {rev.goals_completion_pct != null && (
                                    <div className="mt-3">
                                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Goals Completion</span>
                                        <span className="font-medium">{rev.goals_completion_pct}%</span>
                                      </div>
                                      <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div className="h-2 rounded-full transition-all"
                                          style={{
                                            width: `${rev.goals_completion_pct}%`,
                                            backgroundColor: rev.goals_completion_pct >= 80 ? "#10b981" : rev.goals_completion_pct >= 50 ? "#3b82f6" : "#f59e0b",
                                          }} />
                                      </div>
                                    </div>
                                  )}
                                  {rev.notes && <p className="mt-2 text-xs text-gray-500 italic">"{rev.notes}"</p>}
                                </div>
                                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                                  {rev.next_review_date && <p>Next: {rev.next_review_date}</p>}
                                  <p className="mt-1">{rev.created_at?.slice(0, 10) || ""}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Discipline Cases section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700">Discipline Cases</h3>
                        <button onClick={() => setShowDisciplineModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add Case
                        </button>
                      </div>

                      {disciplines.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center text-gray-400">
                          <p className="text-sm">No discipline cases on record.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {disciplines.map((dc) => (
                            <div key={dc.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-xs font-mono text-gray-500">{dc.case_code}</span>
                                    <span className="text-sm font-medium text-gray-800">{dc.incident_type || "—"}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLE[dc.severity] || "bg-gray-100 text-gray-600"}`}>
                                      {dc.severity}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE_DISC[dc.status] || "bg-gray-100 text-gray-600"}`}>
                                      {dc.status}
                                    </span>
                                  </div>
                                  {dc.description && <p className="text-xs text-gray-600 mt-1">{dc.description}</p>}
                                  {dc.action_taken && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      <span className="font-medium">Action: </span>{dc.action_taken}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0">{dc.incident_date || dc.created_at?.slice(0, 10) || ""}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Add Review Modal ── */}
      {showReviewModal && (
        <Modal title="Add Performance Review" onClose={() => setShowReviewModal(false)}>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium uppercase">Cycle Name</label>
              <input type="text" value={reviewForm.cycle_name} onChange={(e) => setReviewForm((f) => ({ ...f, cycle_name: e.target.value }))}
                placeholder="e.g. Q2 2025" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium uppercase">Rating (1–5)</label>
                <input type="number" min={1} max={5} step={0.5} value={reviewForm.rating}
                  onChange={(e) => setReviewForm((f) => ({ ...f, rating: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium uppercase">Goals %</label>
                <input type="number" min={0} max={100} value={reviewForm.goals_completion_pct}
                  onChange={(e) => setReviewForm((f) => ({ ...f, goals_completion_pct: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium uppercase">Status</label>
                <select value={reviewForm.status} onChange={(e) => setReviewForm((f) => ({ ...f, status: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Pending</option><option>Completed</option><option>Overdue</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium uppercase">Next Review Date</label>
                <input type="date" value={reviewForm.next_review_date}
                  onChange={(e) => setReviewForm((f) => ({ ...f, next_review_date: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium uppercase">Notes</label>
              <textarea rows={3} value={reviewForm.notes} onChange={(e) => setReviewForm((f) => ({ ...f, notes: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pip" checked={reviewForm.pip_active}
                onChange={(e) => setReviewForm((f) => ({ ...f, pip_active: e.target.checked }))} />
              <label htmlFor="pip" className="text-sm text-gray-700">PIP Active</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveReview} disabled={savingPerf}
                className="flex-1 py-2 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium">
                {savingPerf ? "Saving..." : "Save Review"}
              </button>
              <button onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Discipline Case Modal ── */}
      {showDisciplineModal && (
        <Modal title="Add Discipline Case" onClose={() => setShowDisciplineModal(false)}>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium uppercase">Incident Type</label>
              <input type="text" value={disciplineForm.incident_type}
                onChange={(e) => setDisciplineForm((f) => ({ ...f, incident_type: e.target.value }))}
                placeholder="e.g. Misconduct, Attendance"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium uppercase">Severity</label>
                <select value={disciplineForm.severity}
                  onChange={(e) => setDisciplineForm((f) => ({ ...f, severity: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium uppercase">Status</label>
                <select value={disciplineForm.status}
                  onChange={(e) => setDisciplineForm((f) => ({ ...f, status: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Active</option><option>Resolved</option><option>PIP Active</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium uppercase">Incident Date</label>
              <input type="date" value={disciplineForm.incident_date}
                onChange={(e) => setDisciplineForm((f) => ({ ...f, incident_date: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium uppercase">Description</label>
              <textarea rows={3} value={disciplineForm.description}
                onChange={(e) => setDisciplineForm((f) => ({ ...f, description: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium uppercase">Action Taken</label>
              <input type="text" value={disciplineForm.action_taken}
                onChange={(e) => setDisciplineForm((f) => ({ ...f, action_taken: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveDiscipline} disabled={savingPerf}
                className="flex-1 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium">
                {savingPerf ? "Saving..." : "Save Case"}
              </button>
              <button onClick={() => setShowDisciplineModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Document Link Modal ── */}
      {showDocModal && (
        <Modal title="Add Document Link" onClose={() => setShowDocModal(false)}>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium uppercase">Document Name</label>
              <input type="text" value={docForm.name} onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Offer Letter, Education Certificate"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium uppercase">Document URL</label>
              <input type="url" value={docForm.url} onChange={(e) => setDocForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <p className="text-xs text-gray-400">Paste a shareable link from Google Drive, OneDrive, SharePoint, or any cloud storage.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={handleAddDoc}
                className="flex-1 py-2 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 font-medium">Add Document</button>
              <button onClick={() => setShowDocModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

    </HeaderWrapper>
  );
}
