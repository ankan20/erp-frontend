"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { createdOnText } from "@/lib/createdOn";
import MemberFormModal from "@/components/gang-tracker/MemberFormModal";
import ProjectPicker, { refreshGangProjects } from "@/components/gang-tracker/ProjectPicker";
import ConversationsPanel, { StepForm, emptyStep, stepPayload } from "@/components/gang-tracker/ConversationsPanel";

// ─── helpers ────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function getInitials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}
const AVATAR_BG = ["bg-blue-700","bg-indigo-600","bg-violet-600","bg-emerald-600","bg-orange-500","bg-teal-600"];
function avatarBg(name = "") { return AVATAR_BG[(name.charCodeAt(0) || 0) % AVATAR_BG.length]; }

// ─── status styles ───────────────────────────────────────────────────────────
const STATUS_STYLE = {
  Available:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  Deployed:    "bg-blue-100   text-blue-700   border-blue-200",
  "Follow-up": "bg-amber-100  text-amber-700  border-amber-200",
  Pending:     "bg-orange-100 text-orange-700 border-orange-200",
  Unavailable: "bg-red-100    text-red-700    border-red-200",
};
const STATUS_DOT = {
  Available:   "bg-emerald-500",
  Deployed:    "bg-blue-500",
  "Follow-up": "bg-amber-500",
  Pending:     "bg-orange-500",
  Unavailable: "bg-red-400",
};

const STATIC_SKILLS = ["Electrician","Plumber","Welder","Mason","Carpenter","Painter","Helper","Supervisor","Driver","Fitter","Scaffolder","Other"];
const EMPTY_FORM = { name:"", skill:"Electrician", mobile:"", whatsapp:"", location:"", status:"Available", site:"", followup:"", notes:"" };

// ─── sub-components ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status] || "bg-gray-400"}`} />
      {status}
    </span>
  );
}

function FollowupChip({ date }) {
  const t = todayStr();
  if (!date) return <span className="text-gray-300 text-xs">—</span>;
  if (date < t)   return <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">🔴 {date}</span>;
  if (date === t) return <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">⚠️ Today</span>;
  return <span className="text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-200">{date}</span>;
}

function Modal({ open, onClose, title, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-xl border border-gray-200 shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} my-8 flex flex-col transition-[max-width]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-base">✕</button>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

// compact one-line KPI tile (label left, number right; description on hover)
function Kpi({ label, value, color, bg, sub }) {
  return (
    <div className={`${bg} rounded-lg border px-3 py-1.5 flex items-center justify-between gap-2`} title={sub}>
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide truncate">{label}</p>
      <p className={`text-lg leading-6 font-bold ${color}`}>{value}</p>
    </div>
  );
}

const TALK_STYLE = {
  Scheduled: "bg-amber-50 text-amber-700 border-amber-200",
  Ongoing:   "bg-blue-50 text-blue-700 border-blue-200",
  Waiting:   "bg-violet-50 text-violet-700 border-violet-200",
};
// open-conversation summary for a member row
function TalkCell({ talks, onClick }) {
  if (!talks?.open) return <span className="text-gray-300 text-xs">—</span>;
  const t = todayStr();
  const d = talks.nextFollowup;
  return (
    <button onClick={onClick} className="text-left max-w-[220px] group/talk" title="Open this person's conversations">
      <span className="flex items-center gap-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TALK_STYLE[talks.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{talks.status}</span>
        {talks.open > 1 && <span className="text-[10px] text-gray-400">+{talks.open - 1} more</span>}
        {d && <span className={`text-[10px] ${d < t ? "text-red-600 font-semibold" : d === t ? "text-amber-700 font-semibold" : "text-gray-400"}`}>
          {d < t ? "overdue" : d === t ? "today" : d}{talks.nextWithMe ? "" : " (other)"}
        </span>}
      </span>
      <span className="block text-xs text-gray-600 truncate group-hover/talk:text-blue-700 mt-0.5">{talks.topic}</span>
    </button>
  );
}

function FormRow({ children }) { return <div className="grid grid-cols-2 gap-3">{children}</div>; }
function Field({ label, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full";
const selectCls = `${inputCls} cursor-pointer`;

// ─── page ─────────────────────────────────────────────────────────────────────
export default function GangTrackerPage() {
  const router = useRouter();
  const [members, setMembers]     = useState([]);
  const [skills, setSkills]       = useState(STATIC_SKILLS);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSkill, setFilterSkill]   = useState("");
  const [sortKey, setSortKey]           = useState("name");
  const [sortAsc, setSortAsc]           = useState(true);

  const [memberModal, setMemberModal] = useState(false);
  const [editId, setEditId]           = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);

  const [detailModal, setDetailModal] = useState(false);
  const [detailId, setDetailId]       = useState(null);
  const [confirm, setConfirm]         = useState(null);
  const [followupNote, setFollowupNote]     = useState("");
  const [followupStatus, setFollowupStatus] = useState("");
  const [followupDate, setFollowupDate]     = useState("");

  // conversations tab
  const [tab, setTab]                 = useState("members");
  const [people, setPeople]           = useState([]);
  const [memberFilter, setMemberFilter] = useState(null);
  const [convCounts, setConvCounts]   = useState({ open: 0, today: 0, overdue: 0 });
  const [convReload, setConvReload]   = useState(0);
  // "start a conversation" section inside Add Member
  const [withConv, setWithConv]       = useState(false);
  const [convHead, setConvHead]       = useState({ topic: "", project: "" });
  const [convStep, setConvStep]       = useState(emptyStep());

  const fetchPeople = useCallback(async () => {
    try {
      const r = await apiRequest({ url: API_ENDPOINTS.HR.GANG_TRACKER.PEOPLE });
      setPeople(r?.data || []);
    } catch { /* picker just shows no suggestions */ }
  }, []);
  useEffect(() => { fetchPeople(); }, [fetchPeople]);

  function showConversationsOf(m) {
    setMemberFilter({ id: m.id, name: m.name });
    setTab("conv");
  }

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (search)       params.search = search;
    if (filterStatus) params.status = filterStatus;
    if (filterSkill)  params.skill  = filterSkill;
    try {
      const res = await apiRequest({ url: API_ENDPOINTS.HR.GANG_TRACKER.LIST, method: "GET", params });
      if (res?.data) setMembers(res.data);
    } catch { /* 403 etc. — apiClient already shows the toast */ }
    setLoading(false);
  }, [search, filterStatus, filterSkill]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.HR.GANG_TRACKER.SKILLS, method: "GET" })
      .then((r) => r?.data?.length && setSkills(r.data)).catch(() => {});
  }, []);

  // ── derived ────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      const va = sortKey === "followup" ? (a.followup || "zzz") : (a[sortKey] ?? "");
      const vb = sortKey === "followup" ? (b.followup || "zzz") : (b[sortKey] ?? "");
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [members, sortKey, sortAsc]);

  const today  = todayStr();
  const counts  = useMemo(() => members.reduce((a, m) => { a[m.status] = (a[m.status]||0)+1; return a; }, {}), [members]);
  const overdue = useMemo(() => members.filter((m) => m.followup && m.followup < today && m.status !== "Unavailable").length, [members, today]);

  function toggleSort(key) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  // ── add/edit ───────────────────────────────────────────────────────────────
  function openAdd() {
    setEditId(null); setForm(EMPTY_FORM);
    setWithConv(false); setConvHead({ topic: "", project: "" }); setConvStep(emptyStep());
    setMemberModal(true);
  }
  function openEdit(m) {
    setEditId(m.id);
    setForm({ name: m.name, skill: m.skill||"Electrician", mobile: m.mobile, whatsapp: m.whatsapp||"",
      location: m.location||"", status: m.status, site: m.site||"", followup: m.followup||"", notes: m.notes||"" });
    setMemberModal(true);
  }

  async function saveMember() {
    if (!form.name.trim()) return toast.error("Name is required.");
    const startConv = !editId && withConv;
    if (startConv && !convHead.topic.trim()) return toast.error("Enter the conversation topic / agenda.");
    setSaving(true);
    try {
      if (editId) {
        await apiRequest({ url: API_ENDPOINTS.HR.GANG_TRACKER.UPDATE + editId, method: "PUT", data: form });
      } else {
        // member + first talk are saved together (the backend links the talk to the new member)
        const { person: _unused, ...step } = stepPayload(convStep);
        const data = startConv ? { ...form, conversation: { ...convHead, ...step } } : form;
        const r = await apiRequest({ url: API_ENDPOINTS.HR.GANG_TRACKER.CREATE, method: "POST", data });
        toast.success(r?.message || "Member created");
        if (startConv) { setConvReload((n) => n + 1); refreshGangProjects(); }
      }
      setMemberModal(false);
      fetchMembers();
      fetchPeople();
    } catch (e) {
      toast.error(e.message);
    }
    setSaving(false);
  }

  function deleteMember(id, name) {
    setConfirm({
      title: `Delete ${name}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
      onConfirm: async () => {
        await apiRequest({ url: API_ENDPOINTS.HR.GANG_TRACKER.DELETE + id, method: "DELETE" });
        fetchMembers();
        fetchPeople();
      },
    });
  }

  // ── detail / follow-up ─────────────────────────────────────────────────────
  function openDetail(id) {
    setDetailId(id); setFollowupNote(""); setFollowupStatus(""); setFollowupDate("");
    setDetailModal(true);
  }

  // profile from a conversation avatar — fetch it if the member list is filtered and doesn't have it
  const [extraMember, setExtraMember] = useState(null);
  async function openProfile(id) {
    if (!members.some((m) => m.id === id)) {
      try {
        const r = await apiRequest({ url: API_ENDPOINTS.HR.GANG_TRACKER.GET + id });
        setExtraMember(r?.data || null);
      } catch { return; }
    }
    openDetail(id);
  }

  async function saveFollowup() {
    if (!followupNote && !followupStatus && !followupDate) return toast.error("Enter a note, status, or date.");
    setSaving(true);
    await apiRequest({
      url: API_ENDPOINTS.HR.GANG_TRACKER.FOLLOWUP + detailId + "/followup",
      method: "POST",
      data: { note: followupNote, status: followupStatus, followup: followupDate },
    });
    setSaving(false);
    setDetailModal(false);
    fetchMembers();
  }

  // ── export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const cols = ["Name","Skill","Mobile","WhatsApp","Location","Status","Site","Follow-up","Notes"];
    const rows = members.map((m) =>
      [m.name,m.skill,m.mobile,m.whatsapp,m.location,m.status,m.site,m.followup,m.notes]
        .map((v) => `"${(v||"").replace(/"/g,'""')}"`).join(",")
    );
    const url = URL.createObjectURL(new Blob([[cols.join(","),...rows].join("\n")], {type:"text/csv"}));
    Object.assign(document.createElement("a"), {href:url, download:"gang_contacts.csv"}).click();
    URL.revokeObjectURL(url);
  }

  const detailMember = members.find((m) => m.id === detailId) || (extraMember?.id === detailId ? extraMember : undefined);
  const actions = getPageActions({ router });

  const SortTh = ({ label, col }) => (
    <th onClick={() => toggleSort(col)}
      className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700 transition-colors">
      {label} {sortKey === col ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <HeaderWrapper>
      <PageHeader actions={actions} />

      <div className="p-4 space-y-3">

        {/* tabs */}
        <div className="inline-flex bg-white rounded-xl border border-gray-200 p-1 gap-1">
          {[["members", "👷 Members", members.length], ["conv", "💬 Conversations", convCounts.open]].map(([k, l, n]) => (
            <button key={k} onClick={() => { setTab(k); if (k === "members") fetchMembers(); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${tab === k ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              {l}<span className={`text-[10px] px-1.5 rounded-full ${tab === k ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{n}</span>
            </button>
          ))}
        </div>

        <div className={tab === "conv" ? "space-y-3" : "hidden"}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Open conversations", value: convCounts.open,    color: "text-blue-700",  bg: "bg-blue-50 border-blue-100",   sub: "Not finished yet" },
                { label: "Follow-up today",    value: convCounts.today,   color: "text-amber-600", bg: "bg-amber-50 border-amber-100", sub: "Call / meet today" },
                { label: "Overdue",            value: convCounts.overdue, color: "text-red-600",   bg: "bg-red-50 border-red-100",     sub: "Follow-up date passed" },
                { label: "People in register", value: people.length,      color: "text-gray-700",  bg: "bg-gray-50 border-gray-200",   sub: "Auto-added from talks" },
              ].map((k) => <Kpi key={k.label} {...k} />)}
            </div>
            <ConversationsPanel people={people} refreshPeople={() => { fetchPeople(); fetchMembers(); }}
              memberFilter={memberFilter} clearMemberFilter={() => setMemberFilter(null)} onCountsChange={setConvCounts} reloadKey={convReload} onOpenPerson={openProfile} />
        </div>

        {tab === "members" && (<>
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label:"Total Members",  value:members.length,           color:"text-blue-700",    bg:"bg-blue-50 border-blue-100",    sub:"In database" },
            { label:"Available",      value:counts["Available"]||0,   color:"text-emerald-600", bg:"bg-emerald-50 border-emerald-100", sub:"Ready to deploy" },
            { label:"Deployed",       value:counts["Deployed"]||0,    color:"text-blue-600",    bg:"bg-blue-50 border-blue-100",    sub:"On site" },
            { label:"Follow-up",      value:counts["Follow-up"]||0,   color:"text-amber-600",   bg:"bg-amber-50 border-amber-100",  sub:"Needs contact" },
            { label:"Overdue",        value:overdue,                  color:"text-red-600",     bg:"bg-red-50 border-red-100",      sub:"Past follow-up" },
            { label:"Unavailable",    value:counts["Unavailable"]||0, color:"text-gray-500",    bg:"bg-gray-50 border-gray-200",    sub:"Not reachable" },
          ].map((k) => <Kpi key={k.label} {...k} />)}
        </div>

        {/* Controls bar */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Search name, skill, location…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            <option value="">All Status</option>
            {["Available","Deployed","Follow-up","Pending","Unavailable"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            <option value="">All Skills</option>
            {skills.map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="ml-auto flex gap-2">
            <button onClick={exportCSV}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              ⬇ Export CSV
            </button>
            <button onClick={openAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors">
              + Add Member
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">👷 Gang Member Register</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{sorted.length}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
              <Loader2 className="animate-spin w-5 h-5"/> Loading…
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <p className="text-4xl">👥</p>
              <p className="text-sm font-medium">No gang members found</p>
              <p className="text-xs text-gray-300">Try adjusting your filters or add a new member</p>
            </div>
          ) : (
            <>
            <div className="overflow-auto max-h-[calc(100vh-390px)] min-h-[220px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_#f3f4f6]">
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    <SortTh label="Member"    col="name"/>
                    <SortTh label="Skill"     col="skill"/>
                    <SortTh label="Status"    col="status"/>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                    <SortTh label="Follow-up" col="followup"/>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Talk Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Last Note</th>
                    <SortTh label="Created On" col="createdTs"/>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((m) => {
                    const lastLog = m.last_log;
                    return (
                      <tr key={m.id} className="hover:bg-blue-50/60 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${avatarBg(m.name)} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                              {getInitials(m.name)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-xs group-hover:text-blue-700 transition-colors">{m.name}</p>
                              <p className="text-[11px] text-gray-400">{m.location || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{m.skill || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={m.status}/>
                          {m.site && <p className="text-[10px] text-gray-400 mt-1">📍 {m.site}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {m.mobile
                            ? <a href={`tel:${m.mobile}`} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">📞 {m.mobile}</a>
                            : <span className="text-xs text-gray-300">No number</span>}
                          {(m.whatsapp || m.mobile) && (
                            <a href={`https://wa.me/${(m.whatsapp||m.mobile).replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                              className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1">💬 WhatsApp</a>
                          )}
                        </td>
                        <td className="px-4 py-3"><FollowupChip date={m.followup}/></td>
                        <td className="px-4 py-3"><TalkCell talks={m.talks} onClick={() => showConversationsOf(m)}/></td>
                        <td className="px-4 py-3 max-w-[180px]">
                          {lastLog ? (
                            <>
                              <p className="text-[10px] text-gray-400">{lastLog.date}</p>
                              <p className="text-xs text-gray-600 truncate max-w-[160px]" title={lastLog.note}>{lastLog.note}</p>
                            </>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{createdOnText(m)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => showConversationsOf(m)} className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-lg flex items-center justify-center shadow-sm transition-colors hover:bg-violet-100 hover:border-violet-200" title="Conversations with this person">💬</button>
                            <button onClick={() => openDetail(m.id)} className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-lg flex items-center justify-center shadow-sm transition-colors hover:bg-blue-100 hover:border-blue-200" title="View & follow-up">📋</button>
                            <button onClick={() => openEdit(m)} className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-lg flex items-center justify-center shadow-sm transition-colors hover:bg-amber-100 hover:border-amber-200" title="Edit">✏️</button>
                            <button onClick={() => deleteMember(m.id, m.name)} className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-lg flex items-center justify-center shadow-sm transition-colors hover:bg-red-100 hover:border-red-200" title="Delete">🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
              Showing {sorted.length} member{sorted.length !== 1 ? "s" : ""}
              {(search || filterStatus || filterSkill) && " (filtered)"}
            </div>
            </>
          )}
        </div>
        </>)}
      </div>

      {/* Add / Edit modal */}
      <MemberFormModal open={memberModal} onClose={() => setMemberModal(false)} isEdit={!!editId}
        form={form} setForm={setForm} saving={saving} onSave={saveMember} skills={STATIC_SKILLS}
        wide={!editId && withConv} saveLabel={editId ? "Save changes" : withConv ? "Save & start conversation" : "Save member"}>
        {!editId && (
          <div className={`rounded-lg border transition-colors ${withConv ? "border-zinc-300 bg-zinc-50/70" : "border-zinc-200 bg-white hover:bg-zinc-50/60"}`}>
            <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none">
              <span className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${withConv ? "bg-zinc-900" : "bg-gray-300"}`}>
                <input type="checkbox" checked={withConv} onChange={(e) => setWithConv(e.target.checked)} className="sr-only"/>
                <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${withConv ? "translate-x-3.5" : ""}`}/>
              </span>
              <span>
                <span className="block text-[13px] font-medium text-zinc-900">Also start a conversation with {form.name.trim() || "this person"}</span>
                <span className="block text-[11px] text-zinc-500">Topic, what was discussed and the next follow-up</span>
              </span>
            </label>
            {withConv && (
              <div className="px-3 pb-3 space-y-3 border-t border-zinc-200 pt-3">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Topic / Agenda *" className="col-span-2">
                    <input autoFocus value={convHead.topic} onChange={(e) => setConvHead((h) => ({ ...h, topic: e.target.value }))}
                      placeholder="e.g. Need 10 masons for Block C" maxLength={300} className={inputCls}/>
                  </Field>
                  <Field label="Project">
                    <ProjectPicker value={convHead.project} onChange={(v) => setConvHead((h) => ({ ...h, project: v }))} buttonClassName="h-[34px] rounded-lg border-gray-300 px-3 text-xs"/>
                  </Field>
                </div>
                <StepForm step={convStep} setStep={setConvStep} people={people} hidePerson defaultPersonName={form.name.trim()}/>
              </div>
            )}
          </div>
        )}
      </MemberFormModal>

      {/* Detail / Follow-up modal */}
      {detailMember && (
        <Modal open={detailModal} onClose={() => setDetailModal(false)}
          title={`${detailMember.name} — ${detailMember.skill || ""}`}
          footer={
            <>
              <button onClick={() => setDetailModal(false)} className="border border-gray-300 rounded-lg px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Close</button>
              <button onClick={saveFollowup} disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg px-4 py-1.5 text-xs font-semibold flex items-center gap-1">
                {saving && <Loader2 className="animate-spin w-3 h-3"/>} 📝 Save Follow-up
              </button>
            </>
          }
        >
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div className={`w-12 h-12 rounded-full ${avatarBg(detailMember.name)} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
              {getInitials(detailMember.name)}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{detailMember.name}</p>
              <p className="text-xs text-gray-400">{detailMember.skill} · {detailMember.location || "No location"}</p>
              <div className="mt-1"><StatusBadge status={detailMember.status}/></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">📞 Mobile</p>
              {detailMember.mobile
                ? <a href={`tel:${detailMember.mobile}`} className="text-xs text-blue-600 hover:underline">{detailMember.mobile}</a>
                : <span className="text-gray-300 text-xs">—</span>}
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">💬 WhatsApp</p>
              {detailMember.whatsapp
                ? <a href={`https://wa.me/${detailMember.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline">{detailMember.whatsapp}</a>
                : <span className="text-gray-300 text-xs">—</span>}
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">🏗 Current Site</p>
              <p className="text-xs text-gray-700">{detailMember.site || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">📅 Next Follow-up</p>
              <p className="text-xs text-gray-700">{detailMember.followup || "—"}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">📝 Contact History</p>
            {!(detailMember.log?.length)
              ? <p className="text-xs text-gray-300">No follow-up history</p>
              : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {[...(detailMember.log||[])].reverse().map((l, i) => (
                    <div key={i} className="border-l-2 border-blue-400 pl-3 py-1 bg-blue-50/50 rounded-r-lg">
                      <p className="text-[10px] text-blue-600 font-semibold">{l.date}</p>
                      <p className="text-xs text-gray-700 mt-0.5">{l.note}</p>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-3">
            <Field label="Add Follow-up Note">
              <textarea value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} placeholder="Enter your follow-up note…" rows={2} className={inputCls} style={{resize:"vertical"}}/>
            </Field>
            <FormRow>
              <Field label="Update Status">
                <select value={followupStatus} onChange={(e) => setFollowupStatus(e.target.value)} className={selectCls}>
                  <option value="">— Keep Current —</option>
                  {["Available","Deployed","Follow-up","Pending","Unavailable"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Next Follow-up Date">
                <input value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} type="date" className={inputCls}/>
              </Field>
            </FormRow>
          </div>
        </Modal>
      )}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </HeaderWrapper>
  );
}
