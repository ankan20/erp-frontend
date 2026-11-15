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

  const handleScroll = useCallback(() => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if (total <= 0) return;
    setScrollProgress(Math.round((window.scrollY / total) * 100));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const allAcked   = Object.values(acks).every(Boolean);
  const canSubmit  = allAcked && finalConsent && !submitting;
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
      else if (role === ROLE.ADMIN)  router.replace("/master/ledger-code");
      else                           router.replace("/");
    } catch (err) {
      toast.error(err.message || "Could not record consent. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#f8f7f4] min-h-screen">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-50 bg-[#2c2c2c] text-white">
        <div className="px-8 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Dishaan Hi-tech (India) Pvt. Ltd.</p>
            <p className="text-xs text-gray-400 mt-0.5">Employee Agreement · Version 1.0 · 15 November 2025</p>
          </div>
          <span className="text-xs text-gray-400 tabular-nums">{ackedCount} / {totalChecks}</span>
        </div>
        <div className="h-[2px] bg-[#1a1a1a]">
          <div className="h-full bg-amber-500 transition-all duration-100" style={{ width: `${scrollProgress}%` }} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 pb-32 pt-10">

        {/* ── Title ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Dishaan Hi-tech (India) Pvt. Ltd.</span>
            <span className="h-px flex-1 bg-gray-300" />
          </div>
          <h1 className="text-[28px] font-bold text-gray-900 leading-snug mb-3">
            Employee Terms & Conditions and<br />Data Privacy Agreement
          </h1>
          <div className="flex flex-wrap gap-5 text-sm text-gray-500 mb-5">
            <span>Version <strong className="text-gray-700">1.0</strong></span>
            <span>Effective <strong className="text-gray-700">15 November 2025</strong></span>
            <span>GSTIN <strong className="text-gray-700">19AAGCD1136P1ZC</strong></span>
          </div>
          <div className="border-l-[3px] border-amber-400 pl-4 py-1 bg-amber-50 text-sm text-gray-700 leading-relaxed">
            Please read every section carefully and check each acknowledgement box as you go.
            You must complete all acknowledgements before the &ldquo;Agree & Continue&rdquo; button activates.
          </div>
        </div>

        {/* ── Sections ── */}

        <S n="1" title="Introduction and Purpose">
          <P>
            Dishaan Hi-tech (India) Pvt. Ltd. (&ldquo;the Company&rdquo;) operates an Enterprise Resource Planning
            (ERP) system to manage its business processes, resources, communication, and project activities.
            This Agreement governs the access and use of the ERP system by all employees, contractors, and
            authorised users of the Company.
          </P>
          <P>
            By accepting this Agreement, you acknowledge that you have read, understood, and agree to be bound
            by the terms described herein. This Agreement is a condition of your continued employment and access
            to Company systems.
          </P>
        </S>

        <S n="2" title="Employee Responsibilities">
          <P>As an authorised user of the ERP system, you are responsible for:</P>
          <UL items={[
            "Using the system solely for legitimate business purposes authorised by the Company.",
            "Maintaining the confidentiality of your login credentials and not sharing them with any other person.",
            "Reporting any suspected security breach, unauthorised access, or system misuse to your reporting manager or the IT administrator promptly.",
            "Complying with all applicable Company policies, procedures, and applicable laws while using the system.",
            "Ensuring that any information entered into the system is accurate and complete to the best of your knowledge.",
          ]} />
        </S>

        <S n="3" title="ERP System Usage Policy">
          <P>
            The ERP system is provided exclusively for work-related activities of the Company. Use of the system
            for personal, unauthorised commercial, or any illegal activity is strictly prohibited.
          </P>
          <P>
            Access to specific modules within the ERP system is governed by your assigned role and project
            permissions. You may not attempt to access modules or data outside the scope of your assigned role.
          </P>
          <P>
            The Company reserves the right to modify, suspend, or revoke access to the system at any time for
            operational, security, or disciplinary reasons, without prior notice.
          </P>
        </S>

        <S n="4" title="Employee Account and Authentication Security">
          <P>Each user account in the ERP system is personal and non-transferable. You must:</P>
          <UL items={[
            "Choose a strong password and not reuse passwords across systems.",
            "Log out of the system when leaving your workstation or device unattended.",
            "Immediately notify the IT administrator if you suspect that your credentials have been compromised.",
            "Not attempt to access the accounts or data of other employees.",
          ]} />
          <P>
            The Company may enforce session timeouts, password expiry policies, and multi-factor authentication
            at its discretion.
          </P>
        </S>

        <S n="5" title="Employee Personal Data Collection">
          <P>
            As part of your employment and your use of the ERP system, the Company may collect and process
            personal information about you, including but not limited to:
          </P>
          <UL items={[
            "Full name, employee code, designation, and department.",
            "Contact details: email address and mobile number.",
            "Profile photograph and digital signature (where provided).",
            "Login credentials in encrypted form.",
            "Assigned roles, permissions, and project associations.",
            "Activity data generated through your use of the ERP system.",
          ]} />
        </S>
        <Ack
          id={ACK_KEYS.DATA_COLLECTION}
          checked={acks[ACK_KEYS.DATA_COLLECTION]}
          onChange={(v) => setAck(ACK_KEYS.DATA_COLLECTION, v)}
          label="I acknowledge that the Company may collect and process relevant personal information for legitimate employment and operational purposes as described in this Agreement."
        />

        <S n="6" title="Purpose of Data Collection and Processing">
          <P>The personal and operational information collected through the ERP system is used for:</P>
          <UL items={[
            "Administration of your employment, payroll, attendance, and performance records.",
            "Management of project assignments, tasks, and workflows.",
            "Communication and collaboration among employees and project teams.",
            "Generation of reports for internal management and statutory compliance.",
            "Audit trails and system security monitoring.",
            "Compliance with applicable laws, regulations, and contractual obligations.",
          ]} />
        </S>

        <S n="7" title="Employee Data Access and Authorisation">
          <P>
            Access to employee personal data within the ERP system is restricted on a strict need-to-know basis.
            Access is granted based on your assigned organisational role and your assigned project scope and
            project-specific permissions.
          </P>
          <P>
            System administrators may access employee data for system administration, support, and security
            purposes. Authorised management personnel may access data relevant to their supervisory
            responsibilities. No employee may access data outside the scope of their assigned role and permissions.
          </P>
        </S>

        <S n="8" title="Data Confidentiality">
          <P>
            All information that you access, process, or generate through the ERP system is confidential and
            proprietary to the Company. You must:
          </P>
          <UL items={[
            "Not disclose, copy, transfer, or publish any confidential information obtained through the ERP system to unauthorised persons, inside or outside the Company.",
            "Not retain confidential information beyond the period of your employment unless specifically authorised.",
            "Return or destroy all confidential information in your possession upon termination of your employment, as directed by the Company.",
          ]} />
          <P>This obligation of confidentiality continues after the termination of your employment.</P>
        </S>
        <Ack
          id={ACK_KEYS.CONFIDENTIALITY}
          checked={acks[ACK_KEYS.CONFIDENTIALITY]}
          onChange={(v) => setAck(ACK_KEYS.CONFIDENTIALITY, v)}
          label="I understand my responsibility to maintain the confidentiality of Company information and employee data accessed through the ERP system."
        />

        <S n="9" title="Business and Financial Information Protection">
          <P>
            The ERP system contains sensitive business and financial information, including project budgets,
            financial transactions, vendor information, billing records, and contractual details.
          </P>
          <P>You are strictly prohibited from:</P>
          <UL items={[
            "Disclosing, copying, transmitting, or distributing any business or financial information from the ERP system to unauthorised persons.",
            "Using business or financial information accessed through the ERP system for personal benefit or competitive purposes.",
            "Modifying or deleting financial or business records without proper authorisation.",
          ]} />
        </S>
        <Ack
          id={ACK_KEYS.FINANCIAL_INFO}
          checked={acks[ACK_KEYS.FINANCIAL_INFO]}
          onChange={(v) => setAck(ACK_KEYS.FINANCIAL_INFO, v)}
          label="I understand that unauthorised disclosure, copying, modification, or distribution of Company financial and business information is prohibited."
        />

        <S n="10" title="Activity Logs and Audit Trails">
          <P>
            The ERP system records activity logs and audit trails for security, operational, and compliance
            purposes. This may include:
          </P>
          <UL items={[
            "Login and logout timestamps associated with your user account.",
            "The IP address and device information from which you access the system.",
            "Module access events and actions performed within the system.",
            "Data entries, modifications, and approvals made by your user account.",
          ]} />
          <P>
            These records are maintained for internal security monitoring, operational auditing, and regulatory
            compliance.
          </P>
        </S>
        <Ack
          id={ACK_KEYS.ACTIVITY_LOGS}
          checked={acks[ACK_KEYS.ACTIVITY_LOGS]}
          onChange={(v) => setAck(ACK_KEYS.ACTIVITY_LOGS, v)}
          label="I acknowledge that my ERP account activities may be recorded for security, operational, and audit purposes, as described in this Agreement."
        />

        <S n="11" title="Device and Application Security">
          <P>
            You are responsible for maintaining the security of the device on which you access the ERP system.
            This includes ensuring up-to-date software, not installing untrusted applications, enabling
            device-level security controls, and not accessing the ERP system over unsecured public Wi-Fi
            networks without appropriate precautions.
          </P>
        </S>

        <S n="12" title="Data Retention and Storage">
          <P>
            Employee personal data and ERP records are retained for the period necessary to fulfil the purposes
            for which they were collected, and as required by applicable laws and regulations.
          </P>
          <Note>
            Specific retention periods for each category of data should be defined in consultation with legal
            counsel, in accordance with applicable Indian employment, tax, and regulatory requirements.
          </Note>
        </S>

        <S n="13" title="Third-Party Services and Infrastructure">
          <P>
            The ERP system may use third-party services and infrastructure for hosting, storage, file management,
            communication, and other operational purposes. The Company selects third-party service providers
            with appropriate security standards and contractual obligations.
          </P>
          <P>The Company does not sell or license your personal data to third parties for commercial purposes.</P>
        </S>

        <S n="14" title="Data Sharing and Disclosure">
          <P>Your personal and operational information may be shared with:</P>
          <UL items={[
            "Authorised employees and management within the Company who have a legitimate need for such information.",
            "Third-party service providers engaged by the Company who process data on its behalf, under appropriate contractual protections.",
            "Regulatory authorities, government agencies, or courts, where required by applicable law.",
          ]} />
          <P>
            Personal data will not be disclosed to external parties outside of the circumstances described
            above without your prior consent, except where required by law.
          </P>
        </S>

        <S n="15" title="Employee Responsibilities During Employment">
          <P>During your employment, you must:</P>
          <UL items={[
            "Access only those modules and data that you are authorised to use.",
            "Report immediately any breach, vulnerability, or suspected misuse of the ERP system.",
            "Follow all Company policies related to information security, data protection, and acceptable use of IT systems.",
            "Not attempt to bypass, circumvent, or interfere with any security control in the ERP system.",
            "Keep your login credentials confidential and change them regularly.",
            "Cooperate fully with any internal investigation related to ERP system usage or data security.",
          ]} />
        </S>
        <Ack
          id={ACK_KEYS.RESPONSIBILITIES}
          checked={acks[ACK_KEYS.RESPONSIBILITIES]}
          onChange={(v) => setAck(ACK_KEYS.RESPONSIBILITIES, v)}
          label="I agree to follow the Company's information security, data protection, and ERP usage policies during my employment."
        />

        <S n="16" title="Unauthorised Access and Misuse">
          <P>
            Unauthorised access to the ERP system or misuse of its features is strictly prohibited and may
            constitute a violation of applicable law, including the Information Technology Act, 2000 (India)
            and its amendments.
          </P>
          <P>
            Violation of this policy may result in immediate suspension of access, disciplinary action,
            and/or legal proceedings.
          </P>
        </S>

        <S n="17" title="Data Breach and Security Incident Reporting">
          <P>
            If you become aware of or suspect a data breach, security incident, or any unauthorised access
            to the ERP system, you must immediately report it to your reporting manager and the IT administrator.
            Do not attempt to investigate, correct, or conceal the incident independently without authorisation.
          </P>
        </S>

        <S n="18" title="Employee Rights and Data-Related Queries">
          <P>
            Subject to applicable law, you may have rights in relation to your personal data held by the
            Company, including the right to request access to, correction of, or deletion of your personal data.
          </P>
          <Note>
            This section should be reviewed in accordance with the Digital Personal Data Protection Act, 2023
            (India) once specific compliance guidance is available.
          </Note>
          <P>
            To exercise any data-related right or raise a privacy concern, please contact the Company at the
            details provided in Section 22.
          </P>
        </S>

        <S n="19" title="Policy Updates and Amendments">
          <P>
            The Company reserves the right to amend or update this Agreement at any time. Where a material
            change is made, the Company will publish the updated Agreement with a new version number and
            effective date, and require employees to accept the updated Agreement before continuing to access
            the ERP system.
          </P>
        </S>

        <S n="20" title="Limitation of Liability">
          <P>
            The Company makes reasonable efforts to maintain the security and availability of the ERP system
            but does not warrant that the system will be error-free, uninterrupted, or entirely secure.
            The Company&apos;s total liability for any claim arising under this Agreement shall be limited to
            the extent permitted by applicable law.
          </P>
        </S>

        <S n="21" title="Governing Law and Jurisdiction">
          <P>
            This Agreement is governed by and construed in accordance with the laws of India. Any dispute
            arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction
            of the courts located in the State of West Bengal, India.
          </P>
        </S>

        <S n="22" title="Company Contact Information">
          <P>
            For any queries, concerns, or requests relating to this Agreement or to the Company&apos;s data
            privacy practices, please contact:
          </P>
          <div className="mt-4 bg-white border border-gray-200 rounded p-4 text-sm text-gray-700 space-y-1">
            <p className="font-semibold text-gray-900">Dishaan Hi-tech (India) Pvt. Ltd.</p>
            <p>Narayan Pakuria Uttarpara, Kolaghat, Purba Medinipur, West Bengal – 721151, India</p>
            <p className="mt-2"><span className="font-medium text-gray-800">GSTIN:</span> 19AAGCD1136P1ZC</p>
            <p><span className="font-medium text-gray-800">Contact:</span> Biswajit Dinda &nbsp;·&nbsp; 9007011223</p>
            <p><span className="font-medium text-gray-800">Email:</span> dishaan.hitech@gmail.com</p>
          </div>
        </S>

        {/* ── Final declaration ── */}
        <div className="mt-12 pt-8 border-t-2 border-gray-300">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Declaration and Final Agreement</h2>

          <blockquote className="border-l-[3px] border-gray-400 pl-4 text-gray-600 italic text-sm leading-7 mb-6">
            &ldquo;I confirm that I have read and understood the Employee Terms & Conditions and Data Privacy
            Agreement of Dishaan Hi-tech (India) Pvt. Ltd. I acknowledge the responsibilities described in
            this document and agree to comply with the applicable Company policies.&rdquo;
          </blockquote>

          {!allAcked && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded mb-5 text-sm text-orange-800">
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
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between gap-6">
          <p className="text-sm text-gray-500">
            {canSubmit
              ? <span className="text-emerald-700 font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> All acknowledgements complete</span>
              : <>{ackedCount} of {totalChecks} acknowledgements completed</>
            }
          </p>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`
              px-8 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-2
              ${canSubmit
                ? "bg-gray-900 hover:bg-gray-700 text-white cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              }
            `}
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
              : "Agree & Continue"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function S({ n, title, children }) {
  return (
    <div className="py-6 border-b border-gray-200">
      <h3 className="text-[15px] font-semibold text-gray-800 mb-3">{n}.&nbsp; {title}</h3>
      <div className="text-[14px] text-gray-700 leading-7 space-y-0">{children}</div>
    </div>
  );
}

function P({ children }) {
  return <p className="text-[14px] text-gray-700 leading-7">{children}</p>;
}

function UL({ items }) {
  return (
    <ul className="mt-2 mb-2 list-disc list-outside ml-5 space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-[14px] text-gray-700 leading-6">{item}</li>
      ))}
    </ul>
  );
}

function Note({ children }) {
  return (
    <p className="mt-3 text-[13px] text-amber-700 italic leading-6">
      Note for review: {children}
    </p>
  );
}

function Ack({ id, checked, onChange, label, disabled = false, strong = false }) {
  return (
    <label
      htmlFor={id}
      className={`
        flex items-start gap-3 my-3 px-4 py-3 rounded
        border transition-colors select-none
        ${checked  ? "border-emerald-300 bg-emerald-50"  : "border-gray-200 bg-white"}
        ${disabled ? "opacity-40 cursor-not-allowed"     : "cursor-pointer hover:bg-gray-50"}
        ${checked && !disabled ? "hover:bg-emerald-50" : ""}
      `}
    >
      <div className="mt-0.5 shrink-0">
        {checked
          ? <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600" />
          : <Circle       className={`w-[18px] h-[18px] ${disabled ? "text-gray-300" : "text-gray-400"}`} />
        }
      </div>
      <span className={`text-[13px] leading-6 ${strong ? "font-medium text-gray-900" : "text-gray-700"}`}>
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
