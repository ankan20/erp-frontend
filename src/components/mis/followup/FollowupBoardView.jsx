"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Loader2, RefreshCw, Play, Square, Pencil, CalendarRange, Search, GripVertical, Calendar, RotateCcw, Users, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { getCookie } from "@/lib/cookies";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import SearchableSelect from "@/components/common/SearchableSelect";
import { UserAvatar, btnPrimary, btnSecondary } from "@/components/mis/MisModal";
import AgendaFormDialog from "./AgendaFormDialog";
import AgendaDetailSheet from "./AgendaDetailSheet";
import { SprintFormDialog, CloseSprintDialog } from "./SprintDialogs";
import SprintReport from "./SprintReport";
import {
  followupApi, sprintApi, BOARD_COLUMNS, BOARD_DOT, BOARD_STYLE, SPRINT_STYLE, SPRINT_TYPES, canSuperviseIn,
} from "@/lib/misFollowups";
import { PRIORITY_STYLE, PRIORITY_STRIPE, TASKS_CHANGED, currentProject, fmtDate } from "@/lib/misTasks";

const TABS = [
  { id: "board", label: "Board" },
  { id: "backlog", label: "Backlog" },
  { id: "mine", label: "Waiting on Me" },
  { id: "report", label: "Sprint Report" },
];
const DRAG = "text/fu-id";

function AgendaCard({ f, myId, draggable, onOpen, dragging, setDragging }) {
  const cur = f.currentStep;
  const mine = cur && cur.assigneeUserId === myId;
  return (
    <article
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG, String(f.id)); e.dataTransfer.effectAllowed = "move"; setDragging(f.id); }}
      onDragEnd={() => setDragging(null)}
      onClick={() => onOpen(f)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(f)}
      tabIndex={0}
      aria-label={`${f.fuCode} ${f.title}`}
      className={`group bg-white rounded-lg border border-l-4 ${PRIORITY_STRIPE[f.priority]} p-2.5 shadow-sm cursor-pointer transition
        hover:shadow-md ${mine ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200 hover:border-gray-300"} ${dragging === f.id ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        {draggable && <GripVertical size={14} className="mt-0.5 text-gray-300 group-hover:text-gray-400 shrink-0 cursor-grab" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-gray-400">{f.fuCode}</span>
            {f.storyPoints != null && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded px-1.5">{f.storyPoints} pt</span>}
          </div>
          <p className="text-sm font-medium text-gray-800 leading-snug break-words">{f.title}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${PRIORITY_STYLE[f.priority]}`}>{f.priority}</span>
          {f.dueDate && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1
              ${f.isOverdue ? "bg-red-50 text-red-600 border-red-200 font-semibold" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
              <Calendar size={10} /> {fmtDate(f.dueDate)}
            </span>
          )}
          {f.reworkCount > 0 && <span className="text-[10px] text-purple-700 inline-flex items-center gap-0.5"><RotateCcw size={10} />{f.reworkCount}</span>}
        </div>
        {cur ? (
          <span className="flex items-center gap-1 shrink-0" title={`With ${cur.assigneeName} · step ${cur.seqNo}`}>
            <span className="text-[10px] text-gray-500">{f.doneSteps}/{f.stepCount}</span>
            <UserAvatar id={cur.assigneeUserId} name={cur.assigneeName} size={22} />
          </span>
        ) : f.boardStatus === "Review" ? (
          <span className="text-[10px] text-violet-700 font-medium shrink-0">with {f.supervisorName?.split(" ")[0]}</span>
        ) : null}
      </div>
      {mine && <p className="mt-1.5 text-[10px] font-semibold text-blue-700">Your turn{cur.status === "Pending" ? " · not started" : ""}</p>}
    </article>
  );
}

export default function FollowupBoardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const myId = Number(getCookie("userId")) || null;

  const [access, setAccess] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [project, setProject] = useState(() => currentProject()?.code || "company");
  const [sprintType, setSprintType] = useState("Weekly");
  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState("");
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === searchParams?.get("tab")) ? searchParams.get("tab") : "board"));
  const [items, setItems] = useState([]);
  const [review, setReview] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [overUser, setOverUser] = useState(null);

  const [agendaForm, setAgendaForm] = useState({ open: false, agenda: null });
  const [sprintForm, setSprintForm] = useState({ open: false, sprint: null });
  const [closing, setClosing] = useState(null);
  const [openId, setOpenId] = useState(null);

  // ── access + project list ──
  useEffect(() => {
    followupApi.access().then((r) => setAccess(r?.data || {})).catch(() => setAccess({}));
  }, []);
  useEffect(() => {
    if (!access?.isSuperAdmin) return;
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS })
      .then((r) => setAllProjects((r?.data || []).map((p) => ({ code: p.projectCode, name: p.projectName })))).catch(() => {});
  }, [access?.isSuperAdmin]);

  const projectOptions = useMemo(() => {
    const cp = currentProject();
    const seen = new Map();
    if (cp) seen.set(cp.code, cp.name);
    [...(access?.viewProjects || []), ...(access?.superviseProjects || [])].forEach((c) => !seen.has(c) && seen.set(c, ""));
    allProjects.forEach((p) => !seen.has(p.code) && seen.set(p.code, p.name));
    return [{ value: "company", label: "Company (all-level)" },
      ...[...seen].map(([c, n]) => ({ value: c, label: n ? `${c} : ${n}` : c }))];
  }, [access, allProjects]);
  const projectLabel = projectOptions.find((o) => o.value === project)?.label || project;
  const canSup = canSuperviseIn(access, project);

  // ── sprints of the project ──
  const loadSprints = useCallback(async (keepId) => {
    try {
      const r = await sprintApi.list({ projectCode: project });
      const list = r?.data || [];
      setSprints(list);
      setSprintId((prev) => {
        const want = keepId ?? prev;
        if (want && list.some((s) => String(s.id) === String(want))) return String(want);
        const ofType = list.filter((s) => s.sprintType === sprintType);
        const pick = ofType.find((s) => s.status === "Active") || ofType.find((s) => s.status === "Planned") || ofType[0];
        return pick ? String(pick.id) : "";
      });
    } catch {
      setSprints([]);
      setSprintId("");
    }
  }, [project, sprintType]);
  useEffect(() => { loadSprints(); }, [loadSprints]);

  const sprint = sprints.find((s) => String(s.id) === String(sprintId)) || null;
  const typeSprints = sprints.filter((s) => s.sprintType === sprintType);

  // ── people for the avatar rail / dialogs ──
  useEffect(() => {
    followupApi.assignable(project === "company" ? undefined : project)
      .then((r) => setUsers((r?.data || []).map((u) => ({ id: u.id, name: u.name, empCode: u.empCode }))))
      .catch(() => setUsers([]));
  }, [project]);
  const userOptions = useMemo(() => users.map((u) => ({ value: String(u.id), label: u.empCode ? `${u.name} (${u.empCode})` : u.name })), [users]);

  // ── items for the active tab ──
  const loadItems = useCallback(async () => {
    if (tab === "report") { setLoading(false); return; }
    setLoading(true);
    try {
      if (tab === "mine") {
        const [m, rv] = await Promise.all([
          followupApi.list({ scope: "mine", perPage: 300, search }),
          followupApi.list({ scope: "supervised", boardStatus: "Review", perPage: 300, search }),
        ]);
        setItems(m?.data?.items || []);
        setReview(rv?.data?.items || []);
      } else if (tab === "backlog") {
        const r = await followupApi.list({ scope: "board", projectCode: project, backlog: 1, perPage: 300, search });
        setItems(r?.data?.items || []);
      } else {
        if (!sprintId) { setItems([]); return; }
        const r = await followupApi.list({ scope: "board", projectCode: project, sprintId, perPage: 300, search });
        setItems(r?.data?.items || []);
      }
    } catch (e) {
      setItems([]);
      toast.error(e?.message || "Could not load the board");
    } finally {
      setLoading(false);
    }
  }, [tab, project, sprintId, search]);
  useEffect(() => { const t = setTimeout(loadItems, search ? 300 : 0); return () => clearTimeout(t); }, [loadItems, search]);
  useEffect(() => {
    const h = () => { loadItems(); loadSprints(); };
    window.addEventListener(TASKS_CHANGED, h);
    return () => window.removeEventListener(TASKS_CHANGED, h);
  }, [loadItems, loadSprints]);

  // ?agenda=<uuid> deep link (WhatsApp)
  useEffect(() => {
    const uuid = searchParams?.get("agenda");
    if (!uuid) return;
    followupApi.getByUuid(uuid).then((r) => r?.data?.id && setOpenId(r.data.id)).catch(() => toast.error("Follow-up not found"));
  }, [searchParams]);

  // ── drag & drop ──
  const draggedId = (e) => Number(e.dataTransfer.getData(DRAG) || dragging);
  const dropOnColumn = (col) => async (e) => {
    e.preventDefault();
    setOverCol(null);
    const id = draggedId(e);
    setDragging(null);
    const f = items.find((x) => x.id === id);
    if (!f || f.boardStatus === col) return;
    try {
      if (col === "Done" && !window.confirm(`Close ${f.fuCode}?`)) return;
      await followupApi.setBoardStatus(id, col);
      toast.success(`${f.fuCode} → ${col}`);
    } catch (err) {
      toast.error(err?.message || "Move not allowed");
    }
  };
  const dropOnUser = (u) => async (e) => {
    e.preventDefault();
    setOverUser(null);
    const id = draggedId(e);
    setDragging(null);
    const f = items.find((x) => x.id === id);
    if (!f) return;
    if (f.currentStep?.assigneeUserId === u.id) return toast.info(`Already with ${u.name}`);
    try {
      await followupApi.assign(id, { assigneeUserId: u.id });
      toast.success(`${f.fuCode} assigned to ${u.name} — WhatsApp sent`);
    } catch (err) {
      toast.error(err?.message || "Could not assign");
    }
  };
  const dropOnSprint = async (e) => {
    e.preventDefault();
    setOverCol(null);
    const id = draggedId(e);
    setDragging(null);
    if (!id || !sprint) return;
    try {
      await followupApi.moveSprint(id, sprint.id);
      toast.success(`Moved to ${sprint.name}`);
    } catch (err) {
      toast.error(err?.message || "Could not move");
    }
  };

  const openAgenda = (f) => setOpenId(f.id);
  const byCol = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, []]));
  items.forEach((f) => (byCol[f.boardStatus] || byCol["To Do"]).push(f));

  const sprintStart = async () => {
    try { await sprintApi.start(sprint.id); toast.success(`${sprint.name} started`); } catch (e) { toast.error(e?.message || "Could not start"); }
  };

  return (
    <div className="space-y-4">
      {/* ── context row: project · sprint type · sprint ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-60">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Project</p>
          <SearchableSelect options={projectOptions} value={project} onChange={(v) => { setProject(v || "company"); setSprintId(""); }} />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sprint</p>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-gray-300 overflow-hidden" role="radiogroup" aria-label="Sprint type">
              {SPRINT_TYPES.map((t) => (
                <button key={t} role="radio" aria-checked={sprintType === t} onClick={() => { setSprintType(t); setSprintId(""); }}
                  className={`px-3 py-2 text-sm ${sprintType === t ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>{t}</button>
              ))}
            </div>
            <div className="w-64">
              <SearchableSelect
                options={typeSprints.map((s) => ({ value: String(s.id), label: `${s.name} · ${s.status}` }))}
                value={sprintId} onChange={(v) => setSprintId(v || "")}
                placeholder={typeSprints.length ? "Choose sprint" : `No ${sprintType.toLowerCase()} sprint yet`} />
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button onClick={() => { loadItems(); loadSprints(); }} title="Refresh" aria-label="Refresh" className="p-2 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          {canSup && (
            <>
              <button onClick={() => setSprintForm({ open: true, sprint: null })} className={btnSecondary}><CalendarRange size={15} /> New Sprint</button>
              <button data-shortcut="create" onClick={() => setAgendaForm({ open: true, agenda: null })} className={btnPrimary}><Plus size={15} /> New Follow-up</button>
            </>
          )}
        </div>
      </div>

      {/* ── sprint strip ── */}
      {sprint && tab !== "mine" && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{sprint.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${SPRINT_STYLE[sprint.status]}`}>{sprint.status}</span>
            </div>
            <p className="text-[11px] text-gray-500">{fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}{sprint.goal ? ` · ${sprint.goal}` : ""}</p>
          </div>
          <div className="flex items-center gap-2 min-w-[180px] flex-1 max-w-sm">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar"
              aria-valuenow={sprint.doneCount} aria-valuemax={sprint.agendaCount} aria-label="Sprint progress">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sprint.agendaCount ? (100 * sprint.doneCount) / sprint.agendaCount : 0}%` }} />
            </div>
            <span className="text-xs text-gray-600 whitespace-nowrap">{sprint.doneCount}/{sprint.agendaCount} done{sprint.points ? ` · ${sprint.donePoints}/${sprint.points} pts` : ""}</span>
          </div>
          {canSup && sprint.status !== "Closed" && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setSprintForm({ open: true, sprint })} title="Edit sprint" aria-label="Edit sprint" className="p-2 rounded-md text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
              {sprint.status === "Planned" && <button onClick={sprintStart} className={btnSecondary}><Play size={14} /> Start</button>}
              <button onClick={() => setClosing(sprint)} className={btnSecondary}><Square size={13} /> Close sprint</button>
            </div>
          )}
        </div>
      )}

      {/* ── tabs + search ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200">
        <div className="flex">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== "report" && (
          <div className="relative pb-2">
            <Search size={14} className="absolute left-2.5 top-[calc(50%-4px)] -translate-y-1/2 text-gray-400" />
            <input data-shortcut="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agenda / code…"
              className="border border-gray-300 rounded-md pl-8 pr-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      {/* ── BOARD ── */}
      {tab === "board" && (
        !sprint ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 py-14 text-center">
            <p className="text-sm text-gray-600">No {sprintType.toLowerCase()} sprint for {projectLabel} yet.</p>
            {canSup
              ? <button onClick={() => setSprintForm({ open: true, sprint: null })} className="mt-3 text-sm text-blue-600 hover:underline">+ Create a sprint</button>
              : <p className="text-xs text-gray-500 mt-1">Ask your supervisor to start one.</p>}
          </div>
        ) : (
          <div className="flex gap-3 items-start">
            <div className={`flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 ${loading ? "opacity-60" : ""}`}>
              {BOARD_COLUMNS.map((col) => (
                <section key={col} aria-label={`${col} column`}
                  onDragOver={(e) => { if (dragging && canSup) { e.preventDefault(); setOverCol(col); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
                  onDrop={dropOnColumn(col)}
                  className={`rounded-xl border bg-gray-50/80 flex flex-col min-h-[260px] transition-colors ${overCol === col ? "border-blue-400 bg-blue-50/60" : "border-gray-200"}`}>
                  <header className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <span className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      <span className={`w-2 h-2 rounded-full ${BOARD_DOT[col]}`} /> {col}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2">{byCol[col].length}</span>
                  </header>
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-380px)]">
                    {byCol[col].length === 0 && <p className="text-[11px] text-gray-400 text-center py-6">{canSup ? "Drop here" : "Nothing here"}</p>}
                    {byCol[col].map((f) => (
                      <AgendaCard key={f.id} f={f} myId={myId} draggable={canSup} onOpen={openAgenda} dragging={dragging} setDragging={setDragging} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* team rail: drop a card on a person to (re)assign */}
            {canSup && (
              <aside className="hidden lg:flex w-[150px] shrink-0 flex-col bg-white rounded-xl border border-gray-200" aria-label="Team — drop a card to assign">
                <header className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Users size={13} /> Team
                </header>
                <p className="px-3 pt-2 text-[10px] text-gray-500 leading-snug">Drag a card onto a person to assign it.</p>
                <ul className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-420px)]">
                  {users.map((u) => {
                    const load = items.filter((f) => f.currentStep?.assigneeUserId === u.id).length;
                    return (
                      <li key={u.id}
                        onDragOver={(e) => { if (dragging) { e.preventDefault(); setOverUser(u.id); } }}
                        onDragLeave={() => setOverUser(null)}
                        onDrop={dropOnUser(u)}
                        aria-label={`Assign to ${u.name}`}
                        className={`flex items-center gap-2 rounded-lg px-1.5 py-1 border transition ${overUser === u.id ? "border-blue-400 bg-blue-50" : "border-transparent hover:bg-gray-50"}`}>
                        <UserAvatar id={u.id} name={u.name} size={26} />
                        <span className="text-xs text-gray-700 truncate flex-1">{u.name}</span>
                        {load > 0 && <span className="text-[10px] font-semibold text-gray-500">{load}</span>}
                      </li>
                    );
                  })}
                </ul>
              </aside>
            )}
          </div>
        )
      )}

      {/* ── BACKLOG ── */}
      {tab === "backlog" && (
        <div className="space-y-3">
          {canSup && sprint && sprint.status !== "Closed" && (
            <div onDragOver={(e) => { if (dragging) { e.preventDefault(); setOverCol("sprint"); } }}
              onDragLeave={() => setOverCol(null)} onDrop={dropOnSprint}
              className={`rounded-xl border-2 border-dashed px-4 py-3 text-sm text-center transition ${overCol === "sprint" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-500"}`}>
              Drag items here to add them to <b>{sprint.name}</b>
            </div>
          )}
          <ListTable rows={items} loading={loading} onOpen={openAgenda} myId={myId}
            draggable={canSup} setDragging={setDragging}
            empty="The backlog is empty." action={canSup && sprint && sprint.status !== "Closed" ? {
              label: `→ ${sprint.name}`,
              onClick: async (f) => { try { await followupApi.moveSprint(f.id, sprint.id); toast.success(`Moved to ${sprint.name}`); } catch (e) { toast.error(e?.message || "Could not move"); } },
            } : null} />
        </div>
      )}

      {/* ── WAITING ON ME ── */}
      {tab === "mine" && (
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2"><Inbox size={15} /> With me now <span className="text-gray-400 font-normal">({items.length})</span></h3>
            <ListTable rows={items} loading={loading} onOpen={openAgenda} myId={myId} empty="Nothing is waiting on you. 🎉" showProject />
          </section>
          {review.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-violet-800 mb-2">To review (you supervise) <span className="text-gray-400 font-normal">({review.length})</span></h3>
              <ListTable rows={review} loading={loading} onOpen={openAgenda} myId={myId} showProject />
            </section>
          )}
        </div>
      )}

      {/* ── REPORT ── */}
      {tab === "report" && <SprintReport sprintId={sprint?.id} />}

      <AgendaFormDialog open={agendaForm.open} agenda={agendaForm.agenda} onClose={() => setAgendaForm({ open: false, agenda: null })}
        projectCode={project} projectLabel={projectLabel} sprints={sprints} users={userOptions}
        defaultSprintId={tab === "board" && sprint && sprint.status !== "Closed" ? sprint.id : undefined}
        onSaved={() => loadItems()} />
      <SprintFormDialog open={sprintForm.open} sprint={sprintForm.sprint} onClose={() => setSprintForm({ open: false, sprint: null })}
        projectCode={project} projectLabel={projectLabel}
        onSaved={(s) => { if (s?.sprintType) setSprintType(s.sprintType); loadSprints(s?.id); }} />
      <CloseSprintDialog open={!!closing} sprint={closing} otherSprints={sprints} onClose={() => setClosing(null)} onClosed={() => loadSprints()} />
      <AgendaDetailSheet open={!!openId} agendaId={openId} sprints={sprints}
        onClose={() => { setOpenId(null); if (searchParams?.get("agenda")) router.replace(window.location.pathname); }}
        onEdit={(f) => { setOpenId(null); setAgendaForm({ open: true, agenda: f }); }}
        onChanged={() => { loadItems(); loadSprints(); }} />
    </div>
  );
}

export function ListTable({ rows, loading, onOpen, myId, empty = "Nothing here.", showProject = false, draggable = false, setDragging, action = null }) {
  if (loading && rows.length === 0) return <div className="py-10 flex justify-center text-gray-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (rows.length === 0) return <p className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">{empty}</p>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Code", "Agenda", showProject && "Project", "With", "Priority", "Target", "Status", action && ""].filter((h) => h !== false && h !== null).map((h, i) => (
                <th key={`${h}-${i}`} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((f) => {
              const cur = f.currentStep;
              return (
                <tr key={f.id} tabIndex={0} onClick={() => onOpen(f)} onKeyDown={(e) => e.key === "Enter" && onOpen(f)}
                  draggable={draggable}
                  onDragStart={(e) => { e.dataTransfer.setData(DRAG, String(f.id)); setDragging?.(f.id); }}
                  onDragEnd={() => setDragging?.(null)}
                  className="hover:bg-blue-50/40 cursor-pointer focus:outline-none focus:bg-blue-50/60">
                  <td className="px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{f.fuCode}</td>
                  <td className="px-4 py-2.5 text-gray-800 font-medium max-w-[340px]">
                    {f.title}
                    {cur?.assigneeUserId === myId && cur?.instruction && <p className="text-[11px] text-gray-500 font-normal truncate">“{cur.instruction}”</p>}
                  </td>
                  {showProject && <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{f.projectCode || "Company"}</td>}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {cur ? <span className="inline-flex items-center gap-1.5"><UserAvatar id={cur.assigneeUserId} name={cur.assigneeName} size={20} /><span className="text-gray-700">{cur.assigneeName}</span></span>
                      : f.boardStatus === "Review" ? <span className="text-violet-700">{f.supervisorName} (review)</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5"><span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${PRIORITY_STYLE[f.priority]}`}>{f.priority}</span></td>
                  <td className={`px-4 py-2.5 whitespace-nowrap ${f.isOverdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>{fmtDate(f.dueDate)}</td>
                  <td className="px-4 py-2.5"><span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium whitespace-nowrap ${BOARD_STYLE[f.boardStatus]}`}>{f.boardStatus}</span></td>
                  {action && (
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => action.onClick(f)} className="text-xs text-blue-700 hover:underline whitespace-nowrap">{action.label}</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
