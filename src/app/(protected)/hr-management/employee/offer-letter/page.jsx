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
  const letterRef = useRef(null);

  useEffect(() => {
    apiRequest({
      url: API_ENDPOINTS.HR.RECRUITMENT.CANDIDATES_LIST,
      method: "GET",
      params: { stage: "Offer" },
    }).then((r) => r?.data && setCandidates(r.data));
  }, []);

  const loadCandidate = async (id) => {
    setSelectedCandId(id);
    if (!id) return;
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.OFFER_LETTER.GET_CANDIDATE_DATA}${id}`,
      method: "GET",
    });
    if (res?.data) {
      const c = res.data;
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
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const copyText = () => {
    if (letterRef.current) {
      navigator.clipboard
        .writeText(letterRef.current.innerText)
        .then(() => toast.success("Offer letter copied to clipboard"));
    }
  };

  return (
    <HeaderWrapper>
      <PageHeader />
      <div className="p-4">
        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Left: Form */}
          <div className="w-full lg:w-96 flex-shrink-0 space-y-4">
            {/* Load candidate */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Load from Candidate</h3>
              <select
                value={selectedCandId}
                onChange={(e) => loadCandidate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Candidate (Offer stage)...</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.job_title}
                  </option>
                ))}
              </select>
            </div>

            {[
              {
                title: "Company Details",
                fields: [
                  ["Company Name", "company_name"],
                  ["Company Address", "company_address"],
                  ["Letter Date", "date", "date"],
                ],
              },
              {
                title: "Candidate Details",
                fields: [
                  ["Candidate Name", "candidate_name"],
                  ["Candidate Email", "candidate_email", "email"],
                  ["Candidate Address", "candidate_address"],
                ],
              },
              {
                title: "Role Details",
                fields: [
                  ["Position / Designation", "position"],
                  ["Department", "department"],
                  ["Work Location", "location"],
                  ["Employment Type", "employment_type"],
                  ["Proposed Date of Joining", "date_of_joining", "date"],
                ],
              },
              {
                title: "Offer Terms",
                fields: [
                  ["CTC Offered (Annual)", "ctc_offered"],
                  ["Offer Valid Till", "offer_valid_till", "date"],
                  ["Notice Period", "notice_period"],
                ],
              },
              {
                title: "Signatory",
                fields: [
                  ["Signatory Name", "signatory_name"],
                  ["Signatory Designation", "signatory_designation"],
                ],
              },
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

            <div
              ref={letterRef}
              className="bg-white rounded-xl border border-gray-200 p-8 text-sm leading-relaxed min-h-[820px] font-serif"
            >
              {/* Letterhead */}
              <div className="text-center mb-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {form.company_name || "COMPANY NAME"}
                </h1>
                <p className="text-xs text-gray-500">{form.company_address}</p>
              </div>
              <div className="h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-blue-700 rounded my-3" />

              <div className="flex justify-between text-xs text-gray-500 mb-5">
                <span>Date: {form.date}</span>
                <span>PRIVATE & CONFIDENTIAL</span>
              </div>

              <p className="font-bold text-gray-800 mb-4 text-base tracking-wide">
                OFFER LETTER
              </p>

              <p className="mb-4">
                To,
                <br />
                <strong>{form.candidate_name || "[Candidate Name]"}</strong>
                <br />
                <span className="text-gray-600 text-xs">
                  {form.candidate_email}
                  {form.candidate_address ? ` · ${form.candidate_address}` : ""}
                </span>
              </p>

              <p className="mb-4">
                Dear <strong>{form.candidate_name || "[Candidate Name]"}</strong>,
              </p>

              <p className="mb-4">
                We are pleased to extend this offer of employment to you for the position of{" "}
                <strong>{form.position || "[Position]"}</strong> in our{" "}
                <strong>{form.department || "[Department]"}</strong> department at{" "}
                <strong>{form.location || "[Location]"}</strong>, on a{" "}
                <strong>{form.employment_type}</strong> basis.
              </p>

              {form.date_of_joining && (
                <p className="mb-4">
                  Your proposed date of joining is{" "}
                  <strong>{form.date_of_joining}</strong>.
                </p>
              )}

              {/* Offer Summary Table */}
              <table className="w-full border border-gray-300 text-xs mb-5">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left">Detail</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Position", form.position],
                    ["Department", form.department],
                    ["Work Location", form.location],
                    ["Employment Type", form.employment_type],
                    ["Annual CTC", form.ctc_offered ? `₹ ${Number(form.ctc_offered).toLocaleString("en-IN")}` : "—"],
                    ["Date of Joining", form.date_of_joining || "To be confirmed"],
                    ["Offer Valid Till", form.offer_valid_till || "—"],
                    ["Notice Period", form.notice_period],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td className="border border-gray-300 px-3 py-1.5 font-medium text-gray-700">{label}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-gray-800">{val || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mb-4 text-xs text-gray-700">
                This offer is conditional upon satisfactory completion of reference checks and
                background verification. Please confirm your acceptance of this offer by signing
                and returning a copy of this letter on or before{" "}
                <strong>{form.offer_valid_till || "[Offer Valid Till Date]"}</strong>.
              </p>

              <p className="mb-4 text-xs text-gray-700">
                We look forward to you joining our team. Should you have any questions, please
                do not hesitate to contact us.
              </p>

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
      </div>
    </HeaderWrapper>
  );
}
