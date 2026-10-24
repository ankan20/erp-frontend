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
  candidate_name: "",
  candidate_email: "",
  candidate_address: "",
  position: "",
  department: "",
  location: "",
  date_of_joining: "",
  ctc_offered: "",
  offer_valid_till: "",
  notice_period: "30 days",
  signatory_name: "",
  signatory_designation: "",
  employment_type: "Full-time",
};

export default function OfferLetterPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandId, setSelectedCandId] = useState("");
  const [selectedCand, setSelectedCand] = useState(null);
  const [marking, setMarking] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const letterRef = useRef(null);

  const fetchCandidates = useCallback(() => {
    apiRequest({ url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_LIST, method: "GET", params: { stage: "Offer" } })
      .then((r) => r?.data && setCandidates(r.data));
  }, []);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const loadCandidate = async (cand) => {
    setSelectedCandId(cand.id);
    const res = await apiRequest({ url: `${API_ENDPOINTS.HR.OFFER_LETTER.GET_CANDIDATE_DATA}${cand.id}`, method: "GET" });
    if (res?.data) {
      const c = res.data;
      setSelectedCand(c);
      setForm((f) => ({
        ...f,
        candidate_name: c.name || "",
        candidate_email: c.email || "",
        position: c.job_title || "",
        department: c.department || "",
        location: c.location || "",
        ctc_offered: c.expected_ctc || "",
        employment_type: c.job_type || "Full-time",
      }));
      setShowForm(true);
    }
  };

  const markGenerated = async () => {
    if (!selectedCandId) return;
    setMarking(true);
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.RECRUITMENT.MARK_OFFER_LETTER}${selectedCandId}/mark-offer-letter`,
      method: "PUT",
      data: {},
    });
    setMarking(false);
    if (res?.data) {
      toast.success("Offer letter marked as generated");
      setSelectedCand((p) => p ? { ...p, offer_letter_generated: true } : p);
      fetchCandidates();
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const copyText = () => {
    if (letterRef.current) {
      navigator.clipboard.writeText(letterRef.current.innerText).then(() => toast.success("Copied to clipboard"));
    }
  };

  const generated = candidates.filter((c) => c.offer_letter_generated);
  const pending = candidates.filter((c) => !c.offer_letter_generated);

  return (
    <HeaderWrapper>
      <PageHeader />
      <div className="p-4 space-y-4">

        {/* Candidate Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Not Generated */}
          <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
              <span className="text-orange-600 text-sm font-semibold">⚠️ Pending — Offer Letter Not Generated</span>
              <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{pending.length}</span>
            </div>
            {pending.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">All candidates have offer letters generated.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {pending.map((c) => (
                  <button key={c.id} onClick={() => loadCandidate(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 text-left transition-colors ${selectedCandId === c.id ? "bg-orange-50 border-l-2 border-orange-500" : ""}`}>
                    <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {c.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.job_title} · {c.department || "—"}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generated */}
          <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
              <span className="text-emerald-700 text-sm font-semibold">✅ Generated — Offer Letter Ready</span>
              <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{generated.length}</span>
            </div>
            {generated.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No offer letters generated yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {generated.map((c) => (
                  <button key={c.id} onClick={() => loadCandidate(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-left transition-colors ${selectedCandId === c.id ? "bg-emerald-50 border-l-2 border-emerald-500" : ""}`}>
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

        {/* Generator Form — shown after selecting a candidate */}
        {showForm && selectedCand && (
          <div className="flex gap-4 flex-col lg:flex-row">
            {/* Left: controls */}
            <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
              {/* Status bar */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${selectedCand.offer_letter_generated ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"}`}>
                <div>
                  <p className={`text-sm font-semibold ${selectedCand.offer_letter_generated ? "text-emerald-700" : "text-orange-700"}`}>
                    {selectedCand.offer_letter_generated ? "✅ Already generated" : "⚠️ Not yet generated"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedCand.offer_letter_generated ? "Letter is marked. Candidate can now receive appointment letter." : "Fill the letter, then mark as generated."}
                  </p>
                </div>
                {!selectedCand.offer_letter_generated && (
                  <button onClick={markGenerated} disabled={marking}
                    className="ml-3 px-3 py-1.5 text-xs rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap flex-shrink-0 font-medium">
                    {marking ? "..." : "Mark Generated"}
                  </button>
                )}
              </div>

              {[
                { title: "Company", fields: [["Company Name", "company_name"], ["Company Address", "company_address"], ["Letter Date", "date", "date"]] },
                { title: "Candidate", fields: [["Name", "candidate_name"], ["Email", "candidate_email", "email"], ["Address", "candidate_address"]] },
                { title: "Role", fields: [["Position", "position"], ["Department", "department"], ["Location", "location"], ["Employment Type", "employment_type"], ["Date of Joining", "date_of_joining", "date"]] },
                { title: "Offer Terms", fields: [["CTC (Annual)", "ctc_offered"], ["Offer Valid Till", "offer_valid_till", "date"], ["Notice Period", "notice_period"]] },
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

            {/* Right: letter preview */}
            <div className="flex-1 space-y-2">
              <div className="flex justify-end gap-2">
                <button onClick={copyText} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Copy Text</button>
              </div>
              <div ref={letterRef} className="bg-white rounded-xl border border-gray-200 p-8 text-sm leading-relaxed min-h-[820px] font-serif">
                <div className="text-center mb-2">
                  <h1 className="text-xl font-bold text-gray-900">{form.company_name || "COMPANY NAME"}</h1>
                  <p className="text-xs text-gray-500">{form.company_address}</p>
                </div>
                <div className="h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-blue-700 rounded my-3" />
                <div className="flex justify-between text-xs text-gray-500 mb-5">
                  <span>Date: {form.date}</span>
                  <span>PRIVATE & CONFIDENTIAL</span>
                </div>
                <p className="font-bold text-gray-800 mb-4 text-base tracking-wide">OFFER LETTER</p>
                <p className="mb-4">To,<br /><strong>{form.candidate_name || "[Candidate Name]"}</strong><br />
                  <span className="text-gray-600 text-xs">{form.candidate_email}{form.candidate_address ? ` · ${form.candidate_address}` : ""}</span></p>
                <p className="mb-4">Dear <strong>{form.candidate_name || "[Candidate Name]"}</strong>,</p>
                <p className="mb-4">We are pleased to extend this offer of employment to you for the position of <strong>{form.position || "[Position]"}</strong> in our <strong>{form.department || "[Department]"}</strong> department at <strong>{form.location || "[Location]"}</strong>, on a <strong>{form.employment_type}</strong> basis.</p>
                {form.date_of_joining && <p className="mb-4">Your proposed date of joining is <strong>{form.date_of_joining}</strong>.</p>}
                <table className="w-full border border-gray-300 text-xs mb-5">
                  <thead><tr className="bg-gray-50"><th className="border border-gray-300 px-3 py-2 text-left">Detail</th><th className="border border-gray-300 px-3 py-2 text-left">Value</th></tr></thead>
                  <tbody>
                    {[["Position", form.position], ["Department", form.department], ["Work Location", form.location], ["Employment Type", form.employment_type],
                      ["Annual CTC", form.ctc_offered ? `₹ ${Number(form.ctc_offered).toLocaleString("en-IN")}` : "—"],
                      ["Date of Joining", form.date_of_joining || "To be confirmed"], ["Offer Valid Till", form.offer_valid_till || "—"], ["Notice Period", form.notice_period],
                    ].map(([label, val]) => (
                      <tr key={label}><td className="border border-gray-300 px-3 py-1.5 font-medium text-gray-700">{label}</td><td className="border border-gray-300 px-3 py-1.5">{val || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mb-4 text-xs text-gray-700">This offer is conditional upon satisfactory completion of reference checks and background verification. Please confirm your acceptance by signing and returning a copy on or before <strong>{form.offer_valid_till || "[Offer Valid Till Date]"}</strong>.</p>
                <p className="mb-4 text-xs text-gray-700">We look forward to you joining our team.</p>
                <p className="mb-8 text-xs text-gray-700">Yours sincerely,</p>
                <div className="flex justify-between mt-10">
                  <div>
                    <p className="font-semibold text-sm">{form.signatory_name || "[Authorised Signatory]"}</p>
                    <p className="text-xs text-gray-500">{form.signatory_designation}</p>
                    <p className="text-xs text-gray-500">{form.company_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">Accepted by</p>
                    <div className="mt-6 border-t border-gray-400 pt-1 w-48">
                      <p className="text-xs text-gray-500">{form.candidate_name || "[Candidate Name]"}</p>
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
            <p className="text-sm">Select a candidate above to generate or view their offer letter.</p>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
