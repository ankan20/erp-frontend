"use client";

import { useState, useEffect } from "react";
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
];

function Field({ label, value, edit, onChange, type = "text" }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {edit ? (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <span className="text-sm text-gray-800">{value || "—"}</span>
      )}
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { empId } = useParams();
  const router = useRouter();
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!empId || empId === "new") return;
    apiRequest({ url: `${API_ENDPOINTS.HR.EMPLOYEE.GET_BY_ID}${empId}`, method: "GET" }).then(
      (r) => {
        if (r?.data) {
          setEmp(r.data);
          setForm(r.data);
        }
      }
    );
  }, [empId]);

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    setSaving(true);
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.EMPLOYEE.UPDATE}${empId}`,
      method: "PUT",
      data: form,
    });
    if (res?.data) {
      setEmp(res.data);
      setForm(res.data);
      toast.success("Employee updated");
      setEditing(false);
    }
    setSaving(false);
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
    emp.employee_status === "Active"
      ? "bg-emerald-100 text-emerald-700"
      : emp.employee_status === "Inactive"
      ? "bg-red-100 text-red-700"
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
            <p className="text-sm text-gray-500 mt-0.5">
              {emp.designation} · {emp.department}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {emp.emp_code} · Joined {emp.date_of_joining || "—"} · {emp.employment_type}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === i
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* Personal Tab */}
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

            {/* Employment Tab */}
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
              </div>
            )}

            {/* Payroll Tab */}
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

            {/* Qualifications Tab */}
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

            {/* Documents Tab */}
            {activeTab === 4 && (
              <div className="space-y-3">
                {[
                  "Offer Letter",
                  "Appointment Letter",
                  "ID Proof",
                  "Address Proof",
                  "Education Certificates",
                  "PAN Card",
                  "Aadhaar Card",
                  "Bank Details",
                  "Previous Employment Letter",
                  "Passport (if applicable)",
                ].map((doc) => (
                  <div key={doc} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                    <span className="text-sm text-gray-700">{doc}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Not Uploaded</span>
                  </div>
                ))}
              </div>
            )}

            {/* IT & Access Tab */}
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
          </div>
        </div>
      </div>
    </HeaderWrapper>
  );
}
