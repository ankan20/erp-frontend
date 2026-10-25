"use client";

import { useState, useRef, useEffect } from "react";
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
  "This letter constitutes your formal offer of employment.",
  "Your employment is subject to satisfactory completion of background verification.",
  "You will be required to undergo a medical examination as a condition of employment.",
  "You must not, during the term of your employment, directly or indirectly engage in any business competitive with the Company.",
  "The Company reserves the right to transfer you to any of its other establishments, departments, or subsidiaries.",
  "Any intellectual property created in the course of your employment shall be the exclusive property of the Company.",
  "You are required to maintain strict confidentiality with respect to all Company information.",
  "This offer is subject to your providing satisfactory proof of educational qualifications and identity.",
  "Your employment is governed by the Company's policies, which are subject to change from time to time.",
  "Salary shall be paid on the last working day of each month.",
  "Annual performance appraisals will be conducted to review your compensation and responsibilities.",
  "Any disputes arising out of this agreement shall be resolved through arbitration.",
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
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedCandId, setSelectedCandId] = useState("");
  const [selectedCand, setSelectedCand] = useState(null);
  const [marking, setMarking] = useState(false);
  const [mode, setMode] = useState("candidate"); // "candidate" | "employee"
  const letterRef = useRef(null);

  useEffect(() => {
    Promise.all([
      apiRequest({ url: API_ENDPOINTS.HR.EMPLOYEE.LIST, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_LIST, method: "GET", params: { stage: "Offer" } }),
    ]).then(([er, cr]) => {
      if (er?.data) setEmployees(er.data);
      if (cr?.data) setCandidates(cr.data);
    });
  }, []);

  const loadEmployee = async (id) => {
    setSelectedEmpId(id);
    if (!id) return;
    const res = await apiRequest({ url: `${API_ENDPOINTS.HR.EMPLOYEE.GET_BY_ID}${id}`, method: "GET" });
    if (res?.data) {
      const e = res.data;
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
    }
  };

  const loadCandidate = async (id) => {
    setSelectedCandId(id);
    if (!id) { setSelectedCand(null); return; }
    const res = await apiRequest({ url: `${API_ENDPOINTS.HR.OFFER_LETTER.GET_CANDIDATE_DATA}${id}`, method: "GET" });
    if (res?.data) {
      const c = res.data;
      setSelectedCand(c);
      setForm((f) => ({
        ...f,
        employee_name: c.name || "",
        position: c.job_title || "",
        department: c.department || "",
        work_location: c.location || "",
      }));
    }
  };

  const markGenerated = async () => {
    if (!selectedCandId) return;
    setMarking(true);
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.RECRUITMENT.MARK_APPOINTMENT_LETTER}${selectedCandId}/mark-appointment-letter`,
      method: "PUT",
      data: {},
    });
    setMarking(false);
    if (res?.data) {
      toast.success("Appointment letter marked as generated");
      setSelectedCand((p) => p ? { ...p, appointment_letter_generated: true } : p);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const copyText = () => {
    if (letterRef.current) {
      const text = letterRef.current.innerText;
      navigator.clipboard.writeText(text).then(() => toast.success("Letter copied to clipboard"));
    }
  };

  const gross = [form.basic_monthly, form.hra_monthly, form.special_allowance, form.other_allowances]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);

  return (
    <HeaderWrapper>
      <PageHeader />
      <div className="p-4">
        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Left: Form */}
          <div className="w-full lg:w-96 flex-shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              {/* Mode toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                {[["candidate", "From Candidate (Pre-joining)"], ["employee", "From Employee (Post-joining)"]].map(([m, label]) => (
                  <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 transition-colors ${mode === m ? "bg-blue-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{label}</button>
                ))}
              </div>
              {mode === "candidate" ? (
                <>
                  <select value={selectedCandId} onChange={(e) => loadCandidate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Candidate (Offer stage)...</option>
                    {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.job_title}</option>)}
                  </select>
                  {selectedCand && (
                    <div className={`flex items-center justify-between p-2 rounded-lg border text-xs ${selectedCand.appointment_letter_generated ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-orange-50 border-orange-200 text-orange-700"}`}>
                      <span>{selectedCand.appointment_letter_generated ? "✅ Already marked generated" : "⚠️ Not yet marked as generated"}</span>
                      {!selectedCand.appointment_letter_generated && (
                        <button onClick={markGenerated} disabled={marking} className="ml-2 px-3 py-1 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 text-xs">{marking ? "..." : "Mark Generated"}</button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <select value={selectedEmpId} onChange={(e) => loadEmployee(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.emp_code} – {emp.full_name}</option>)}
                </select>
              )}
            </div>

            {[
              { title: "Company Details", fields: [["Company Name", "company_name"], ["Company Address", "company_address"], ["Letter Date", "date", "date"]] },
              { title: "Employee Details", fields: [["Employee Name", "employee_name"], ["Employee Address", "employee_address"], ["Position", "position"], ["Department", "department"], ["Date of Joining", "date_of_joining", "date"], ["Work Location", "work_location"]] },
              { title: "Compensation (₹)", fields: [["Annual CTC", "ctc_annual", "number"], ["Basic Monthly", "basic_monthly", "number"], ["HRA Monthly", "hra_monthly", "number"], ["Special Allowance", "special_allowance", "number"], ["Other Allowances", "other_allowances", "number"]] },
              { title: "Letter Settings", fields: [["Probation Period", "probation_period"], ["Notice Period", "notice_period"], ["Working Hours / Day", "working_hours"], ["Leaves Per Year", "leave_per_year", "number"]] },
              { title: "Signatory", fields: [["Signatory Name", "signatory_name"], ["Signatory Designation", "signatory_designation"]] },
            ].map(({ title, fields }) => (
              <div key={title} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">{title}</h3>
                {fields.map(([label, key, type = "text"]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={set(key)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Right: Letter Preview */}
          <div className="flex-1 space-y-2">
            <div className="flex justify-end gap-2">
              <button
                onClick={copyText}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Copy Text
              </button>
            </div>

            <div ref={letterRef} className="bg-white rounded-xl border border-gray-200 p-8 text-sm leading-relaxed min-h-[900px] font-serif">
              {/* Header */}
              <div className="text-center mb-2">
                <h1 className="text-xl font-bold text-gray-900">{form.company_name || "COMPANY NAME"}</h1>
                <p className="text-xs text-gray-500">{form.company_address}</p>
              </div>

              {/* Gold stripe */}
              <div className="h-1 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 rounded my-3" />

              <div className="flex justify-between text-xs text-gray-500 mb-4">
                <span>Date: {form.date}</span>
                <span>CONFIDENTIAL</span>
              </div>

              <p className="font-semibold text-gray-800 mb-1">APPOINTMENT LETTER</p>
              <p className="mb-4">
                To,<br />
                <strong>{form.employee_name || "[Employee Name]"}</strong><br />
                <span className="text-gray-600">{form.employee_address}</span>
              </p>

              <p className="mb-4">
                Dear <strong>{form.employee_name || "[Employee Name]"}</strong>,
              </p>

              <p className="mb-4">
                We are pleased to appoint you as <strong>{form.position || "[Position]"}</strong> in our{" "}
                <strong>{form.department || "[Department]"}</strong> department, with effect from{" "}
                <strong>{form.date_of_joining || "[Date of Joining]"}</strong>, at our{" "}
                <strong>{form.work_location || "[Location]"}</strong> location.
              </p>

              {/* Compensation Table */}
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

              {/* Terms */}
              <p className="font-semibold mb-2">Terms & Conditions</p>
              <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-700 mb-4">
                {TERMS.map((term, i) => <li key={i}>{term}</li>)}
                <li>Your probation period shall be <strong>{form.probation_period}</strong> from the date of joining.</li>
                <li>The notice period for resignation or termination shall be <strong>{form.notice_period}</strong>.</li>
              </ol>

              {/* Signature */}
              <div className="flex justify-between mt-10">
                <div>
                  <p className="font-semibold">{form.signatory_name || "[Authorised Signatory]"}</p>
                  <p className="text-xs text-gray-500">{form.signatory_designation || "[Designation]"}</p>
                  <p className="text-xs text-gray-500">{form.company_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">Accepted by</p>
                  <p className="text-xs text-gray-500 mt-6">{form.employee_name || "[Employee Name]"}</p>
                  <p className="text-xs text-gray-500">Signature & Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HeaderWrapper>
  );
}
