"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getCookie } from "@/lib/cookies";
import { getLocalStorage, setLocalStorage } from "@/lib/localStorage";
import { ROLE } from "@/config/role.config";
import { CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";

const ACK_KEYS = {
  DATA_COLLECTION:  "ack_data_collection",
  CONFIDENTIALITY:  "ack_confidentiality",
  FINANCIAL_INFO:   "ack_financial_info",
  ACTIVITY_LOGS:    "ack_activity_logs",
  RESPONSIBILITIES: "ack_responsibilities",
};

export default function ConsentPage() {
  const router = useRouter();

  const [acks, setAcks] = useState({
    [ACK_KEYS.DATA_COLLECTION]:  false,
    [ACK_KEYS.CONFIDENTIALITY]:  false,
    [ACK_KEYS.FINANCIAL_INFO]:   false,
    [ACK_KEYS.ACTIVITY_LOGS]:    false,
    [ACK_KEYS.RESPONSIBILITIES]: false,
  });
  const [finalConsent, setFinalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (!getLocalStorage("token")) { router.replace("/login"); return; }
  }, [router]);

  // Track whole-page scroll for the top progress bar
  const handleScroll = useCallback(() => {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if (total <= 0) return;
    setScrollProgress(Math.round((scrolled / total) * 100));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const allAcked = Object.values(acks).every(Boolean);
  const canSubmit = allAcked && finalConsent && !submitting;
  const ackedCount = Object.values(acks).filter(Boolean).length + (finalConsent ? 1 : 0);
  const totalChecks = Object.keys(acks).length + 1;

  const setAck = (key, val) => setAcks((p) => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await apiRequest({
        url: API_ENDPOINTS.CONSENT.ACCEPT,
        method: "POST",
        data: { acknowledgements: acks, final_consent: finalConsent },
      });
      setLocalStorage("consent_accepted", "true");
      toast.success("Agreement accepted. Welcome!");
      const role = getCookie("role");
      if (role === ROLE.SUPER_ADMIN) router.replace("/settings/company-details");
      else if (role === ROLE.ADMIN) router.replace("/master/ledger-code");
      else router.replace("/");
    } catch (err) {
      toast.error(err.message || "Could not record consent. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-50 bg-[#0c2d6b] text-white">
        <div className="px-8 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide">Dishaan Hi-tech (India) Pvt. Ltd.</p>
            <p className="text-xs text-blue-200">Employee Terms & Conditions · Data Privacy Agreement · v1.0</p>
          </div>
          <div className="text-right text-xs text-blue-200">
            {ackedCount}/{totalChecks} acknowledged
          </div>
        </div>
        <div className="h-[3px] bg-blue-900">
          <div
            className="h-full bg-blue-300 transition-all duration-100"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>

      {/* ── Document body ── */}
      <main className="max-w-5xl mx-auto px-8 pb-40 pt-10">

        {/* Title block */}
        <div className="border-b-2 border-[#0c2d6b] pb-6 mb-8">
          <p className="text-xs font-semibold tracking-widest text-[#0c2d6b] uppercase mb-2">
            Dishaan Hi-tech (India) Pvt. Ltd.
          </p>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-1">
            Employee Terms & Conditions and<br />Data Privacy Agreement
          </h1>
          <div className="flex flex-wrap gap-6 mt-3 text-sm text-gray-500">
            <span>Document Version: <strong className="text-gray-700">1.0</strong></span>
            <span>Effective Date: <strong className="text-gray-700">15 November 2025</strong></span>
            <span>GSTIN: <strong className="text-gray-700">19AAGCD1136P1ZC</strong></span>
          </div>
          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-[#0c2d6b]">
            <p className="text-sm text-gray-700 leading-relaxed">
              This Agreement governs your use of the PRAX ERP system. Please read every section carefully
              and complete all required acknowledgements before you may access the system.
            </p>
          </div>
        </div>

        {/* ── Sections ── */}

        <S n="1" title="Introduction and Purpose">
          <p>
            Dishaan Hi-tech (India) Pvt. Ltd. (&ldquo;the Company&rdquo;) operates an Enterprise Resource
            Planning (ERP) system to manage its business processes, resources, communication, and project
            activities. This Employee Terms & Conditions and Data Privacy Agreement (&ldquo;Agreement&rdquo;)
            governs the access and use of the ERP system by all employees, contractors, and authorised users
            of the Company.
          </p>
          <p className="mt-3">
            By accepting this Agreement, you acknowledge that you have read, understood, and agree to be bound
            by the terms described herein. This Agreement is a condition of your continued employment and access
            to Company systems.
          </p>
        </S>

        <S n="2" title="Employee Responsibilities">
          <p>As an authorised user of the Company ERP system, you are responsible for:</p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Using the system solely for legitimate business purposes authorised by the Company.</li>
            <li>Maintaining the confidentiality of your login credentials and not sharing them with any other person.</li>
            <li>Reporting any suspected security breach, unauthorised access, or system misuse to your reporting manager or the IT administrator promptly.</li>
            <li>Complying with all applicable Company policies, procedures, and applicable laws while using the system.</li>
            <li>Ensuring that any information entered into the system is accurate and complete to the best of your knowledge.</li>
          </ul>
        </S>

        <S n="3" title="ERP System Usage Policy">
          <p>
            The ERP system is provided exclusively for work-related activities of the Company. Use of the system
            for personal, unauthorised commercial, or any illegal activity is strictly prohibited.
          </p>
          <p className="mt-3">
            Access to specific modules within the ERP system is governed by your assigned role and project
            permissions. You may not attempt to access modules or data outside the scope of your assigned role.
          </p>
          <p className="mt-3">
            The Company reserves the right to modify, suspend, or revoke access to the system at any time for
            operational, security, or disciplinary reasons, without prior notice.
          </p>
        </S>

        <S n="4" title="Employee Account and Authentication Security">
          <p>Each user account in the ERP system is personal and non-transferable. You must:</p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Choose a strong password and not reuse passwords across systems.</li>
            <li>Log out of the system when leaving your workstation or device unattended.</li>
            <li>Immediately notify the IT administrator if you suspect that your credentials have been compromised.</li>
            <li>Not attempt to access the accounts or data of other employees.</li>
          </ul>
          <p className="mt-3">
            The Company may enforce session timeouts, password expiry policies, and multi-factor authentication
            at its discretion.
          </p>
        </S>

        <S n="5" title="Employee Personal Data Collection">
          <p>
            As part of your employment and your use of the ERP system, the Company may collect and process
            personal information about you, including but not limited to:
          </p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Full name, employee code, designation, and department.</li>
            <li>Contact details: email address and mobile number.</li>
            <li>Profile photograph and digital signature (where provided).</li>
            <li>Login credentials in encrypted form.</li>
            <li>Assigned roles, permissions, and project associations.</li>
            <li>Activity data generated through your use of the ERP system.</li>
          </ul>
        </S>
        <Ack
          id={ACK_KEYS.DATA_COLLECTION}
          checked={acks[ACK_KEYS.DATA_COLLECTION]}
          onChange={(v) => setAck(ACK_KEYS.DATA_COLLECTION, v)}
          label="I acknowledge that the Company may collect and process relevant personal information for legitimate employment and operational purposes as described in this Agreement."
        />

        <S n="6" title="Purpose of Data Collection and Processing">
          <p>The personal and operational information collected through the ERP system is used for:</p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Administration of your employment, payroll, attendance, and performance records.</li>
            <li>Management of project assignments, tasks, and workflows.</li>
            <li>Communication and collaboration among employees and project teams.</li>
            <li>Generation of reports for internal management and statutory compliance.</li>
            <li>Audit trails and system security monitoring.</li>
            <li>Compliance with applicable laws, regulations, and contractual obligations.</li>
          </ul>
        </S>

        <S n="7" title="Employee Data Access and Authorisation">
          <p>
            Access to employee personal data within the ERP system is restricted on a strict need-to-know basis.
            Access is granted based on your assigned organisational role and your assigned project scope and
            project-specific permissions.
          </p>
          <p className="mt-3">
            System administrators may access employee data for system administration, support, and security
            purposes. Authorised management personnel may access data relevant to their supervisory
            responsibilities. No employee may access data outside the scope of their assigned role and permissions.
          </p>
        </S>

        <S n="8" title="Data Confidentiality">
          <p>
            All information that you access, process, or generate through the ERP system is confidential and
            proprietary to the Company. You must:
          </p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Not disclose, copy, transfer, or publish any confidential information obtained through the ERP system to unauthorised persons, inside or outside the Company.</li>
            <li>Not retain confidential information beyond the period of your employment unless specifically authorised.</li>
            <li>Return or destroy all confidential information in your possession upon termination of your employment, as directed by the Company.</li>
          </ul>
          <p className="mt-3">This obligation of confidentiality continues after the termination of your employment.</p>
        </S>
        <Ack
          id={ACK_KEYS.CONFIDENTIALITY}
          checked={acks[ACK_KEYS.CONFIDENTIALITY]}
          onChange={(v) => setAck(ACK_KEYS.CONFIDENTIALITY, v)}
          label="I understand my responsibility to maintain the confidentiality of Company information and employee data accessed through the ERP system."
        />

        <S n="9" title="Business and Financial Information Protection">
          <p>
            The ERP system contains sensitive business and financial information, including project budgets,
            financial transactions, vendor information, billing records, and contractual details.
          </p>
          <p className="mt-3">You are strictly prohibited from:</p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Disclosing, copying, transmitting, or distributing any business or financial information from the ERP system to unauthorised persons.</li>
            <li>Using business or financial information accessed through the ERP system for personal benefit or competitive purposes.</li>
            <li>Modifying or deleting financial or business records without proper authorisation.</li>
          </ul>
        </S>
        <Ack
          id={ACK_KEYS.FINANCIAL_INFO}
          checked={acks[ACK_KEYS.FINANCIAL_INFO]}
          onChange={(v) => setAck(ACK_KEYS.FINANCIAL_INFO, v)}
          label="I understand that unauthorised disclosure, copying, modification, or distribution of Company financial and business information is prohibited."
        />

        <S n="10" title="Activity Logs and Audit Trails">
          <p>
            The ERP system records activity logs and audit trails for security, operational, and compliance
            purposes. This may include:
          </p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Login and logout timestamps associated with your user account.</li>
            <li>The IP address and device information from which you access the system.</li>
            <li>Module access events and actions performed within the system.</li>
            <li>Data entries, modifications, and approvals made by your user account.</li>
          </ul>
          <p className="mt-3">
            These records are maintained for internal security monitoring, operational auditing, and regulatory
            compliance.
          </p>
        </S>
        <Ack
          id={ACK_KEYS.ACTIVITY_LOGS}
          checked={acks[ACK_KEYS.ACTIVITY_LOGS]}
          onChange={(v) => setAck(ACK_KEYS.ACTIVITY_LOGS, v)}
          label="I acknowledge that my ERP account activities may be recorded for security, operational, and audit purposes, as described in this Agreement."
        />

        <S n="11" title="Device and Application Security">
          <p>
            You are responsible for maintaining the security of the device on which you access the ERP system.
            This includes ensuring up-to-date software, not installing untrusted applications, enabling
            device-level security controls, and not accessing the ERP system over unsecured public Wi-Fi
            networks without appropriate precautions.
          </p>
        </S>

        <S n="12" title="Data Retention and Storage">
          <p>
            Employee personal data and ERP records are retained for the period necessary to fulfil the purposes
            for which they were collected, and as required by applicable laws and regulations.
          </p>
          <p className="mt-3 text-amber-700 italic text-sm">
            [Note for Company Review: Specific retention periods for each category of data should be defined
            in consultation with legal counsel, in accordance with applicable Indian employment, tax, and
            regulatory requirements.]
          </p>
        </S>

        <S n="13" title="Third-Party Services and Infrastructure">
          <p>
            The ERP system may use third-party services and infrastructure for hosting, storage, file management,
            communication, and other operational purposes. The Company selects third-party service providers
            with appropriate security standards and contractual obligations.
          </p>
          <p className="mt-3 text-amber-700 italic text-sm">
            [Note for Company Review: Please identify and confirm the specific third-party service providers
            used and the data processing arrangements in place with each.]
          </p>
          <p className="mt-3">
            The Company does not sell or license your personal data to third parties for commercial purposes.
          </p>
        </S>

        <S n="14" title="Data Sharing and Disclosure">
          <p>Your personal and operational information may be shared with:</p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Authorised employees and management within the Company who have a legitimate need for such information.</li>
            <li>Third-party service providers engaged by the Company who process data on its behalf, under appropriate contractual protections.</li>
            <li>Regulatory authorities, government agencies, or courts, where required by applicable law.</li>
          </ul>
          <p className="mt-3">
            Personal data will not be disclosed to external parties outside of the circumstances described
            above without your prior consent, except where required by law.
          </p>
        </S>

        <S n="15" title="Employee Responsibilities During Employment">
          <p>During your employment, you must:</p>
          <ul className="mt-2 list-disc list-outside ml-5 space-y-1">
            <li>Access only those modules and data that you are authorised to use.</li>
            <li>Report immediately any breach, vulnerability, or suspected misuse of the ERP system.</li>
            <li>Follow all Company policies related to information security, data protection, and acceptable use of IT systems.</li>
            <li>Not attempt to bypass, circumvent, or interfere with any security control in the ERP system.</li>
            <li>Keep your login credentials confidential and change them regularly.</li>
            <li>Cooperate fully with any internal investigation related to ERP system usage or data security.</li>
          </ul>
        </S>
        <Ack
          id={ACK_KEYS.RESPONSIBILITIES}
          checked={acks[ACK_KEYS.RESPONSIBILITIES]}
          onChange={(v) => setAck(ACK_KEYS.RESPONSIBILITIES, v)}
          label="I agree to follow the Company's information security, data protection, and ERP usage policies during my employment."
        />

        <S n="16" title="Unauthorised Access and Misuse">
          <p>
            Unauthorised access to the ERP system or misuse of its features is strictly prohibited and may
            constitute a violation of applicable law, including the Information Technology Act, 2000 (India)
            and its amendments.
          </p>
          <p className="mt-3">
            Violation of this policy may result in immediate suspension of access, disciplinary action,
            and/or legal proceedings.
          </p>
        </S>

        <S n="17" title="Data Breach and Security Incident Reporting">
          <p>
            If you become aware of or suspect a data breach, security incident, or any unauthorised access
            to the ERP system, you must immediately report it to your reporting manager and the IT
            administrator. Do not attempt to investigate, correct, or conceal the incident independently
            without authorisation.
          </p>
        </S>

        <S n="18" title="Employee Rights and Data-Related Queries">
          <p>
            Subject to applicable law, you may have rights in relation to your personal data held by the
            Company, including the right to request access to, correction of, or deletion of your personal data.
          </p>
          <p className="mt-3 text-amber-700 italic text-sm">
            [Note for Company Review: This section should be reviewed in accordance with the Digital Personal
            Data Protection Act, 2023 (India) once specific compliance guidance is available.]
          </p>
          <p className="mt-3">
            To exercise any data-related right or raise a privacy concern, please contact the Company at the
            details provided in Section 22.
          </p>
        </S>

        <S n="19" title="Policy Updates and Amendments">
          <p>
            The Company reserves the right to amend or update this Agreement at any time. Where a material
            change is made, the Company will publish the updated Agreement with a new version number and
            effective date, and require employees to accept the updated Agreement before continuing to access
            the ERP system.
          </p>
        </S>

        <S n="20" title="Limitation of Liability">
          <p>
            The Company makes reasonable efforts to maintain the security and availability of the ERP system
            but does not warrant that the system will be error-free, uninterrupted, or entirely secure.
            The Company&apos;s total liability for any claim arising under this Agreement shall be limited
            to the extent permitted by applicable law.
          </p>
        </S>

        <S n="21" title="Governing Law and Jurisdiction">
          <p>
            This Agreement is governed by and construed in accordance with the laws of India. Any dispute
            arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction
            of the courts located in the State of West Bengal, India.
          </p>
          <p className="mt-3 text-amber-700 italic text-sm">
            [Note for Company Review: Please confirm the preferred governing jurisdiction with legal counsel
            before production deployment.]
          </p>
        </S>

        <S n="22" title="Company Contact Information">
          <p>
            For any queries, concerns, or requests relating to this Agreement or to the Company&apos;s data
            privacy practices, please contact:
          </p>
          <div className="mt-4 border border-gray-200 rounded p-4 text-sm space-y-1 bg-gray-50">
            <p className="font-semibold text-gray-900">Dishaan Hi-tech (India) Pvt. Ltd.</p>
            <p className="text-gray-600">Narayan Pakuria Uttarpara, Kolaghat, Purba Medinipur,</p>
            <p className="text-gray-600">West Bengal – 721151, India</p>
            <p className="text-gray-600 mt-2"><span className="font-medium text-gray-700">GSTIN:</span> 19AAGCD1136P1ZC</p>
            <p className="text-gray-600"><span className="font-medium text-gray-700">Contact:</span> Biswajit Dinda · 9007011223</p>
            <p className="text-gray-600"><span className="font-medium text-gray-700">Email:</span> dishaan.hitech@gmail.com</p>
          </div>
        </S>

        {/* ── Final declaration ── */}
        <div className="mt-10 border-t-2 border-gray-200 pt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Declaration and Final Agreement</h2>

          <blockquote className="border-l-4 border-[#0c2d6b] pl-4 py-1 text-gray-700 italic text-sm leading-relaxed mb-6">
            &ldquo;I confirm that I have read and understood the Employee Terms & Conditions and Data Privacy
            Agreement of Dishaan Hi-tech (India) Pvt. Ltd. I acknowledge the responsibilities described in
            this document and agree to comply with the applicable Company policies.&rdquo;
          </blockquote>

          {!allAcked && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded mb-5 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              Please complete all{" "}
              {Object.values(acks).filter((v) => !v).length} remaining acknowledgement
              {Object.values(acks).filter((v) => !v).length !== 1 ? "s" : ""} above before proceeding.
            </div>
          )}

          <Ack
            id="final_consent"
            checked={finalConsent}
            onChange={allAcked ? setFinalConsent : undefined}
            label="I have read, understood, and voluntarily agree to the Employee Terms & Conditions and Data Privacy Agreement of Dishaan Hi-tech (India) Pvt. Ltd."
            disabled={!allAcked}
            strong
          />
        </div>
      </main>

      {/* ── Sticky bottom action bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between gap-6">
          <div className="text-sm text-gray-500">
            {canSubmit ? (
              <span className="text-green-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> All acknowledgements complete
              </span>
            ) : (
              <span>{ackedCount}/{totalChecks} acknowledgements completed</span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`
              px-10 py-2.5 rounded text-sm font-semibold transition-all duration-150
              flex items-center gap-2
              ${canSubmit
                ? "bg-[#0c2d6b] hover:bg-[#0a2558] text-white shadow cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              }
            `}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
            ) : (
              "Agree & Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function S({ n, title, children }) {
  return (
    <div className="py-6 border-b border-gray-100">
      <h3 className="text-base font-semibold text-[#0c2d6b] mb-3">
        {n}. {title}
      </h3>
      <div className="text-sm text-gray-700 leading-7">{children}</div>
    </div>
  );
}

// ── Inline acknowledgement ────────────────────────────────────────────────────
function Ack({ id, checked, onChange, label, disabled = false, strong = false }) {
  return (
    <label
      htmlFor={id}
      className={`
        flex items-start gap-3 my-4 p-4
        border-l-4 transition-colors select-none
        ${checked ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <div className="mt-0.5 shrink-0">
        {checked
          ? <CheckCircle2 className="w-5 h-5 text-green-600" />
          : <Circle className={`w-5 h-5 ${disabled ? "text-gray-300" : "text-gray-400"}`} />
        }
      </div>
      <span className={`text-sm leading-relaxed ${strong ? "font-medium text-gray-900" : "text-gray-700"}`}>
        {label}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled || !onChange}
        onChange={(e) => onChange?.(e.target.checked)}
        className="sr-only"
      />
    </label>
  );
}
