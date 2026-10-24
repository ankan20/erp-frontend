"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getPageActions } from "@/components/common/PageActionButtons";
import { toast } from "sonner";

const INIT = {
  emp_code: "", full_name: "", date_of_birth: "", gender: "", blood_group: "",
  nationality: "Indian", mother_tongue: "", marital_status: "",
  personal_mobile: "", personal_email: "", current_address: "", permanent_address: "",
  aadhaar_masked: "", pan_number: "", passport_number: "", passport_expiry: "",
  emergency_contact_name: "", emergency_contact_relation: "", emergency_contact_mobile: "",
  designation: "", department: "", date_of_joining: "", employment_type: "Full-time",
  employee_status: "Active", grade_band: "", work_location: "", cost_centre: "",
  probation_end_date: "", confirmation_date: "", work_email: "", desk_seat_number: "",
  ctc_annual: "", basic_monthly: "", hra_monthly: "", special_allowance: "", other_allowances: "",
  pf_applicable: true, pf_uan: "", esi_applicable: false, gratuity_eligible: true,
  bank_name: "", bank_account_masked: "", ifsc_code: "", payment_mode: "NEFT",
  degree: "", specialization: "", university: "", year_of_passing: "", percentage_cgpa: "",
  total_experience: "", relevant_experience: "", primary_skills: "", secondary_skills: "",
  cv_url: "",
};

const TABS = [
  { label: "Personal & Identity", icon: "👤" },
  { label: "Employment Details", icon: "🏢" },
  { label: "Payroll & Bank", icon: "💰" },
  { label: "Qualifications & CV", icon: "🎓" },
];

function Input({ label, name, value, onChange, type = "text", required }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} name={name} value={value ?? ""} onChange={onChange}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

function Select({ label, name, value, onChange, options, required }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select name={name} value={value ?? ""} onChange={onChange}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">Select...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Textarea({ label, name, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      <textarea name={name} value={value ?? ""} onChange={onChange} rows={2}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
    </div>
  );
}

function Toggle({ label, name, checked, onChange }) {
  return (
    <div className="flex items-center gap-2 pt-4">
      <input type="checkbox" id={name} checked={!!checked}
        onChange={(e) => onChange({ target: { name, value: e.target.checked } })}
        className="w-4 h-4 accent-blue-700" />
      <label htmlFor={name} className="text-sm text-gray-700 select-none">{label}</label>
    </div>
  );
}

export default function NewEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState(INIT);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.HR.EMPLOYEE.LIST, method: "GET" }).then(
      (r) => r?.data && setEmployees(r.data)
    );
  }, []);

  const handle = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.emp_code || !form.full_name) {
      toast.error("Employee Code and Full Name are required");
      return;
    }
    setSaving(true);
    const res = await apiRequest({
      url: API_ENDPOINTS.HR.EMPLOYEE.CREATE,
      method: "POST",
      data: form,
    });
    setSaving(false);
    if (res?.data?.id) {
      toast.success("Employee created successfully");
      router.push(`/hr-management/employee/${res.data.id}`);
    }
  };

  const actions = getPageActions([
    { label: saving ? "Creating..." : "Create Employee", onClick: handleSubmit, variant: "primary", loading: saving },
    { label: "Cancel", onClick: () => router.push("/hr-management/employee"), variant: "secondary" },
  ]);

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />
      <div className="p-4 max-w-5xl space-y-4">

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-xl p-5 text-white flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {form.full_name ? form.full_name.charAt(0).toUpperCase() : "?"}
          </div>
          <div>
            <p className="text-lg font-semibold">{form.full_name || "New Employee"}</p>
            <p className="text-sm text-blue-100">{form.designation || "Designation"} · {form.department || "Department"}</p>
            <p className="text-xs text-blue-200 mt-0.5">{form.emp_code || "EMP-CODE"} · {form.employment_type}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200 bg-white -mx-4 px-4 overflow-x-auto">
          {TABS.map(({ label, icon }, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === i ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">

          {/* Tab 0: Personal */}
          {tab === 0 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Basic Info</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Employee Code" name="emp_code" value={form.emp_code} onChange={handle} required />
                  <Input label="Full Name" name="full_name" value={form.full_name} onChange={handle} required />
                  <Input label="Date of Birth" name="date_of_birth" value={form.date_of_birth} onChange={handle} type="date" />
                  <Select label="Gender" name="gender" value={form.gender} onChange={handle} options={["Male", "Female", "Other"]} />
                  <Input label="Blood Group" name="blood_group" value={form.blood_group} onChange={handle} />
                  <Input label="Nationality" name="nationality" value={form.nationality} onChange={handle} />
                  <Input label="Mother Tongue" name="mother_tongue" value={form.mother_tongue} onChange={handle} />
                  <Select label="Marital Status" name="marital_status" value={form.marital_status} onChange={handle} options={["Single", "Married", "Divorced", "Widowed"]} />
                  <Input label="Personal Mobile" name="personal_mobile" value={form.personal_mobile} onChange={handle} />
                  <Input label="Personal Email" name="personal_email" value={form.personal_email} onChange={handle} type="email" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Address</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Textarea label="Current Address" name="current_address" value={form.current_address} onChange={handle} />
                  <Textarea label="Permanent Address" name="permanent_address" value={form.permanent_address} onChange={handle} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Identity Documents</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Aadhaar (Masked: XXXX-XXXX-1234)" name="aadhaar_masked" value={form.aadhaar_masked} onChange={handle} />
                  <Input label="PAN Number" name="pan_number" value={form.pan_number} onChange={handle} />
                  <Input label="Passport Number" name="passport_number" value={form.passport_number} onChange={handle} />
                  <Input label="Passport Expiry" name="passport_expiry" value={form.passport_expiry} onChange={handle} type="date" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Emergency Contact</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Contact Name" name="emergency_contact_name" value={form.emergency_contact_name} onChange={handle} />
                  <Input label="Relation" name="emergency_contact_relation" value={form.emergency_contact_relation} onChange={handle} />
                  <Input label="Mobile" name="emergency_contact_mobile" value={form.emergency_contact_mobile} onChange={handle} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Employment */}
          {tab === 1 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Role & Posting</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Designation" name="designation" value={form.designation} onChange={handle} />
                  <Input label="Department" name="department" value={form.department} onChange={handle} />
                  <Input label="Date of Joining" name="date_of_joining" value={form.date_of_joining} onChange={handle} type="date" required />
                  <Select label="Employment Type" name="employment_type" value={form.employment_type} onChange={handle} options={["Full-time", "Contract", "Intern", "Part-time"]} />
                  <Select label="Status" name="employee_status" value={form.employee_status} onChange={handle} options={["Active", "Inactive", "On Notice"]} />
                  <Input label="Grade Band" name="grade_band" value={form.grade_band} onChange={handle} />
                  <Input label="Work Location" name="work_location" value={form.work_location} onChange={handle} />
                  <Input label="Cost Centre" name="cost_centre" value={form.cost_centre} onChange={handle} />
                  <Input label="Work Email" name="work_email" value={form.work_email} onChange={handle} type="email" />
                  <Input label="Desk / Seat No." name="desk_seat_number" value={form.desk_seat_number} onChange={handle} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Probation & Confirmation</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Probation End Date" name="probation_end_date" value={form.probation_end_date} onChange={handle} type="date" />
                  <Input label="Confirmation Date" name="confirmation_date" value={form.confirmation_date} onChange={handle} type="date" />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reporting Manager</label>
                    <select name="reporting_manager_id" value={form.reporting_manager_id ?? ""} onChange={handle}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select Manager...</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.emp_code})</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Payroll */}
          {tab === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Compensation</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Annual CTC (₹)" name="ctc_annual" value={form.ctc_annual} onChange={handle} type="number" />
                  <Input label="Basic Monthly (₹)" name="basic_monthly" value={form.basic_monthly} onChange={handle} type="number" />
                  <Input label="HRA Monthly (₹)" name="hra_monthly" value={form.hra_monthly} onChange={handle} type="number" />
                  <Input label="Special Allowance (₹)" name="special_allowance" value={form.special_allowance} onChange={handle} type="number" />
                  <Input label="Other Allowances (₹)" name="other_allowances" value={form.other_allowances} onChange={handle} type="number" />
                </div>
                <div className="flex gap-6 mt-4 flex-wrap">
                  <Toggle label="PF Applicable" name="pf_applicable" checked={form.pf_applicable} onChange={handle} />
                  <Toggle label="ESI Applicable" name="esi_applicable" checked={form.esi_applicable} onChange={handle} />
                  <Toggle label="Gratuity Eligible" name="gratuity_eligible" checked={form.gratuity_eligible} onChange={handle} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">PF & Bank Details</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="PF UAN" name="pf_uan" value={form.pf_uan} onChange={handle} />
                  <Input label="Bank Name" name="bank_name" value={form.bank_name} onChange={handle} />
                  <Input label="Account No. (Masked)" name="bank_account_masked" value={form.bank_account_masked} onChange={handle} />
                  <Input label="IFSC Code" name="ifsc_code" value={form.ifsc_code} onChange={handle} />
                  <Select label="Payment Mode" name="payment_mode" value={form.payment_mode} onChange={handle} options={["NEFT", "RTGS", "Cheque", "Cash"]} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Qualifications */}
          {tab === 3 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Education</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Degree" name="degree" value={form.degree} onChange={handle} />
                  <Input label="Specialization" name="specialization" value={form.specialization} onChange={handle} />
                  <Input label="University / Institution" name="university" value={form.university} onChange={handle} />
                  <Input label="Year of Passing" name="year_of_passing" value={form.year_of_passing} onChange={handle} type="number" />
                  <Input label="Percentage / CGPA" name="percentage_cgpa" value={form.percentage_cgpa} onChange={handle} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Experience & Skills</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Total Experience (yrs)" name="total_experience" value={form.total_experience} onChange={handle} type="number" />
                  <Input label="Relevant Experience (yrs)" name="relevant_experience" value={form.relevant_experience} onChange={handle} type="number" />
                  <div className="col-span-2">
                    <Textarea label="Primary Skills (comma-separated)" name="primary_skills" value={form.primary_skills} onChange={handle} />
                  </div>
                  <div className="col-span-2">
                    <Textarea label="Secondary Skills (comma-separated)" name="secondary_skills" value={form.secondary_skills} onChange={handle} />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-3 border-b pb-2">Resume / CV</p>
                <div className="grid grid-cols-1 gap-4">
                  <Input label="CV / Resume URL (Google Drive, OneDrive, etc.)" name="cv_url" value={form.cv_url} onChange={handle} />
                  {form.cv_url && (
                    <a href={form.cv_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                      📄 Preview CV
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div className="flex justify-between">
          <button onClick={() => setTab((t) => Math.max(0, t - 1))} disabled={tab === 0}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            ← Previous
          </button>
          {tab < TABS.length - 1 ? (
            <button onClick={() => setTab((t) => Math.min(TABS.length - 1, t + 1))}
              className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="px-6 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-semibold disabled:opacity-60">
              {saving ? "Creating..." : "✓ Create Employee"}
            </button>
          )}
        </div>
      </div>
    </HeaderWrapper>
  );
}
