"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User, Camera, Briefcase, Phone, Mail, MapPin, Calendar, Users, FolderKanban, HeartPulse, Loader2, Lightbulb,
} from "lucide-react";
import AuthImage from "@/components/common/AuthImage";
import ProfilePictureUploadModal from "@/components/common/ProfilePictureUploadModal";
import SelfTaskView from "@/components/mis/SelfTaskView";
import AgendaDetailSheet from "@/components/mis/followup/AgendaDetailSheet";
import { ListTable } from "@/components/mis/followup/FollowupBoardView";
import ScoreCard, { GradePill } from "@/components/hr/performance/ScoreCard";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { userFileUrl } from "@/lib/userFiles";
import { getCookie } from "@/lib/cookies";
import { followupApi } from "@/lib/misFollowups";
import { TASKS_CHANGED, fmtDate } from "@/lib/misTasks";
import { GuideHelpButton, GuideTour } from "@/components/mis/guide/Guide";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "My Tasks" },
  { id: "followups", label: "My Follow-ups" },
  { id: "performance", label: "My Performance" },
];

const ROLE_LABEL = { super_admin: "Super Admin", admin: "Admin", user: "User" };

// one short, practical tip for the weakest part of the score
const TIPS = {
  onTime: "Finish tasks and hand-offs by their due date — or ask to move the date before it passes.",
  quality: "Check work before marking Done or handing off; reopened tasks and sent-back steps lower this.",
  throughput: "Close small items as you finish them so completed work is counted.",
  timeEfficiency: "Give realistic estimates, press Start when you begin and Pause when you stop — over 10 % above the estimate lowers this.",
  backlog: "Clear or re-plan anything already past its due date.",
  pickup: "Press Start on follow-ups soon after they reach you.",
  appraisal: "Talk to your manager about goals for the next review.",
};

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon size={15} className="mt-0.5 text-gray-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Overview({ me }) {
  const e = me.employee;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Work">
        {e ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-4">
            <Info icon={Briefcase} label="Designation" value={e.designation} />
            <Info icon={Users} label="Department" value={e.department} />
            <Info icon={User} label="Reporting manager" value={e.reportingManager} />
            <Info icon={Calendar} label="Joined" value={fmtDate(e.dateOfJoining)} />
            <Info icon={Briefcase} label="Employment" value={[e.employmentType, e.gradeBand].filter(Boolean).join(" · ")} />
            <Info icon={MapPin} label="Location" value={[e.workLocation, e.deskSeat].filter(Boolean).join(" · ")} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No employee record is linked to your login yet. HR links it by your employee code ({me.empCode || "—"}).</p>
        )}
      </Card>
      <Card title="Contact">
        <Info icon={Mail} label="Email" value={me.email} />
        {e?.workEmail && e.workEmail !== me.email && <Info icon={Mail} label="Work email" value={e.workEmail} />}
        <Info icon={Phone} label="Mobile" value={me.mobile} />
        <Info icon={Phone} label="WhatsApp (task alerts go here)" value={me.whatsapp} />
        {e && <Info icon={HeartPulse} label="Emergency contact"
          value={e.emergencyContactName ? `${e.emergencyContactName}${e.emergencyContactRelation ? ` (${e.emergencyContactRelation})` : ""} · ${e.emergencyContactMobile || ""}` : null} />}
        {e?.bloodGroup && <Info icon={HeartPulse} label="Blood group" value={e.bloodGroup} />}
        <p className="mt-2 text-[11px] text-gray-500">To change these details, contact HR.</p>
      </Card>
      <Card title="My projects">
        {me.projects?.length ? (
          <ul className="space-y-1.5">
            {me.projects.map((p) => (
              <li key={`${p.projectCode}-${p.designation}`} className="flex items-start gap-2">
                <FolderKanban size={15} className="mt-0.5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-800">{p.projectCode} <span className="text-gray-500">· {p.projectName}</span></p>
                  {p.designation && <p className="text-[11px] text-gray-500">{p.designation}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">Not added to any project.</p>}
        {e?.primarySkills && (
          <div className="mt-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Skills</p>
            <div className="flex flex-wrap gap-1">
              {e.primarySkills.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{s}</span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function MyFollowups() {
  const [mine, setMine] = useState([]);
  const [involved, setInvolved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const myIdCookie = Number(getCookie("userId")) || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, inv] = await Promise.all([
        followupApi.list({ scope: "mine", perPage: 300 }),
        followupApi.list({ scope: "involved", perPage: 100 }),
      ]);
      const mineRows = m?.data?.items || [];
      const ids = new Set(mineRows.map((x) => x.id));
      setMine(mineRows);
      setInvolved((inv?.data?.items || []).filter((x) => !ids.has(x.id)));
    } catch {
      setMine([]); setInvolved([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener(TASKS_CHANGED, load);
    return () => window.removeEventListener(TASKS_CHANGED, load);
  }, [load]);

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">With me now <span className="text-gray-400 font-normal">({mine.length})</span></h3>
        <ListTable rows={mine} loading={loading} onOpen={(f) => setOpenId(f.id)} myId={myIdCookie} showProject empty="Nothing is waiting on you. 🎉" />
      </section>
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">I supervise or worked on <span className="text-gray-400 font-normal">({involved.length})</span></h3>
        <ListTable rows={involved} loading={loading} onOpen={(f) => setOpenId(f.id)} myId={myIdCookie} showProject empty="No other follow-ups." />
      </section>
      <AgendaDetailSheet open={!!openId} agendaId={openId} onClose={() => setOpenId(null)} onChanged={load}
        onEdit={() => { window.location.href = "/task-management/task-tracker"; }} />
    </div>
  );
}

function MyPerformance() {
  const [period, setPeriod] = useState("month");
  const [state, setState] = useState({ period: null, row: null });

  useEffect(() => {
    let alive = true;
    apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.SCORE_ME, params: { period } })
      .then((r) => alive && setState({ period, row: r?.data || null }))
      .catch(() => alive && setState({ period, row: null }));
    return () => { alive = false; };
  }, [period]);

  const loading = state.period !== period;
  const row = state.row;
  const weakest = useMemo(() => {
    if (!row?.components) return null;
    const scored = Object.entries(row.components).filter(([, p]) => p.score != null && p.score < 80);
    if (!scored.length) return null;
    scored.sort((a, b) => a[1].score * a[1].weight - b[1].score * b[1].weight || a[1].score - b[1].score);
    return scored[0];
  }, [row]);

  return (
    <div className="space-y-4">
      <GuideTour screen="performance" />
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-gray-300 overflow-hidden w-fit" role="radiogroup" aria-label="Period">
          {[["month", "This month"], ["week", "This week"]].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={period === v} onClick={() => setPeriod(v)}
              className={`px-3 py-2 text-sm ${period === v ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
        <GuideHelpButton screen="performance" />
      </div>
      {loading && !row ? (
        <div className="py-16 flex justify-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Working it out…</div>
      ) : !row ? (
        <p className="text-sm text-gray-500">Score not available.</p>
      ) : (
        <div className={`grid grid-cols-1 xl:grid-cols-3 gap-4 ${loading ? "opacity-60" : ""}`}>
          <div className="xl:col-span-2"><ScoreCard row={row} title="My performance score" /></div>
          <div className="space-y-4">
            {weakest && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-900 inline-flex items-center gap-1.5"><Lightbulb size={15} /> Biggest gain: {weakest[1].label}</p>
                <p className="text-sm text-amber-900 mt-1">{TIPS[weakest[0]]}</p>
                <p className="text-[11px] text-amber-800 mt-1">Now {weakest[1].score} — {weakest[1].detail}</p>
              </div>
            )}
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700 space-y-1.5">
              <p className="font-semibold text-gray-800">What counts</p>
              <p>Your own <b>Self Tasks</b> and the <b>Follow-up</b> steps handed to you, your latest <b>HR review</b>, and any open <b>discipline case</b>.</p>
              <p className="text-[11px] text-gray-500">Work that is not due yet is never counted as late. Only you, HR and super admin can see this score.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** /my-profile — the logged-in user's own page. Shows only the user's own data. */
export default function MyProfileView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = TABS.some((t) => t.id === searchParams?.get("tab")) ? searchParams.get("tab") : "overview";
  const [tab, setTab] = useState(initialTab);
  const [me, setMe] = useState(null);
  const [score, setScore] = useState(null);
  const [error, setError] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);

  const loadMe = useCallback(() => {
    apiRequest({ url: API_ENDPOINTS.HR.EMPLOYEE.ME })
      .then((r) => setMe(r?.data || null))
      .catch((e) => setError(e?.message || "Could not load your profile"));
  }, []);
  useEffect(() => {
    loadMe();
    apiRequest({ url: API_ENDPOINTS.HR.PERFORMANCE.SCORE_ME, params: { period: "month" } })
      .then((r) => setScore(r?.data || null)).catch(() => {});
    window.addEventListener("erp:profile-updated", loadMe);
    return () => window.removeEventListener("erp:profile-updated", loadMe);
  }, [loadMe]);

  const changeTab = (id) => {
    setTab(id);
    router.replace(id === "overview" ? "/my-profile" : `/my-profile?tab=${id}`, { scroll: false });
  };

  if (error) return <p className="py-16 text-center text-sm text-red-600">{error}</p>;
  if (!me) return <div className="py-16 flex justify-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  const e = me.employee;
  return (
    <div className="space-y-4">
      {/* header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#d6e6f2] border border-[#8f8f8f] overflow-hidden flex items-center justify-center">
            <AuthImage src={userFileUrl(me.userId, "profile", me.profilePicture)} alt={me.name}
              className="h-full w-full object-cover" fallback={<User size={34} className="text-gray-600" />} />
          </div>
          <button onClick={() => setPhotoOpen(true)} title="Change photo" aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-white hover:bg-blue-700">
            <Camera size={14} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">{me.name}</h2>
          <p className="text-sm text-gray-600">{[e?.designation, e?.department].filter(Boolean).join(" · ") || ROLE_LABEL[me.role] || me.role}</p>
          <p className="text-xs text-gray-500 mt-0.5">{me.empCode ? `Emp code ${me.empCode} · ` : ""}{me.loginUsername}</p>
        </div>
        {score && (
          <button onClick={() => changeTab("performance")} className="text-right rounded-lg border border-gray-200 px-4 py-2 hover:border-blue-300 transition">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">This month</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{score.score == null ? "—" : Number(score.score).toFixed(0)}<span className="text-sm text-gray-400">/100</span></p>
            <GradePill grade={score.grade} />
          </button>
        )}
      </div>

      {/* tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => changeTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview me={me} />}
      {tab === "tasks" && <SelfTaskView lockScope="mine" />}
      {tab === "followups" && <MyFollowups />}
      {tab === "performance" && <MyPerformance />}

      <ProfilePictureUploadModal open={photoOpen} onOpenChange={setPhotoOpen} />
    </div>
  );
}
