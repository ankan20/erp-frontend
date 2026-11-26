"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, Search, CalendarRange, Play, Square, Pencil, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import SearchableSelect from "@/components/common/SearchableSelect";
import { MisModal, Field, inputCls, btnPrimary, btnSecondary } from "@/components/mis/MisModal";
import { SprintFormDialog } from "@/components/mis/followup/SprintDialogs";
import { sprintApi, SPRINT_STYLE } from "@/lib/misFollowups";
import { TASKS_CHANGED, currentProject, fmtDate } from "@/lib/misTasks";
import { workItemApi, flattenTree, sumPoints, SPRINT_TYPES_OK } from "@/lib/misBoards";
import BacklogTree, { NewItemButtons, WI_DRAG } from "./BacklogTree";
import SprintPlanning from "./SprintPlanning";
import Taskboard from "./Taskboard";
import KanbanBoard from "./KanbanBoard";
import SprintCharts from "./SprintCharts";
import QueriesView from "./QueriesView";
import { Standup, Retro } from "./ScrumViews";
import WorkItemSheet from "./WorkItemSheet";

const TABS = [
  { id: "backlog", label: "Backlog" },
  { id: "kanban", label: "Kanban" },
  { id: "planning", label: "Sprint planning" },
  { id: "taskboard", label: "Taskboard" },
  { id: "standup", label: "Stand-up" },
  { id: "reports", label: "Reports" },
  { id: "retro", label: "Retro" },
  { id: "queries", label: "Queries" },
];
const SPRINT_TABS = ["planning", "taskboard", "standup", "reports", "retro"];

export default function BoardsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [access, setAccess] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [project, setProject] = useState(() => currentProject()?.code || "company");
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === searchParams?.get("tab")) ? searchParams.get("tab") : "backlog"));
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [search, setSearch] = useState("");
  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState("");
  const [users, setUsers] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [overSprint, setOverSprint] = useState(null);
  const [sheet, setSheet] = useState(null);        // { itemId } | { draft }
  const [sprintForm, setSprintForm] = useState({ open: false, sprint: null });
  const [closing, setClosing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── access + projects ──
  useEffect(() => { workItemApi.access().then((r) => setAccess(r?.data || {})).catch(() => setAccess({})); }, []);
  useEffect(() => {
    if (!access?.isSuperAdmin) return;
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS })
      .then((r) => setAllProjects((r?.data || []).map((p) => ({ code: p.projectCode, name: p.projectName })))).catch(() => {});
  }, [access?.isSuperAdmin]);
  const projectOptions = useMemo(() => {
    const seen = new Map();
    const cp = currentProject();
    if (cp) seen.set(cp.code, cp.name);
    (access?.projects || []).forEach((p) => !seen.has(p.code) && seen.set(p.code, p.name));
    allProjects.forEach((p) => !seen.has(p.code) && seen.set(p.code, p.name));
    return [{ value: "company", label: "Company (all-level)" }, ...[...seen].map(([c, n]) => ({ value: c, label: n ? `${c} : ${n}` : c }))];
  }, [access, allProjects]);
  const projectLabel = projectOptions.find((o) => o.value === project)?.label || project;
  const canManageSprints = project === "company" ? !!access?.canManageCompanySprints
    : !!(access?.isSuperAdmin || access?.manageSprintProjects?.includes(project));

  // ── sprints ──
  const loadSprints = useCallback(async (keepId) => {
    try {
      const r = await sprintApi.list({ projectCode: project });
      const list = r?.data || [];
      setSprints(list);
      setSprintId((prev) => {
        const want = keepId ?? prev;
        if (want && list.some((s) => String(s.id) === String(want))) return String(want);
        const pick = list.find((s) => s.status === "Active") || list.find((s) => s.status === "Planned") || list[0];
        return pick ? String(pick.id) : "";
      });
    } catch { setSprints([]); setSprintId(""); }
  }, [project]);
  useEffect(() => { loadSprints(); }, [loadSprints]);
  const sprint = sprints.find((s) => String(s.id) === String(sprintId)) || null;
  const openSprints = sprints.filter((s) => s.status !== "Closed");

  // ── people (team members) ──
  useEffect(() => {
    workItemApi.assignable(project, "PBI").then((r) => setUsers(r?.data || [])).catch(() => setUsers([]));
  }, [project]);

  // ── backlog tree ──
  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const r = await workItemApi.tree({ projectCode: project, includeDone: showDone ? 1 : undefined });
      setRoots(r?.data || []);
    } catch (e) {
      setRoots([]);
      toast.error(e?.message || "Could not load the backlog");
    } finally {
      setLoading(false);
    }
  }, [project, showDone]);
  useEffect(() => { loadTree(); }, [loadTree]);
  const refresh = useCallback(() => { loadTree(); loadSprints(); setRefreshKey((k) => k + 1); }, [loadTree, loadSprints]);
  useEffect(() => {
    const h = () => { loadTree(); setRefreshKey((k) => k + 1); };
    window.addEventListener(TASKS_CHANGED, h);
    return () => window.removeEventListener(TASKS_CHANGED, h);
  }, [loadTree]);

  // client-side search keeps the ancestors of matches so the tree still reads
  const shownRoots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roots;
    const hit = (n) => `${n.taskCode} ${n.title} ${(n.tags || []).join(" ")}`.toLowerCase().includes(q);
    const prune = (ns) => ns.map((n) => {
      const kids = prune(n.children || []);
      return hit(n) || kids.length ? { ...n, children: kids } : null;
    }).filter(Boolean);
    return prune(roots);
  }, [roots, search]);

  // points already planned into each sprint (from the full tree)
  const plannedBySprint = useMemo(() => {
    const m = {};
    flattenTree(roots, new Set()).forEach((r) => {
      if (!r.sprintId) return;
      const x = (m[r.sprintId] ||= { items: [], count: 0 });
      x.items.push(r); x.count += 1;
    });
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { count: v.count, points: sumPoints(v.items) }]));
  }, [roots]);

  // ?item=<uuid> deep link (WhatsApp)
  useEffect(() => {
    const uuid = searchParams?.get("item");
    if (!uuid) return;
    workItemApi.getByUuid(uuid).then((r) => r?.data?.id && setSheet({ itemId: r.data.id })).catch(() => toast.error("Work item not found"));
  }, [searchParams]);

  const openItem = (id, draft) => setSheet(id ? { itemId: id } : { draft });
  const addChild = (parent, childType) => setSheet({
    draft: { workItemType: childType, parentId: parent.id, sprintId: childType === "Task" ? parent.sprintId : undefined },
  });
  const newItem = (type) => setSheet({
    draft: { workItemType: type, sprintId: SPRINT_TABS.includes(tab) && sprint && SPRINT_TYPES_OK.includes(type) && sprint.status !== "Closed" ? sprint.id : undefined },
  });

  // drop on a sprint card (planning pane) → plan the item
  const dropOnSprint = (s) => async (e) => {
    e.preventDefault();
    setOverSprint(null);
    const id = Number(e.dataTransfer.getData(WI_DRAG) || dragging);
    setDragging(null);
    if (!id) return;
    try {
      await workItemApi.update(id, { sprintId: s ? s.id : "backlog" });
      toast.success(s ? `Planned into ${s.name}` : "Moved to the backlog");
      refresh();
    } catch (err) { toast.error(err?.message || "Could not plan this item"); }
  };

  const startSprint = async () => {
    try { await sprintApi.start(sprint.id); toast.success(`${sprint.name} started`); loadSprints(sprint.id); }
    catch (e) { toast.error(e?.message || "Could not start"); }
  };

  return (
    <div className="space-y-4">
      {/* ── context row ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Project</p>
          <SearchableSelect options={projectOptions} value={project} onChange={(v) => { setProject(v || "company"); setSprintId(""); }} />
        </div>
        {SPRINT_TABS.includes(tab) && (
          <div className="w-72">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sprint</p>
            <SearchableSelect options={sprints.map((s) => ({ value: String(s.id), label: `${s.name} · ${s.status}` }))}
              value={sprintId} onChange={(v) => setSprintId(v || "")} placeholder={sprints.length ? "Choose sprint" : "No sprint yet"} />
          </div>
        )}
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={refresh} title="Refresh" aria-label="Refresh" className="p-2 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          {canManageSprints && <button onClick={() => setSprintForm({ open: true, sprint: null })} className={btnSecondary}><CalendarRange size={15} /> New Sprint</button>}
          <NewItemButtons onNew={newItem} />
        </div>
      </div>

      {/* ── tabs ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200">
        <div className="flex">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "backlog" && (
          <div className="flex items-center gap-3 pb-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-blue-600" /> Show done
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input data-shortcut="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title / code / tag…"
                className="border border-gray-300 rounded-md pl-8 pr-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}
      </div>

      {/* ── BACKLOG ── */}
      {tab === "backlog" && (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <BacklogTree roots={shownRoots} loading={loading} onOpen={(id) => openItem(id)} onAddChild={addChild}
              sprints={sprints} users={users} dragging={dragging} setDragging={setDragging} onChanged={refresh}
              emptyText={search ? "Nothing matches the search." : "The backlog is empty — start with an Epic or a PBI."} />
          </div>

          {/* planning pane: drop targets */}
          <aside className="hidden lg:block w-64 shrink-0 space-y-2" aria-label="Planning — drop items on a sprint">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><CalendarDays size={13} /> Planning</p>
            <div onDragOver={(e) => { if (dragging) { e.preventDefault(); setOverSprint("backlog"); } }}
              onDragLeave={() => setOverSprint(null)} onDrop={dropOnSprint(null)}
              className={`rounded-lg border-2 border-dashed px-3 py-2 text-xs text-center transition ${overSprint === "backlog" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-500"}`}>
              Drop here → back to backlog
            </div>
            {openSprints.length === 0 && <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-3">No open sprint.{canManageSprints ? " Create one with New Sprint." : ""}</p>}
            {openSprints.map((s) => {
              const p = plannedBySprint[s.id] || { count: 0, points: 0 };
              return (
                <div key={s.id}
                  onDragOver={(e) => { if (dragging) { e.preventDefault(); setOverSprint(s.id); } }}
                  onDragLeave={() => setOverSprint(null)} onDrop={dropOnSprint(s)}
                  className={`rounded-lg border bg-white px-3 py-2.5 transition ${overSprint === s.id ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => { setSprintId(String(s.id)); setTab("planning"); }} className="text-sm font-semibold text-gray-800 hover:text-blue-700 hover:underline truncate text-left">{s.name}</button>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${SPRINT_STYLE[s.status]}`}>{s.status}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{fmtDate(s.startDate)} → {fmtDate(s.endDate)}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{p.count} item(s) · {p.points} pt</p>
                </div>
              );
            })}
          </aside>
        </div>
      )}

      {/* ── QUERIES ── */}
      {tab === "queries" && (
        <QueriesView projectCode={project} sprints={sprints} users={users} onOpen={(id) => openItem(id)} refreshKey={refreshKey} />
      )}

      {/* ── KANBAN ── */}
      {tab === "kanban" && (
        <KanbanBoard projectCode={project} onOpen={(id) => openItem(id)} refreshKey={refreshKey} onNew={newItem} />
      )}

      {/* ── SPRINT PLANNING / TASKBOARD ── */}
      {SPRINT_TABS.includes(tab) && (
        <div className="space-y-3">
          {sprint && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{sprint.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${SPRINT_STYLE[sprint.status]}`}>{sprint.status}</span>
                  <span className="text-[10px] text-gray-500">{sprint.sprintType}</span>
                </div>
                <p className="text-[11px] text-gray-500">{fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}{sprint.goal ? ` · Goal: ${sprint.goal}` : ""}</p>
              </div>
              {canManageSprints && sprint.status !== "Closed" && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setSprintForm({ open: true, sprint })} title="Edit sprint" aria-label="Edit sprint" className="p-2 rounded-md text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
                  {sprint.status === "Planned" && <button onClick={startSprint} className={btnSecondary}><Play size={14} /> Start</button>}
                  <button onClick={() => setClosing(sprint)} className={btnSecondary}><Square size={13} /> Close sprint</button>
                </div>
              )}
            </div>
          )}
          {tab === "planning" ? (
            <SprintPlanning sprint={sprint} projectCode={project} sprints={sprints} users={users}
              onOpen={(id) => openItem(id)} onAddChild={addChild} dragging={dragging} setDragging={setDragging}
              refreshKey={refreshKey} onChanged={loadTree} />
          ) : tab === "taskboard" ? (
            <Taskboard sprint={sprint} projectCode={project} onOpen={(id) => openItem(id)} onAddChild={addChild} refreshKey={refreshKey} />
          ) : tab === "standup" ? (
            <Standup sprint={sprint} onOpen={(id) => openItem(id)} refreshKey={refreshKey} />
          ) : tab === "reports" ? (
            <SprintCharts sprint={sprint} projectCode={project} refreshKey={refreshKey} />
          ) : (
            <Retro sprint={sprint} onOpen={(id) => openItem(id)} onChanged={loadTree} />
          )}
        </div>
      )}

      <WorkItemSheet open={!!sheet} itemId={sheet?.itemId} draft={sheet?.draft} projectCode={project} projectLabel={projectLabel}
        sprints={sprints} onOpenItem={openItem}
        onClose={() => { setSheet(null); if (searchParams?.get("item")) router.replace(window.location.pathname); }}
        onSaved={() => refresh()} />
      <SprintFormDialog open={sprintForm.open} sprint={sprintForm.sprint} onClose={() => setSprintForm({ open: false, sprint: null })}
        projectCode={project} projectLabel={projectLabel} onSaved={(s) => loadSprints(s?.id)} />
      <CloseBoardsSprintDialog sprint={closing} otherSprints={sprints} onClose={() => setClosing(null)} onClosed={refresh} />
    </div>
  );
}

function CloseBoardsSprintDialog({ sprint, otherSprints, onClose, onClosed }) {
  const [moveTo, setMoveTo] = useState("backlog");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (sprint) setMoveTo("backlog"); }, [sprint]);
  if (!sprint) return null;
  const targets = otherSprints.filter((s) => s.id !== sprint.id && s.status !== "Closed");
  const submit = async () => {
    setSaving(true);
    try {
      const r = await sprintApi.close(sprint.id, moveTo);
      const n = (r?.data?.movedWorkItems ?? 0) + (r?.data?.movedCount ?? 0);
      toast.success(`Sprint closed · ${n} unfinished item(s) moved`);
      onClosed?.();
      onClose?.();
    } catch (e) { toast.error(e?.message || "Could not close sprint"); }
    finally { setSaving(false); }
  };
  return (
    <MisModal open onClose={onClose} onSubmit={submit} title={`Close ${sprint.name}`}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        <button type="submit" data-shortcut="submit" disabled={saving} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin" />}Close sprint</button>
      </>}>
      <p className="text-sm text-gray-700">Done work stays in this sprint (it counts for velocity). Unfinished PBIs, Bugs and Tasks — and follow-ups — move to:</p>
      <Field label="Move unfinished to">
        <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={inputCls}>
          <option value="backlog">Backlog</option>
          {targets.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}
        </select>
      </Field>
    </MisModal>
  );
}
