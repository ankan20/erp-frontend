"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, Trash2, Users, Lock, Search, Columns3, Ban } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/common/SearchableSelect";
import { MisModal, Field, inputCls, btnPrimary, btnSecondary, UserAvatar } from "@/components/mis/MisModal";
import { TASK_PRIORITIES, fmtDate, todayISO } from "@/lib/misTasks";
import { workItemApi, WI_TYPES, POINT_TYPES, STATE_STYLE } from "@/lib/misBoards";
import { TypeBadge } from "./WorkItemSheet";

const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const BUILT_IN = [
  { id: "my-work", name: "My open work", filters: { assignedTo: "me", openOnly: "1" } },
  { id: "assigned", name: "Assigned to me (all)", filters: { assignedTo: "me" } },
  { id: "blocked", name: "Blocked", filters: { blocked: "1", openOnly: "1" } },
  { id: "due-week", name: "Due in the next 7 days", filters: () => ({ dueFrom: todayISO(), dueTo: plusDays(7), openOnly: "1" }) },
  { id: "bugs", name: "Open bugs", filters: { type: "Bug", openOnly: "1" } },
  { id: "unparented", name: "Tasks without a parent", filters: { type: "Task", parentId: "none", openOnly: "1" } },
  { id: "backlog", name: "Unplanned PBIs", filters: { type: "PBI,Bug", sprintId: "backlog", openOnly: "1" } },
];
const COLUMNS = [
  { id: "code", label: "ID" }, { id: "type", label: "Type" }, { id: "title", label: "Title" },
  { id: "state", label: "State" }, { id: "assignedTo", label: "Assigned" }, { id: "priority", label: "Priority" },
  { id: "effort", label: "Effort" }, { id: "sprint", label: "Sprint" }, { id: "parent", label: "Parent" },
  { id: "dueDate", label: "Target" }, { id: "tags", label: "Tags" }, { id: "createdAt", label: "Created" },
];
const DEFAULT_COLS = ["code", "type", "title", "state", "assignedTo", "effort", "sprint"];
const blank = { type: "", state: "", sprintId: "", assignedTo: "", tag: "", search: "", blocked: "", openOnly: "1", dueFrom: "", dueTo: "" };

function cell(col, r, onOpen) {
  switch (col) {
    case "code": return <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">{r.taskCode}</span>;
    case "type": return <TypeBadge type={r.workItemType} />;
    case "title": return (
      <button onClick={() => onOpen(r.id)} className="text-left text-gray-800 font-medium hover:text-blue-700 hover:underline">
        {r.title}{r.isBlocked && <Ban size={12} className="inline ml-1 text-red-500" />}
      </button>
    );
    case "state": return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${STATE_STYLE[r.state] || STATE_STYLE.New}`}>{r.state}</span>;
    case "assignedTo": return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><UserAvatar id={r.ownerUserId} name={r.ownerName} size={18} /><span className="text-xs">{r.ownerName}</span></span>;
    case "priority": return <span className="text-xs">{r.priority}</span>;
    case "effort": return <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">{POINT_TYPES.includes(r.workItemType) ? (r.storyPoints != null ? `${r.storyPoints} pt` : "") : r.remainingHours != null ? `${r.remainingHours} h` : ""}</span>;
    case "sprint": return <span className="text-xs text-gray-600 whitespace-nowrap">{r.sprintName || ""}</span>;
    case "parent": return <span className="text-xs text-gray-500">{r.parentId ? `#${r.parentId}` : ""}</span>;
    case "dueDate": return <span className={`text-xs whitespace-nowrap ${r.isOverdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>{fmtDate(r.dueDate)}</span>;
    case "tags": return <span className="flex flex-wrap gap-1">{(r.tags || []).map((t) => <span key={t} className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5">{t}</span>)}</span>;
    case "createdAt": return <span className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.createdAt)}</span>;
    default: return null;
  }
}

/** Work item queries (Azure "Queries"): built-in + saved (private / shared with the project). */
export default function QueriesView({ projectCode, sprints, users, onOpen, refreshKey }) {
  const [saved, setSaved] = useState([]);
  const [active, setActive] = useState({ kind: "built", id: "my-work" });
  const [filters, setFilters] = useState({ ...blank, ...BUILT_IN[0].filters });
  const [columns, setColumns] = useState(DEFAULT_COLS);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [saveDlg, setSaveDlg] = useState(null);           // { name, isShared, id? }
  const [colPicker, setColPicker] = useState(false);

  const loadSaved = useCallback(() => {
    workItemApi.queries(projectCode || "company").then((r) => setSaved(r?.data || [])).catch(() => setSaved([]));
  }, [projectCode]);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const r = await workItemApi.list({ projectCode: projectCode || "company", limit: 500, ...filters });
      setRows(r?.data?.items || []);
      setTotal(r?.data?.total || 0);
      setSelected(new Set());
    } catch (e) {
      toast.error(e?.message || "Query failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectCode, filters]);
  useEffect(() => { const t = setTimeout(run, 250); return () => clearTimeout(t); }, [run, refreshKey]);

  const pickBuilt = (q) => {
    setActive({ kind: "built", id: q.id });
    setFilters({ ...blank, openOnly: "", ...(typeof q.filters === "function" ? q.filters() : q.filters) });
    setColumns(DEFAULT_COLS);
  };
  const pickSaved = (q) => {
    setActive({ kind: "saved", id: q.id });
    setFilters({ ...blank, openOnly: "", ...q.filters });
    setColumns(q.columns?.length ? q.columns : DEFAULT_COLS);
  };
  const activeSaved = active.kind === "saved" ? saved.find((q) => q.id === active.id) : null;
  const setF = (k) => (v) => setFilters((f) => ({ ...f, [k]: v?.target ? (v.target.type === "checkbox" ? (v.target.checked ? "1" : "") : v.target.value) : (v ?? "") }));
  const toggleType = (t) => setFilters((f) => {
    const s = new Set((f.type || "").split(",").filter(Boolean));
    s.has(t) ? s.delete(t) : s.add(t);
    return { ...f, type: [...s].join(",") };
  });

  const doSave = async () => {
    const d = saveDlg;
    if (!d.name.trim()) return toast.error("Name the query");
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "" && v != null));
      const r = await workItemApi.saveQuery({ name: d.name.trim(), isShared: d.isShared, filters: clean, columns, projectCode: projectCode === "company" ? null : projectCode }, d.id);
      toast.success("Query saved");
      setSaveDlg(null);
      loadSaved();
      setActive({ kind: "saved", id: r?.data?.id });
    } catch (e) { toast.error(e?.message || "Could not save"); }
  };
  const doDelete = async () => {
    try { await workItemApi.deleteQuery(activeSaved.id); toast.success("Query deleted"); loadSaved(); pickBuilt(BUILT_IN[0]); }
    catch (e) { toast.error(e?.message || "Could not delete"); }
  };
  const bulk = async (changes, label) => {
    try { await workItemApi.bulk([...selected], changes); toast.success(`${selected.size} item(s) ${label}`); run(); }
    catch (e) { toast.error(e?.message || "Bulk change failed"); }
  };

  const sprintOpts = useMemo(() => [{ value: "backlog", label: "Backlog (no sprint)" }, ...sprints.map((s) => ({ value: String(s.id), label: `${s.name} · ${s.status}` }))], [sprints]);
  const userOpts = useMemo(() => [{ value: "me", label: "Me" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))], [users]);
  const types = new Set((filters.type || "").split(",").filter(Boolean));

  return (
    <div className="flex gap-4 items-start">
      {/* query list */}
      <aside className="w-56 shrink-0 bg-white rounded-xl border border-gray-200 p-2 space-y-3" aria-label="Queries">
        <div>
          <p className="px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Built-in</p>
          {BUILT_IN.map((q) => (
            <button key={q.id} onClick={() => pickBuilt(q)} aria-current={active.kind === "built" && active.id === q.id}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-md ${active.kind === "built" && active.id === q.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}>{q.name}</button>
          ))}
        </div>
        <div>
          <p className="px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Saved</p>
          {saved.length === 0 && <p className="px-2 text-[11px] text-gray-400">None yet — set filters and Save.</p>}
          {saved.map((q) => (
            <button key={q.id} onClick={() => pickSaved(q)} aria-current={active.kind === "saved" && active.id === q.id}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-md inline-flex items-center gap-1.5 ${active.kind === "saved" && active.id === q.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}>
              {q.isShared ? <Users size={12} className="shrink-0 text-gray-400" title="Shared with the project" /> : <Lock size={12} className="shrink-0 text-gray-400" title="Only you" />}
              <span className="truncate">{q.name}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-3">
        {/* filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mr-1">Type</span>
            {WI_TYPES.map((t) => (
              <button key={t} onClick={() => toggleType(t)} aria-pressed={types.has(t)}
                className={`text-xs px-2 py-1 rounded-full border ${types.has(t) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>{t}</button>
            ))}
            <span className="flex-1" />
            <label className="inline-flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={filters.openOnly === "1"} onChange={setF("openOnly")} className="accent-blue-600" /> Open only</label>
            <label className="inline-flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={filters.blocked === "1"} onChange={setF("blocked")} className="accent-red-600" /> Blocked</label>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
            <Field label="Search" className="lg:col-span-2">
              <div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={filters.search} onChange={setF("search")} className={`${inputCls} pl-7`} placeholder="Title / code" /></div>
            </Field>
            <Field label="Assigned to"><SearchableSelect options={userOpts} value={filters.assignedTo} onChange={setF("assignedTo")} placeholder="Anyone" clearLabel="Anyone" /></Field>
            <Field label="Sprint"><SearchableSelect options={sprintOpts} value={filters.sprintId} onChange={setF("sprintId")} placeholder="Any" clearLabel="Any" /></Field>
            <Field label="Target from"><input type="date" value={filters.dueFrom} onChange={setF("dueFrom")} className={inputCls} /></Field>
            <Field label="Target to"><input type="date" value={filters.dueTo} onChange={setF("dueTo")} className={inputCls} /></Field>
            <Field label="State (comma separated)" className="lg:col-span-2"><input value={filters.state} onChange={setF("state")} className={inputCls} placeholder="e.g. Committed, In Progress" /></Field>
            <Field label="Tag"><input value={filters.tag} onChange={setF("tag")} className={inputCls} /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-gray-600">{loading ? <Loader2 size={13} className="inline animate-spin" /> : `${total} result(s)`}</span>
            <span className="flex-1" />
            <button onClick={() => setColPicker(true)} className={btnSecondary}><Columns3 size={14} /> Columns</button>
            {activeSaved?.canEdit && (
              <>
                <button onClick={() => setSaveDlg({ id: activeSaved.id, name: activeSaved.name, isShared: activeSaved.isShared })} className={btnSecondary}><Save size={14} /> Save</button>
                <button onClick={doDelete} className={`${btnSecondary} text-red-600`}><Trash2 size={14} /> Delete</button>
              </>
            )}
            <button onClick={() => setSaveDlg({ name: activeSaved ? `${activeSaved.name} (copy)` : "", isShared: false })} className={btnPrimary}><Save size={14} /> Save as…</button>
          </div>
        </div>

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs">
            <b className="text-blue-800">{selected.size} selected</b>
            <div className="w-52"><SearchableSelect options={sprintOpts} value="" placeholder="Move to sprint…" onChange={(v) => v && bulk({ sprintId: v === "backlog" ? "backlog" : Number(v) }, "moved")} /></div>
            <div className="w-44"><SearchableSelect options={users.map((u) => ({ value: String(u.id), label: u.name }))} value="" placeholder="Assign to…" onChange={(v) => v && bulk({ assignedTo: Number(v) }, "assigned")} /></div>
            <select defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ""; v && bulk({ priority: v }, "updated"); }} className="border border-gray-300 rounded-md px-2 py-1.5 bg-white" aria-label="Set priority">
              <option value="" disabled>Priority…</option>{TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <button onClick={() => setSelected(new Set())} className="text-gray-600 hover:underline">Clear</button>
          </div>
        )}

        {/* results */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" aria-label="Select all" className="accent-blue-600" checked={rows.length > 0 && rows.filter((r) => r.canEdit).every((r) => selected.has(r.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.filter((r) => r.canEdit).map((r) => r.id)) : new Set())} />
                </th>
                {columns.map((c) => <th key={c} className="px-3 py-2 text-left whitespace-nowrap">{COLUMNS.find((x) => x.id === c)?.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className="px-3 py-1.5"><input type="checkbox" disabled={!r.canEdit} checked={selected.has(r.id)} aria-label={`Select ${r.taskCode}`} className="accent-blue-600"
                    onChange={() => setSelected((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} /></td>
                  {columns.map((c) => <td key={c} className="px-3 py-1.5">{cell(c, r, onOpen)}</td>)}
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan={columns.length + 1} className="py-10 text-center text-sm text-gray-500">No work items match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <MisModal open={!!saveDlg} onClose={() => setSaveDlg(null)} onSubmit={doSave} title={saveDlg?.id ? "Save query" : "Save query as"}
        footer={<><button type="button" onClick={() => setSaveDlg(null)} className={btnSecondary}>Cancel</button><button type="submit" data-shortcut="submit" className={btnPrimary}>Save</button></>}>
        <Field label="Name" required><input autoFocus value={saveDlg?.name || ""} onChange={(e) => setSaveDlg((d) => ({ ...d, name: e.target.value }))} maxLength={120} className={inputCls} /></Field>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={!!saveDlg?.isShared} onChange={(e) => setSaveDlg((d) => ({ ...d, isShared: e.target.checked }))} className="accent-blue-600" />
          Share with everyone in this project
        </label>
      </MisModal>
      <MisModal open={colPicker} onClose={() => setColPicker(false)} title="Columns" maxWidth="max-w-sm"
        footer={<button type="button" onClick={() => setColPicker(false)} className={btnPrimary}>Done</button>}>
        <div className="grid grid-cols-2 gap-1.5">
          {COLUMNS.map((c) => (
            <label key={c.id} className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={columns.includes(c.id)} disabled={c.id === "title"} className="accent-blue-600"
                onChange={(e) => setColumns((cs) => (e.target.checked ? COLUMNS.map((x) => x.id).filter((x) => cs.includes(x) || x === c.id) : cs.filter((x) => x !== c.id)))} />
              {c.label}
            </label>
          ))}
        </div>
      </MisModal>
    </div>
  );
}
