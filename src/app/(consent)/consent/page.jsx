"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getCookie } from "@/lib/cookies";
import { getLocalStorage, setLocalStorage } from "@/lib/localStorage";
import { ROLE } from "@/config/role.config";
import { CheckCircle2, Circle, AlertCircle, Building2, FileText, ChevronDown } from "lucide-react";

// ── Acknowledgement IDs (must match backend REQUIRED_ACKS) ───────────────────
const ACK_KEYS = {
  DATA_COLLECTION:  "ack_data_collection",
  CONFIDENTIALITY:  "ack_confidentiality",
  FINANCIAL_INFO:   "ack_financial_info",
  ACTIVITY_LOGS:    "ack_activity_logs",
  RESPONSIBILITIES: "ack_responsibilities",
};

export default function ConsentPage() {
  const router = useRouter();
  const scrollRef = useRef(null);

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

  // Guard: redirect away if no token
  useEffect(() => {
    const token = getLocalStorage("token");
    if (!token) { router.replace("/login"); return; }
  }, [router]);

  const ackedCount = Object.values(acks).filter(Boolean).length + (finalConsent ? 1 : 0);
  const totalChecks = Object.keys(acks).length + 1;
  const allAcked = Object.values(acks).every(Boolean);
  const canSubmit = allAcked && finalConsent && !submitting;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    setScrollProgress(Math.round((el.scrollTop / max) * 100));
  }, []);

  const setAck = (key, value) => setAcks((prev) => ({ ...prev, [key]: value }));

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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top header bar ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-800 shrink-0" />
            <div>
              <p className="text-blue-900 font-bold text-sm leading-tight">Dishaan Hi-tech (India) Pvt. Ltd.</p>
              <p className="text-gray-500 text-xs">Employee Terms & Conditions and Data Privacy Agreement</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500">Version 1.0 · 15 Nov 2025</p>
            <p className="text-xs font-medium text-blue-700">{ackedCount}/{totalChecks} acknowledged</p>
          </div>
        </div>
        {/* progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-700 transition-all duration-150"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 gap-6">

        {/* ── Document header ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-lg shrink-0">
              <FileText className="w-7 h-7 text-blue-800" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                Employee Terms & Conditions<br />& Data Privacy Agreement
              </h1>
              <div className="flex flex-wrap gap-4 mt-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Version 1.0</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Effective: 15 November 2025</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Dishaan Hi-tech (India) Pvt. Ltd.</span>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 leading-relaxed">
                  This Agreement sets out the terms and conditions governing your use of the PRAX ERP system and
                  the Company&apos;s data privacy practices. Please read it carefully and complete all required
                  acknowledgements before proceeding.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable document body ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 340px)", minHeight: 400 }}
        >
          <div className="p-6 space-y-0 divide-y divide-gray-100">

            <Section title="1. Introduction and Purpose">
              Dishaan Hi-tech (India) Pvt. Ltd. (&ldquo;the Company&rdquo;) operates an Enterprise Resource Planning (ERP) system to manage its business processes, resources, communication, and project activities. This Employee Terms & Conditions and Data Privacy Agreement (&ldquo;Agreement&rdquo;) governs the access and use of the ERP system by all employees, contractors, and authorised users of the Company.
              <br /><br />
              By accepting this Agreement, you acknowledge that you have read, understood, and agree to be bound by the terms described herein. This Agreement is a condition of your continued employment and access to Company systems.
            </Section>

            <Section title="2. Employee Responsibilities">
              As an authorised user of the Company ERP system, you are responsible for:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Using the system solely for legitimate business purposes authorised by the Company.</li>
                <li>Maintaining the confidentiality of your login credentials and not sharing them with any other person.</li>
                <li>Reporting any suspected security breach, unauthorised access, or system misuse to your reporting manager or the IT administrator promptly.</li>
                <li>Complying with all applicable Company policies, procedures, and applicable laws while using the system.</li>
                <li>Ensuring that any information entered into the system is accurate and complete to the best of your knowledge.</li>
              </ul>
            </Section>

            <Section title="3. ERP System Usage Policy">
              The ERP system is provided exclusively for work-related activities of the Company. Use of the system for personal, unauthorised commercial, or any illegal activity is strictly prohibited.
              <br /><br />
              Access to specific modules within the ERP system is governed by your assigned role and project permissions. You may not attempt to access modules or data outside the scope of your assigned role.
              <br /><br />
              The Company reserves the right to modify, suspend, or revoke access to the system at any time for operational, security, or disciplinary reasons, without prior notice.
            </Section>

            <Section title="4. Employee Account and Authentication Security">
              Each user account in the ERP system is personal and non-transferable. You must:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Choose a strong password and not reuse passwords across systems.</li>
                <li>Log out of the system when leaving your workstation or device unattended.</li>
                <li>Immediately notify the IT administrator if you suspect that your credentials have been compromised.</li>
                <li>Not attempt to access the accounts or data of other employees.</li>
              </ul>
              <br />
              The Company may enforce session timeouts, password expiry policies, and multi-factor authentication at its discretion.
            </Section>

            <Section title="5. Employee Personal Data Collection">
              As part of your employment and your use of the ERP system, the Company may collect and process personal information about you, including but not limited to:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Full name, employee code, designation, and department.</li>
                <li>Contact details: email address and mobile number.</li>
                <li>Profile photograph and digital signature (where provided).</li>
                <li>Login credentials in encrypted form.</li>
                <li>Assigned roles, permissions, and project associations.</li>
                <li>Activity data generated through your use of the ERP system.</li>
              </ul>
            </Section>
            <AckBox
              id={ACK_KEYS.DATA_COLLECTION}
              checked={acks[ACK_KEYS.DATA_COLLECTION]}
              onChange={(v) => setAck(ACK_KEYS.DATA_COLLECTION, v)}
              label="I acknowledge that the Company may collect and process relevant personal information for legitimate employment and operational purposes as described in this Agreement."
            />

            <Section title="6. Purpose of Data Collection and Processing">
              The personal and operational information collected through the ERP system is used for the following purposes:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Administration of your employment, payroll, attendance, and performance records.</li>
                <li>Management of project assignments, tasks, and workflows.</li>
                <li>Communication and collaboration among employees and project teams.</li>
                <li>Generation of reports for internal management and statutory compliance.</li>
                <li>Audit trails and system security monitoring.</li>
                <li>Compliance with applicable laws, regulations, and contractual obligations.</li>
              </ul>
            </Section>

            <Section title="7. Employee Data Access and Authorisation">
              Access to employee personal data within the ERP system is restricted on a strict need-to-know basis. Access is granted based on your assigned organisational role (e.g., user, manager, administrator) and your assigned project scope and project-specific permissions.
              <br /><br />
              System administrators may access employee data for system administration, support, and security purposes. Authorised management personnel may access data relevant to their supervisory responsibilities. No employee may access data outside the scope of their assigned role and permissions.
            </Section>

            <Section title="8. Data Confidentiality">
              All information that you access, process, or generate through the ERP system is confidential and proprietary to the Company. You must:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Not disclose, copy, transfer, or publish any confidential information obtained through the ERP system to unauthorised persons, inside or outside the Company.</li>
                <li>Not retain confidential information beyond the period of your employment unless specifically authorised.</li>
                <li>Return or destroy all confidential information in your possession upon termination of your employment, as directed by the Company.</li>
              </ul>
              <br />
              This obligation of confidentiality continues after the termination of your employment.
            </Section>
            <AckBox
              id={ACK_KEYS.CONFIDENTIALITY}
              checked={acks[ACK_KEYS.CONFIDENTIALITY]}
              onChange={(v) => setAck(ACK_KEYS.CONFIDENTIALITY, v)}
              label="I understand my responsibility to maintain the confidentiality of Company information and employee data accessed through the ERP system."
            />

            <Section title="9. Business and Financial Information Protection">
              The ERP system contains sensitive business and financial information, including project budgets, financial transactions, vendor information, billing records, and contractual details.
              <br /><br />
              You are strictly prohibited from:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Disclosing, copying, transmitting, or distributing any business or financial information from the ERP system to unauthorised persons.</li>
                <li>Using business or financial information accessed through the ERP system for personal benefit or competitive purposes.</li>
                <li>Modifying or deleting financial or business records without proper authorisation.</li>
              </ul>
            </Section>
            <AckBox
              id={ACK_KEYS.FINANCIAL_INFO}
              checked={acks[ACK_KEYS.FINANCIAL_INFO]}
              onChange={(v) => setAck(ACK_KEYS.FINANCIAL_INFO, v)}
              label="I understand that unauthorised disclosure, copying, modification, or distribution of Company financial and business information is prohibited."
            />

            <Section title="10. Activity Logs and Audit Trails">
              The ERP system records activity logs and audit trails for security, operational, and compliance purposes. This may include:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Login and logout timestamps associated with your user account.</li>
                <li>The IP address and device information from which you access the system.</li>
                <li>Module access events and actions performed within the system.</li>
                <li>Data entries, modifications, and approvals made by your user account.</li>
              </ul>
              <br />
              These records are maintained for internal security monitoring, operational auditing, and regulatory compliance.
            </Section>
            <AckBox
              id={ACK_KEYS.ACTIVITY_LOGS}
              checked={acks[ACK_KEYS.ACTIVITY_LOGS]}
              onChange={(v) => setAck(ACK_KEYS.ACTIVITY_LOGS, v)}
              label="I acknowledge that my ERP account activities may be recorded for security, operational, and audit purposes, as described in this Agreement."
            />

            <Section title="11. Device and Application Security">
              You are responsible for maintaining the security of the device on which you access the ERP system. This includes ensuring up-to-date software, not installing untrusted applications, enabling device-level security controls, and not accessing the ERP system over unsecured public Wi-Fi networks without appropriate precautions.
            </Section>

            <Section title="12. Data Retention and Storage">
              Employee personal data and ERP records are retained for the period necessary to fulfil the purposes for which they were collected, and as required by applicable laws and regulations.
              <br /><br />
              <span className="italic text-amber-700">[Note for Company Review: Specific retention periods for each category of data should be defined in consultation with legal counsel, in accordance with applicable Indian employment, tax, and regulatory requirements.]</span>
            </Section>

            <Section title="13. Third-Party Services and Infrastructure">
              The ERP system may use third-party services and infrastructure for hosting, storage, file management, communication, and other operational purposes. The Company selects third-party service providers with appropriate security standards and contractual obligations.
              <br /><br />
              <span className="italic text-amber-700">[Note for Company Review: Please identify and confirm the specific third-party service providers used and the data processing arrangements in place with each.]</span>
              <br /><br />
              The Company does not sell or license your personal data to third parties for commercial purposes.
            </Section>

            <Section title="14. Data Sharing and Disclosure">
              Your personal and operational information may be shared with:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Authorised employees and management within the Company who have a legitimate need for such information.</li>
                <li>Third-party service providers engaged by the Company who process data on its behalf, under appropriate contractual protections.</li>
                <li>Regulatory authorities, government agencies, or courts, where required by applicable law.</li>
              </ul>
              <br />
              Personal data will not be disclosed to external parties outside of the circumstances described above without your prior consent, except where required by law.
            </Section>

            <Section title="15. Employee Responsibilities During Employment">
              During your employment, you must:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
                <li>Access only those modules and data that you are authorised to use.</li>
                <li>Report immediately any breach, vulnerability, or suspected misuse of the ERP system.</li>
                <li>Follow all Company policies related to information security, data protection, and acceptable use of IT systems.</li>
                <li>Not attempt to bypass, circumvent, or interfere with any security control in the ERP system.</li>
                <li>Keep your login credentials confidential and change them regularly.</li>
                <li>Cooperate fully with any internal investigation related to ERP system usage or data security.</li>
              </ul>
            </Section>
            <AckBox
              id={ACK_KEYS.RESPONSIBILITIES}
              checked={acks[ACK_KEYS.RESPONSIBILITIES]}
              onChange={(v) => setAck(ACK_KEYS.RESPONSIBILITIES, v)}
              label="I agree to follow the Company's information security, data protection, and ERP usage policies during my employment."
            />

            <Section title="16. Unauthorised Access and Misuse">
              Unauthorised access to the ERP system or misuse of its features is strictly prohibited and may constitute a violation of applicable law, including the Information Technology Act, 2000 (India) and its amendments.
              <br /><br />
              Violation of this policy may result in immediate suspension of access, disciplinary action, and/or legal proceedings.
            </Section>

            <Section title="17. Data Breach and Security Incident Reporting">
              If you become aware of or suspect a data breach, security incident, or any unauthorised access to the ERP system, you must immediately report it to your reporting manager and the IT administrator. Do not attempt to investigate, correct, or conceal the incident independently without authorisation.
            </Section>

            <Section title="18. Employee Rights and Data-Related Queries">
              Subject to applicable law, you may have rights in relation to your personal data held by the Company, including the right to request access to, correction of, or deletion of your personal data.
              <br /><br />
              <span className="italic text-amber-700">[Note for Company Review: This section should be reviewed in accordance with the Digital Personal Data Protection Act, 2023 (India) once specific compliance guidance is available.]</span>
              <br /><br />
              To exercise any data-related right or raise a privacy concern, please contact the Company at the details provided in Section 22.
            </Section>

            <Section title="19. Policy Updates and Amendments">
              The Company reserves the right to amend or update this Agreement at any time. Where a material change is made, the Company will publish the updated Agreement with a new version number and effective date, and require employees to accept the updated Agreement before continuing to access the ERP system.
            </Section>

            <Section title="20. Limitation of Liability">
              The Company makes reasonable efforts to maintain the security and availability of the ERP system but does not warrant that the system will be error-free, uninterrupted, or entirely secure. The Company&apos;s total liability for any claim arising under this Agreement shall be limited to the extent permitted by applicable law.
            </Section>

            <Section title="21. Governing Law and Jurisdiction">
              This Agreement is governed by and construed in accordance with the laws of India. Any dispute arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts located in the State of West Bengal, India.
              <br /><br />
              <span className="italic text-amber-700">[Note for Company Review: Please confirm the preferred governing jurisdiction with legal counsel before production deployment.]</span>
            </Section>

            <Section title="22. Company Contact Information">
              For any queries, concerns, or requests relating to this Agreement or to the Company&apos;s data privacy practices, please contact:
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                <p className="font-semibold text-blue-900">Dishaan Hi-tech (India) Pvt. Ltd.</p>
                <p className="text-gray-700">Narayan Pakuria Uttarpara, Kolaghat,</p>
                <p className="text-gray-700">Purba Medinipur, West Bengal – 721151, India.</p>
                <p className="text-gray-700"><span className="font-medium">GSTIN:</span> 19AAGCD1136P1ZC</p>
                <p className="text-gray-700"><span className="font-medium">Contact Person:</span> Biswajit Dinda</p>
                <p className="text-gray-700"><span className="font-medium">Mobile:</span> 9007011223</p>
                <p className="text-gray-700"><span className="font-medium">Email:</span> dishaan.hitech@gmail.com</p>
              </div>
            </Section>

          </div>
          {/* Scroll-down hint */}
          {scrollProgress < 95 && (
            <div className="sticky bottom-0 flex justify-center py-2 bg-gradient-to-t from-white to-transparent pointer-events-none">
              <ChevronDown className="w-5 h-5 text-blue-400 animate-bounce" />
            </div>
          )}
        </div>

        {/* ── Final consent section ── */}
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className={`w-5 h-5 ${allAcked && finalConsent ? "text-green-600" : "text-gray-300"}`} />
            Final Agreement
          </h2>

          <p className="text-sm text-gray-600 leading-relaxed mb-5 italic border-l-4 border-blue-200 pl-3">
            &ldquo;I confirm that I have read and understood the Employee Terms &amp; Conditions and Data Privacy
            Agreement of Dishaan Hi-tech (India) Pvt. Ltd. I acknowledge the responsibilities described in this
            document and agree to comply with the applicable Company policies.&rdquo;
          </p>

          {!allAcked && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Please scroll up and complete all{" "}
                {Object.values(acks).filter((v) => !v).length} remaining acknowledgement
                {Object.values(acks).filter((v) => !v).length !== 1 ? "s" : ""} before proceeding.
              </p>
            </div>
          )}

          <AckBox
            id="final_consent"
            checked={finalConsent}
            onChange={allAcked ? setFinalConsent : undefined}
            label="I have read, understood, and voluntarily agree to the Employee Terms & Conditions and Data Privacy Agreement."
            disabled={!allAcked}
          />

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`
              mt-5 w-full py-3 px-6 rounded-lg text-white font-semibold text-sm
              transition-all duration-200 flex items-center justify-center gap-2
              ${canSubmit
                ? "bg-blue-800 hover:bg-blue-900 shadow-md hover:shadow-lg cursor-pointer"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }
            `}
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Recording Agreement…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {canSubmit ? "Agree & Continue" : "Complete All Acknowledgements First"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="py-5">
      <h3 className="text-sm font-bold text-blue-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-700 leading-relaxed">{children}</p>
    </div>
  );
}

function AckBox({ id, checked, onChange, label, disabled = false }) {
  return (
    <div
      className={`
        my-3 p-4 rounded-lg border transition-colors
        ${checked ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-200"}
        ${disabled ? "opacity-50" : ""}
      `}
    >
      <label
        htmlFor={id}
        className={`flex items-start gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="mt-0.5 shrink-0">
          {checked
            ? <CheckCircle2 className="w-5 h-5 text-green-600" />
            : <Circle className="w-5 h-5 text-gray-400" />
          }
        </div>
        <span className="text-sm text-gray-800 leading-relaxed">{label}</span>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled || !onChange}
          onChange={(e) => onChange?.(e.target.checked)}
          className="sr-only"
        />
      </label>
    </div>
  );
}
