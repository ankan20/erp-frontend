"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";

const DEFAULT_FORM = {
  company_name: "",
  company_address: "",
  date: new Date().toISOString().split("T")[0],
  employee_name: "",
  employee_address: "",
  position: "",
  department: "",
  date_of_joining: "",
  ctc_annual: "",
  basic_monthly: "",
  hra_monthly: "",
  special_allowance: "",
  other_allowances: "",
  notice_period: "90 days",
  signatory_name: "",
  signatory_designation: "",
  probation_period: "6 months",
  work_location: "",
  working_hours: "9 hours",
  leave_per_year: "24",
};

const TERMS = [
  "This letter constitutes your formal appointment.",
  "Your employment is subject to satisfactory completion of background verification.",
  "You must not, during the term of your employment, directly or indirectly engage in any business competitive with the Company.",
  "The Company reserves the right to transfer you to any of its other establishments, departments, or subsidiaries.",
  "Any intellectual property created in the course of your employment shall be the exclusive property of the Company.",
  "You are required to maintain strict confidentiality with respect to all Company information.",
  "Your employment is governed by the Company's policies, which are subject to change from time to time.",
  "Salary shall be paid on the last working day of each month.",
  "Annual performance appraisals will be conducted to review your compensation and responsibilities.",
];

function numberToWords(n) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const num = parseInt(n || "0", 10);
  if (isNaN(num) || num === 0) return "Zero";
  if (num < 20) return a[num];
  if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? " " + a[num % 10] : "");
  if (num < 1000) return a[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + numberToWords(num % 100) : "");
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + numberToWords(num % 1000) : "");
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + numberToWords(num % 100000) : "");
  return numberToWords(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + numberToWords(num % 10000000) : "");
}

export default function AppointmentLetterPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [employees, setEmployees] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedCand, setSelectedCand] = useState(null);
  const [marking, setMarking] = useState(false);
  const [mode, setMode] = useState("candidate"); // "candidate" | "employee"
  const [showForm, setShowForm] = useState(false);
  const letterRef = useRef(null);

  const fetchData = useCallback(() => {
    Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.EMPLOYEE.LIST, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_LIST, method: "GET", params: { stage: "Offer" } }),
    ]).then(([er, cr]) => {
      if (er?.data) setEmployees(er.data);
      if (cr?.data) setCandidates(cr.data);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadCandidate = async (cand) => {
    setSelectedId(cand.id);
    const res = await apiRequest({ url: `${API_ENDPOINTS.HR.OFFER_LETTER.GET_CANDIDATE_DATA}${cand.id}`, method: "GET" });
    if (res?.data) {
      const c = res.data;
      setSelectedCand(c);
      setForm((f) => ({
        ...f,
        employee_name: c.name || "",
        position: c.job_title || "",
        department: c.department || "",
        work_location: c.location || "",
        ctc_annual: String(c.expected_ctc || ""),
      }));
      setShowForm(true);
    }
  };

  const loadEmployee = async (emp) => {
    setSelectedId(emp.id);
    const res = await apiRequest({ url: `${API_ENDPOINTS.HR.EMPLOYEE.GET_BY_ID}${emp.id}`, method: "GET" });
    if (res?.data) {
      const e = res.data;
      setSelectedCand(null);
      setForm((f) => ({
        ...f,
        employee_name: e.full_name || "",
        position: e.designation || "",
        department: e.department || "",
        date_of_joining: e.date_of_joining || "",
        ctc_annual: String(e.ctc_annual || ""),
        basic_monthly: String(e.basic_monthly || ""),
        hra_monthly: String(e.hra_monthly || ""),
        special_allowance: String(e.special_allowance || ""),
        other_allowances: String(e.other_allowances || ""),
        work_location: e.work_location || "",
      }));
      setShowForm(true);
    }
  };

  const markGenerated = async () => {
    if (!selectedId) return;
    setMarking(true);
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.RECRUITMENT.MARK_APPOINTMENT_LETTER}${selectedId}/mark-appointment-letter`,
      method: "PUT",
      data: {},
    });
    setMarking(false);
    if (res?.data) {
      toast.success("Appointment letter marked as generated");
      setSelectedCand((p) => p ? { ...p, appointment_letter_generated: true } : p);
      fetchData();
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const copyText = () => {
    if (letterRef.current) {
      navigator.clipboard.writeText(letterRef.current.innerText).then(() => toast.success("Copied to clipboard"));
    }
  };

  const gross = [form.basic_monthly, form.hra_monthly, form.special_allowance, form.other_allowances]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const generated = candidates.filter((c) => c.appointment_letter_generated);
  const pending = candidates.filter((c) => !c.appointment_letter_generated);

  return (
    <HeaderWrapper>
      <PageHeader />
      <div className="p-4 space-y-4">

        {/* Mode Toggle */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-medium bg-white w-fit">
          {[["candidate", "Candidate Mode (Pre-joining)"], ["employee", "Employee Mode (Post-joining)"]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setShowForm(false); setSelectedId(""); setSelectedCand(null); }}
              className={`px-5 py-2.5 transition-colors ${mode === m ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Candidate Lists (candidate mode) */}
        {mode === "candidate" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pending */}
            <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
              <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
                <span className="text-orange-600 text-sm font-semibold">⚠️ Pending — Appointment Letter Not Generated</span>
                <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{pending.length}</span>
              </div>
              {pending.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">All candidates have appointment letters generated.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pending.map((c) => (
                    <button key={c.id} onClick={() => loadCandidate(c)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 text-left transition-colors ${selectedId === c.id ? "bg-orange-50 border-l-2 border-orange-500" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {c.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.job_title} · {c.department || "—"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {c.offer_letter_generated
                          ? <span className="text-xs text-emerald-600 font-medium">Offer ✓</span>
                          : <span className="text-xs text-orange-400">No offer yet</span>}
                        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Generated */}
            <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
                <span className="text-emerald-700 text-sm font-semibold">✅ Generated — Appointment Letter Ready</span>
                <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{generated.length}</span>
              </div>
              {generated.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No appointment letters generated yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {generated.map((c) => (
                    <button key={c.id} onClick={() => loadCandidate(c)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-left transition-colors ${selectedId === c.id ? "bg-emerald-50 border-l-2 border-emerald-500" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {c.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.job_title} · {c.department || "—"}</p>
                      </div>
                      <span className="text-xs text-emerald-600 font-medium flex-shrink-0">View →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Employee List (employee mode) */}
        {mode === "employee" && (
          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
              <span className="text-blue-700 text-sm font-semibold">Employees — Select to generate appointment letter</span>
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{employees.length}</span>
            </div>
            {employees.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No employees found.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {employees.map((e) => (
                  <button key={e.id} onClick={() => loadEmployee(e)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors ${selectedId === e.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}>
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {e.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{e.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{e.emp_code} · {e.designation || "—"}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generator Form */}
        {showForm && (
          <div className="flex gap-4 flex-col lg:flex-row">
            {/* Left: controls */}
            <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
              {/* Status bar — candidate mode only */}
              {mode === "candidate" && selectedCand && (
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${selectedCand.appointment_letter_generated ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"}`}>
                  <div>
                    <p className={`text-sm font-semibold ${selectedCand.appointment_letter_generated ? "text-emerald-700" : "text-orange-700"}`}>
                      {selectedCand.appointment_letter_generated ? "✅ Already generated" : "⚠️ Not yet generated"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedCand.appointment_letter_generated ? "Letter is marked." : "Fill the letter, then mark as generated."}
                    </p>
                  </div>
                  {!selectedCand.appointment_letter_generated && (
                    <button onClick={markGenerated} disabled={marking}
                      className="ml-3 px-3 py-1.5 text-xs rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap flex-shrink-0 font-medium">
                      {marking ? "..." : "Mark Generated"}
                    </button>
                  )}
                </div>
              )}

              {[
                { title: "Company", fields: [["Company Name", "company_name"], ["Company Address", "company_address"], ["Letter Date", "date", "date"]] },
                { title: "Employee", fields: [["Name", "employee_name"], ["Address", "employee_address"], ["Position", "position"], ["Department", "department"], ["Date of Joining", "date_of_joining", "date"], ["Work Location", "work_location"]] },
                { title: "Compensation (₹)", fields: [["Annual CTC", "ctc_annual", "number"], ["Basic Monthly", "basic_monthly", "number"], ["HRA Monthly", "hra_monthly", "number"], ["Special Allowance", "special_allowance", "number"], ["Other Allowances", "other_allowances", "number"]] },
                { title: "Settings", fields: [["Probation Period", "probation_period"], ["Notice Period", "notice_period"], ["Working Hours/Day", "working_hours"], ["Leaves Per Year", "leave_per_year", "number"]] },
                { title: "Signatory", fields: [["Name", "signatory_name"], ["Designation", "signatory_designation"]] },
              ].map(({ title, fields }) => (
                <div key={title} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide border-b pb-1.5">{title}</h3>
                  {fields.map(([label, key, type = "text"]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-400 mb-0.5 block">{label}</label>
                      <input type={type} value={form[key]} onChange={set(key)}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Right: Letter Preview */}
            <div className="flex-1 space-y-2">
              <div className="flex justify-end gap-2">
                <button onClick={copyText} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Copy Text</button>
              </div>
              <div ref={letterRef} className="bg-white rounded-xl border border-gray-200 p-8 text-sm leading-relaxed min-h-[900px] font-serif">
                <div className="text-center mb-2">
                  <h1 className="text-xl font-bold text-gray-900">{form.company_name || "COMPANY NAME"}</h1>
                  <p className="text-xs text-gray-500">{form.company_address}</p>
                </div>
                <div className="h-1 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 rounded my-3" />
                <div className="flex justify-between text-xs text-gray-500 mb-4">
                  <span>Date: {form.date}</span>
                  <span>CONFIDENTIAL</span>
                </div>
                <p className="font-bold text-gray-800 mb-4 text-base tracking-wide">APPOINTMENT LETTER</p>
                <p className="mb-4">
                  To,<br /><strong>{form.employee_name || "[Employee Name]"}</strong><br />
                  <span className="text-gray-600 text-xs">{form.employee_address}</span>
                </p>
                <p className="mb-4">Dear <strong>{form.employee_name || "[Employee Name]"}</strong>,</p>
                <p className="mb-4">
                  We are pleased to appoint you as <strong>{form.position || "[Position]"}</strong> in our{" "}
                  <strong>{form.department || "[Department]"}</strong> department, with effect from{" "}
                  <strong>{form.date_of_joining || "[Date of Joining]"}</strong>, at our{" "}
                  <strong>{form.work_location || "[Location]"}</strong> location.
                </p>
                <p className="font-semibold mb-2">Compensation Structure</p>
                <table className="w-full border border-gray-300 text-xs mb-4">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-1.5 text-left">Component</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-right">Monthly (₹)</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-right">Annual (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Basic Salary", form.basic_monthly],
                      ["House Rent Allowance (HRA)", form.hra_monthly],
                      ["Special Allowance", form.special_allowance],
                      ["Other Allowances", form.other_allowances],
                    ].map(([label, val]) => (
                      <tr key={label}>
                        <td className="border border-gray-300 px-3 py-1">{label}</td>
                        <td className="border border-gray-300 px-3 py-1 text-right">{(parseFloat(val) || 0).toLocaleString("en-IN")}</td>
                        <td className="border border-gray-300 px-3 py-1 text-right">{((parseFloat(val) || 0) * 12).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="border border-gray-300 px-3 py-1">Gross Monthly</td>
                      <td className="border border-gray-300 px-3 py-1 text-right">{gross.toLocaleString("en-IN")}</td>
                      <td className="border border-gray-300 px-3 py-1 text-right">{(gross * 12).toLocaleString("en-IN")}</td>
                    </tr>
                    <tr className="bg-blue-50 font-bold">
                      <td className="border border-gray-300 px-3 py-1">CTC (Annual)</td>
                      <td className="border border-gray-300 px-3 py-1 text-right">—</td>
                      <td className="border border-gray-300 px-3 py-1 text-right">{(parseFloat(form.ctc_annual) || 0).toLocaleString("en-IN")}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-gray-600 mb-4">
                  Total CTC in words: <strong>{numberToWords(form.ctc_annual)} Rupees Per Annum</strong>
                </p>
                <p className="font-semibold mb-2">Terms & Conditions</p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-700 mb-4">
                  {TERMS.map((term, i) => <li key={i}>{term}</li>)}
                  <li>Your probation period shall be <strong>{form.probation_period}</strong> from the date of joining.</li>
                  <li>The notice period for resignation or termination shall be <strong>{form.notice_period}</strong>.</li>
                  <li>Working hours shall be <strong>{form.working_hours}</strong> per day.</li>
                  <li>You are entitled to <strong>{form.leave_per_year} days</strong> of paid leave per year.</li>
                </ol>
                <div className="flex justify-between mt-10">
                  <div>
                    <p className="font-semibold text-sm">{form.signatory_name || "[Authorised Signatory]"}</p>
                    <p className="text-xs text-gray-500">{form.signatory_designation}</p>
                    <p className="text-xs text-gray-500">{form.company_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">Accepted by</p>
                    <div className="mt-6 border-t border-gray-400 pt-1 w-48">
                      <p className="text-xs text-gray-500">{form.employee_name || "[Employee Name]"}</p>
                      <p className="text-xs text-gray-400">Signature & Date</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!showForm && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Select a candidate or employee above to generate their appointment letter.</p>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
