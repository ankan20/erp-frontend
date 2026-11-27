"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import PersonPicker, { personPayload } from "./PersonPicker";
import ThreadTimeline from "./ThreadTimeline";
import {
  addDays, fmtDate, initials, inputCls, isClosed, personColor, todayStr,
  THREAD_STATUSES, THREAD_STATUS_STYLE,
} from "./shared";

const GT = API_ENDPOINTS.HR.GANG_TRACKER;

export const emptyStep = (person = null) => ({
  date: todayStr(), person, note: "", referredTo: null, nextFollowup: "", nextPerson: null, nextAction: "", status: "",
});

export function stepPayload(s) {
  return {
    date: s.date, note: s.note, nextFollowup: s.nextFollowup, nextAction: s.nextAction, status: s.status,
    person: personPayload(s.person), referredTo: personPayload(s.referredTo), nextPerson: personPayload(s.nextPerson),
  };
}

// what status the backend will pick when "Auto" is left on
function autoStatus(s) {
  return s.nextFollowup ? "Scheduled" : s.referredTo ? "Waiting" : "Ongoing";
}

function ThreadStatus({ status }) {
  const st = THREAD_STATUS_STYLE[status] || THREAD_STATUS_STYLE.Ongoing;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${st.cls}`} title={st.hint}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{status}
    </span>
  );
}

function NextChip({ thread }) {
  if (isClosed(thread.status)) return <span className="text-gray-300 text-xs">—</span>;
  const d = thread.nextFollowup, t = todayStr();
  const cls = !d ? "bg-gray-50 text-gray-500 border-gray-200"
    : d < t ? "bg-red-50 text-red-600 border-red-100"
    : d === t ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <div className="space-y-0.5">
      <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${cls}`}>
        {!d ? "No date" : d < t ? `🔴 ${fmtDate(d)}` : d === t ? "⚠️ Today" : fmtDate(d)}
      </span>
      {thread.nextMember && <p className="text-[11px] text-gray-500 truncate max-w-[160px]">with <b className="text-gray-700">{thread.nextMember.name}</b></p>}
      {thread.nextAction && <p className="text-[10px] text-gray-400 truncate max-w-[160px]" title={thread.nextAction}>{thread.nextAction}</p>}
    </div>
  );
}

// instant name bubble on hover (shown below so the sticky table header can't cover it)
function HoverName({ label, sub, children }) {
  return (
    <span className="relative inline-flex group/name">
      {children}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg opacity-0 translate-y-0.5 group-hover/name:opacity-100 group-hover/name:translate-y-0 transition-all duration-100">
        <span className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-gray-900" />
        {label}
        {sub && <span className="text-gray-400 font-normal"> · {sub}</span>}
      </span>
    </span>
  );
}

// A → B → A, from the order people were talked to
function PeopleChain({ thread, onOpenPerson }) {
  const ids = [];
  (thread.entries || []).forEach((e) => e.member && ids[ids.length - 1] !== e.member.id && ids.push(e.member.id));
  const byId = Object.fromEntries(thread.people.map((p) => [p.id, p]));
  const chain = ids.length ? ids.map((id) => byId[id]).filter(Boolean) : thread.people;
  const shown = chain.slice(-4);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {chain.length > shown.length && (
        <HoverName label={chain.slice(0, chain.length - shown.length).map((p) => p.name).join(" → ")}>
          <span className="text-[10px] text-gray-400 px-0.5">…</span>
        </HoverName>
      )}
      {shown.map((p, i) => (
        <span key={`${p.id}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-gray-300 text-[10px]">→</span>}
          <HoverName label={p.name} sub={onOpenPerson ? "click for profile" : p.skill || p.mobile}>
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenPerson?.(p.id); }}
              className="w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white transition-transform group-hover/name:scale-110 cursor-pointer"
              style={{ background: personColor(p.id) }}>{initials(p.name)}</button>
          </HoverName>
        </span>
      ))}
    </div>
  );
}

function Field({ label, hint, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
        {label}{hint && <span className="normal-case font-normal text-gray-400 tracking-normal"> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** The "what happened in this talk / what next" form — used to start a conversation and to log each next talk. */
export function StepForm({ step, setStep, people, personLabel = "Talked to *", hidePerson = false, defaultPersonName = "" }) {
  const set = (k) => (v) => setStep((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {!hidePerson && <Field label={personLabel} className="col-span-2">
          <PersonPicker people={people} value={step.person} onChange={set("person")} placeholder="Name — new names are added automatically" />
        </Field>}
        <Field label="Date">
          <input type="date" value={step.date} max={todayStr()} onChange={set("date")} className={inputCls} />
        </Field>
      </div>
      <Field label="What was discussed">
        <textarea rows={3} value={step.note} onChange={set("note")} className={inputCls} style={{ resize: "vertical" }}
          placeholder="e.g. Discussed XYZ. He is busy this week, asked me to speak with his supervisor." />
      </Field>
      <Field label="Referred to" hint="if they asked you to connect with someone else">
        <PersonPicker people={people} value={step.referredTo} onChange={set("referredTo")} placeholder="Optional — e.g. Person B" />
      </Field>

      <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Next follow-up</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="When">
            <input type="date" value={step.nextFollowup} min={todayStr()} onChange={set("nextFollowup")} className={inputCls} />
            <div className="flex gap-1 flex-wrap">
              {[["Tomorrow", 1], ["+3 days", 3], ["+1 week", 7], ["+2 weeks", 14]].map(([l, n]) => (
                <button key={n} type="button" onClick={() => set("nextFollowup")(addDays(n))}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${step.nextFollowup === addDays(n) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-white"}`}>{l}</button>
              ))}
              {step.nextFollowup && <button type="button" onClick={() => set("nextFollowup")("")} className="text-[10px] px-2 py-0.5 text-gray-400 hover:text-gray-600">clear</button>}
            </div>
          </Field>
          <Field label="With whom" hint="blank = same person">
            <PersonPicker people={people} value={step.nextPerson} onChange={set("nextPerson")}
              placeholder={step.person?.name || defaultPersonName || "Same person"} />
          </Field>
        </div>
        <Field label="Next action">
          <input value={step.nextAction} onChange={set("nextAction")} className={inputCls} maxLength={300}
            placeholder="e.g. Call back to confirm rate after talking to B" />
        </Field>
      </div>

      <Field label="Status after this talk">
        <div className="flex gap-1.5 flex-wrap">
          {["", ...THREAD_STATUSES].map((s) => {
            const active = step.status === s;
            return (
              <button key={s || "auto"} type="button" onClick={() => set("status")(s)}
                className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  active ? (s ? THREAD_STATUS_STYLE[s].cls + " ring-2 ring-offset-1 ring-blue-400" : "bg-blue-600 text-white border-blue-600")
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {s || `Auto (${autoStatus(step)})`}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function Shell({ open, onClose, title, subtitle, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-gray-50 h-full w-full ${wide ? "max-w-3xl" : "max-w-xl"} shadow-2xl flex flex-col animate-in slide-in-from-right duration-200`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 bg-white">
          <div className="min-w-0">{title}{subtitle}</div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex-shrink-0">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">{footer}</div>}
      </div>
    </div>
  );
}

const btnGhost = "border border-gray-300 rounded-lg px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 bg-white";
const btnPrimary = "bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg px-4 py-1.5 text-xs font-semibold flex items-center gap-1";

export default function ConversationsPanel({ people, refreshPeople, memberFilter, clearMemberFilter, onCountsChange, reloadKey = 0, onOpenPerson }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [project, setProject] = useState("");
  const [projects, setProjects] = useState([]);
  const [confirm, setConfirm] = useState(null);

  // new conversation
  const [newOpen, setNewOpen] = useState(false);
  const [newHead, setNewHead] = useState({ topic: "", project: "" });
  const [newStep, setNewStep] = useState(emptyStep());

  // detail
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [step, setStep] = useState(emptyStep());
  const [showStep, setShowStep] = useState(false);
  const [editHead, setEditHead] = useState(null);

  const memberId = memberFilter?.id;
  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    if (project) params.project = project;
    if (memberId) params.memberId = memberId;
    try {
      const r = await apiRequest({ url: GT.THREADS, params });
      setThreads(r?.data || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, [search, status, project, memberId]);

  useEffect(() => { const t = setTimeout(fetchThreads, search ? 300 : 0); return () => clearTimeout(t); }, [fetchThreads, search, reloadKey]);

  const loadProjects = useCallback(async () => {
    const [used, master] = await Promise.all([
      apiRequest({ url: GT.THREAD_PROJECTS }).catch(() => null),
      apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS }).catch(() => null),
    ]);
    const names = new Set(used?.data || []);
    (master?.data || []).forEach((p) => p.projectName && names.add(p.projectName));
    setProjects([...names].sort((a, b) => a.localeCompare(b)));
  }, []);
  useEffect(() => { loadProjects(); }, [loadProjects]);

  // KPI counts for the page header (from the open list when unfiltered)
  const t = todayStr();
  const counts = useMemo(() => ({
    open: threads.filter((x) => !isClosed(x.status)).length,
    today: threads.filter((x) => !isClosed(x.status) && x.nextFollowup === t).length,
    overdue: threads.filter((x) => !isClosed(x.status) && x.nextFollowup && x.nextFollowup < t).length,
  }), [threads, t]);
  useEffect(() => { onCountsChange?.(counts); }, [counts, onCountsChange]);

  async function openDetail(id) {
    setDetailLoading(true);
    setShowStep(false);
    setEditHead(null);
    try {
      const r = await apiRequest({ url: GT.THREAD + id });
      setDetail(r.data);
      setStep(emptyStep(r.data.nextMember ? { id: r.data.nextMember.id, name: r.data.nextMember.name } : null));
    } catch (e) { toast.error(e.message); }
    setDetailLoading(false);
  }

  function openNew() {
    setNewHead({ topic: "", project: "" });
    setNewStep(emptyStep(memberFilter?.id ? { id: memberFilter.id, name: memberFilter.name } : null));
    setNewOpen(true);
  }

  async function saveNew() {
    if (!newHead.topic.trim()) return toast.error("Enter the topic / agenda.");
    if (!newStep.person) return toast.error("Who did you talk to?");
    setSaving(true);
    try {
      const r = await apiRequest({ url: GT.THREADS, method: "POST", data: { ...newHead, ...stepPayload(newStep) } });
      toast.success("Conversation started");
      setNewOpen(false);
      fetchThreads(); refreshPeople(); loadProjects();
      setDetail(r.data);
      setStep(emptyStep(r.data.nextMember ? { id: r.data.nextMember.id, name: r.data.nextMember.name } : null));
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  }

  async function saveStep() {
    if (!step.person && !step.note && !step.status && !step.nextFollowup) return toast.error("Add who you talked to and what was discussed.");
    setSaving(true);
    try {
      const r = await apiRequest({ url: `${GT.THREAD}${detail.id}/entries`, method: "POST", data: stepPayload(step) });
      toast.success("Update logged");
      setDetail(r.data);
      setStep(emptyStep(r.data.nextMember ? { id: r.data.nextMember.id, name: r.data.nextMember.name } : null));
      setShowStep(false);
      fetchThreads(); refreshPeople();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  }

  async function saveHead() {
    if (!editHead.topic.trim()) return toast.error("Topic cannot be empty.");
    setSaving(true);
    try {
      const r = await apiRequest({ url: GT.THREAD + detail.id, method: "PUT", data: editHead });
      setDetail(r.data); setEditHead(null); fetchThreads(); loadProjects();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  }

  function quickClose(s) {
    setStep((x) => ({ ...x, status: s, nextFollowup: "", nextPerson: null }));
    setShowStep(true);
  }

  function deleteThread() {
    setConfirm({
      title: `Delete "${detail.topic}"?`,
      description: "The whole conversation history will be removed. The people stay in the register.",
      confirmLabel: "Delete", variant: "destructive",
      onConfirm: async () => {
        try {
          await apiRequest({ url: GT.THREAD + detail.id, method: "DELETE" });
          setDetail(null); fetchThreads();
        } catch (e) { toast.error(e.message); }
      },
    });
  }

  return (
    <>
      {/* controls */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topic, project, person…"
            className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {memberFilter?.id && (
          <span className="inline-flex items-center gap-1.5 text-xs pl-1 pr-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
            <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background: personColor(memberFilter.id) }}>{initials(memberFilter.name)}</span>
            {memberFilter.name}
            <button onClick={clearMemberFilter} className="text-blue-400 hover:text-blue-700">✕</button>
          </span>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs cursor-pointer">
          <option value="">All</option>
          <option value="open">Open (not finished)</option>
          {THREAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={project} onChange={(e) => setProject(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs cursor-pointer max-w-48">
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button onClick={openNew} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-1.5 text-xs font-semibold">
          + New Conversation
        </button>
      </div>

      {/* list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">💬 Conversations</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{threads.length}</span>
          <span className="ml-auto text-[11px] text-gray-400">Click a row to see its full history</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-2"><Loader2 className="animate-spin w-5 h-5" /> Loading…</div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <p className="text-4xl">💬</p>
            <p className="text-sm font-medium">No conversations {status === "open" ? "open" : "found"}</p>
            <p className="text-xs text-gray-300">Log who you talked to, about what, and when to follow up</p>
            <button onClick={openNew} className="mt-2 text-xs text-blue-600 hover:underline">+ Start one</button>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-390px)] min-h-[220px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_#f3f4f6]">
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Topic / Project</th>
                  <th className="px-4 py-3">People</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next Follow-up</th>
                  <th className="px-4 py-3">Last Talk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {threads.map((th) => (
                  <tr key={th.id} onClick={() => openDetail(th.id)} className="hover:bg-blue-50/60 cursor-pointer transition-colors group">
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="font-semibold text-gray-800 text-xs group-hover:text-blue-700 truncate" title={th.topic}>{th.topic}</p>
                      <p className="text-[11px] text-gray-400 truncate">{th.project ? `🏗 ${th.project}` : "No project"} · {th.entryCount} talk{th.entryCount !== 1 ? "s" : ""}</p>
                    </td>
                    <td className="px-4 py-3"><PeopleChain thread={th} onOpenPerson={onOpenPerson} /></td>
                    <td className="px-4 py-3"><ThreadStatus status={th.status} /></td>
                    <td className="px-4 py-3"><NextChip thread={th} /></td>
                    <td className="px-4 py-3 max-w-[240px]">
                      {th.lastEntry ? (
                        <>
                          <p className="text-[10px] text-gray-400">{fmtDate(th.lastEntry.date)}{th.lastEntry.member && <> · <b className="text-gray-500">{th.lastEntry.member.name}</b></>}</p>
                          <p className="text-xs text-gray-600 truncate" title={th.lastEntry.note || ""}>
                            {th.lastEntry.note || (th.lastEntry.referredTo ? `Referred to ${th.lastEntry.referredTo.name}` : "—")}
                          </p>
                        </>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* new conversation */}
      <Shell open={newOpen} onClose={() => setNewOpen(false)}
        title={<h2 className="text-sm font-bold text-gray-800">Start a conversation</h2>}
        subtitle={<p className="text-[11px] text-gray-400 mt-0.5">One topic — it can move between people; every talk is kept in its history.</p>}
        footer={<>
          <button onClick={() => setNewOpen(false)} className={btnGhost}>Cancel</button>
          <button onClick={saveNew} disabled={saving} className={btnPrimary}>{saving && <Loader2 className="animate-spin w-3 h-3" />} Start</button>
        </>}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Topic / Agenda *" className="col-span-2">
              <input autoFocus value={newHead.topic} onChange={(e) => setNewHead((h) => ({ ...h, topic: e.target.value }))}
                className={inputCls} maxLength={300} placeholder="e.g. Need 10 masons for Block C slab" />
            </Field>
            <Field label="Project">
              <input list="gt-projects" value={newHead.project} onChange={(e) => setNewHead((h) => ({ ...h, project: e.target.value }))}
                className={inputCls} maxLength={200} placeholder="Pick or type" />
            </Field>
          </div>
          <div className="border-t border-gray-200 pt-3"><StepForm step={newStep} setStep={setNewStep} people={people} /></div>
        </div>
      </Shell>

      {/* detail */}
      <Shell open={!!detail || detailLoading} wide onClose={() => { setDetail(null); setDetailLoading(false); }}
        title={detail && (editHead ? (
          <div className="flex gap-2 items-center">
            <input value={editHead.topic} onChange={(e) => setEditHead((h) => ({ ...h, topic: e.target.value }))} className={`${inputCls} font-semibold`} maxLength={300} />
            <input list="gt-projects" value={editHead.project} onChange={(e) => setEditHead((h) => ({ ...h, project: e.target.value }))} className={`${inputCls} max-w-44`} placeholder="Project" />
            <button onClick={saveHead} disabled={saving} className={btnPrimary}>Save</button>
            <button onClick={() => setEditHead(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-gray-800">{detail.topic}</h2>
            <ThreadStatus status={detail.status} />
            <button onClick={() => setEditHead({ topic: detail.topic, project: detail.project || "" })} className="text-gray-300 hover:text-amber-500 text-xs" title="Edit topic / project">✏️</button>
          </div>
        ))}
        subtitle={detail && !editHead && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {detail.project ? `🏗 ${detail.project} · ` : ""}started {detail.startedWith ? `with ${detail.startedWith.name} ` : ""}
            on {fmtDate(detail.entries?.[0]?.date)}{detail.createdBy ? ` by ${detail.createdBy}` : ""} · {detail.entryCount} talk{detail.entryCount !== 1 ? "s" : ""}
          </p>
        )}
        footer={detail && (
          <>
            <button onClick={deleteThread} className="mr-auto text-xs text-red-400 hover:text-red-600">🗑 Delete</button>
            {showStep ? (
              <>
                <button onClick={() => setShowStep(false)} className={btnGhost}>Cancel</button>
                <button onClick={saveStep} disabled={saving} className={btnPrimary}>{saving && <Loader2 className="animate-spin w-3 h-3" />} Save update</button>
              </>
            ) : (
              <>
                {!isClosed(detail.status) && <button onClick={() => quickClose("Done")} className={btnGhost}>✓ Mark finished</button>}
                <button onClick={() => setShowStep(true)} className={btnPrimary}>+ Log next talk</button>
              </>
            )}
          </>
        )}>
        {detailLoading && !detail ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-2"><Loader2 className="animate-spin w-5 h-5" /> Loading…</div>
        ) : detail && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">History</p>
              <ThreadTimeline thread={detail} onOpenPerson={onOpenPerson} />
            </div>
            {showStep && (
              <div className="bg-white rounded-xl border-2 border-blue-200 p-4">
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-3">Log next talk</p>
                <StepForm step={step} setStep={setStep} people={people} personLabel="Talked to" />
              </div>
            )}
          </div>
        )}
      </Shell>

      <datalist id="gt-projects">{projects.map((p) => <option key={p} value={p} />)}</datalist>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
