"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Trash2, Loader2, Plus, Link2, MessageSquare, ListTree, AtSign, Ban, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/common/SearchableSelect";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Field, inputCls, btnPrimary, btnSecondary, UserAvatar } from "@/components/mis/MisModal";
import { TASK_PRIORITIES, fmtDateTime } from "@/lib/misTasks";
import { followupApi } from "@/lib/misFollowups";
import {
  workItemApi, WI_STATES, WI_TYPES, PARENT_TYPES, CHILD_TYPE, SPRINT_TYPES_OK, POINT_TYPES,
  TYPE_STYLE, STATE_STYLE, typeLabel, typePlural,
} from "@/lib/misBoards";

const ACT = {
  CREATED: "created it", ASSIGNED: "assigned", STATUS: "changed state", SPRINT: "moved sprint", PARENT: "changed parent",
  UPDATED: "edited", COMMENT: "commented", DELETED: "deleted it", LINKED: "added a link", UNLINKED: "removed a link",
  STARTED: "started work", REOPENED: "reopened it",
};
const TABS = [
  { id: "children", label: "Children", icon: ListTree },
  { id: "links", label: "Links", icon: Link2 },
  { id: "discussion", label: "Discussion", icon: MessageSquare },
];

const toForm = (d) => ({
  workItemType: d.workItemType || "PBI",
  title: d.title || "",
  state: d.state || d.status || "",
  assignedTo: d.ownerUserId ? String(d.ownerUserId) : "",
  priority: d.priority || "Medium",
  parentId: d.parentId ? String(d.parentId) : "",
  sprintId: d.sprintId ? String(d.sprintId) : "",
  storyPoints: d.storyPoints ?? "",
  estimatedHours: d.estimatedHours ?? "",
  remainingHours: d.remainingHours ?? "",
  startDate: d.startDate || "",
  dueDate: d.dueDate || "",
  description: d.description || "",
  acceptanceCriteria: d.acceptanceCriteria || "",
  tags: (d.tags || []).join(", "),
  isBlocked: !!d.isBlocked,
  blockedReason: d.blockedReason || "",
});

function actLine(a) {
  if (a.action === "COMMENT") return null;
  if (a.action === "ASSIGNED") return a.oldValue ? <>reassigned <b>{a.oldValue}</b> → <b>{a.newValue}</b></> : <>assigned <b>{a.newValue}</b></>;
  if (["STATUS", "SPRINT", "PARENT"].includes(a.action)) return <>{ACT[a.action]} <b>{a.oldValue || "—"}</b> → <b>{a.newValue || "—"}</b></>;
  if (a.action === "UPDATED" && a.oldValue) return <>changed <b>{a.oldValue}</b>{a.newValue ? <> → <b>{a.newValue}</b></> : null}</>;
  return ACT[a.action] || a.action;
}

export function TypeBadge({ type, className = "" }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap ${TYPE_STYLE[type]?.badge} ${className}`}>{typeLabel(type)}</span>;
}

/**
 * Right-hand panel for one work item (Azure Boards style).
 *   itemId → edit · draft = { workItemType, parentId?, sprintId? } → create
 */
export default function WorkItemSheet({ open, itemId, draft, projectCode, projectLabel, sprints = [], onClose, onSaved, onOpenItem }) {
  const isNew = !itemId;
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(toForm(draft || {}));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [parents, setParents] = useState([]);
  const [tab, setTab] = useState("children");
  const [confirm, setConfirm] = useState(null);

  const type = form.workItemType;
  const isTask = type === "Task";
  const readOnly = !isNew && item && !item.canEdit;

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const r = await workItemApi.get(itemId);
      setItem(r?.data || null);
      setForm(toForm(r?.data || {}));
    } catch (e) {
      toast.error(e?.message || "Could not load the work item");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [itemId, onClose]);

  useEffect(() => {
    if (!open) return;
    setTab("children");
    if (itemId) load();
    else { setItem(null); setForm(toForm({ state: WI_STATES[draft?.workItemType || "PBI"][0], ...(draft || {}) })); }
  }, [open, itemId, draft, load]);

  // assignees + parent candidates depend on the type
  const pc = projectCode && projectCode !== "company" ? projectCode : undefined;
  useEffect(() => {
    if (!open) return;
    workItemApi.assignable(pc || "company", type).then((r) => setUsers(r?.data || [])).catch(() => setUsers([]));
    const pt = PARENT_TYPES[type] || [];
    if (!pt.length) { setParents([]); return; }
    workItemApi.list({ projectCode: projectCode || "company", type: pt.join(","), limit: 500 })
      .then((r) => setParents((r?.data?.items || []).filter((p) => !["Done", "Removed"].includes(p.state) || String(p.id) === form.parentId)))
      .catch(() => setParents([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, projectCode]);

  const userOptions = useMemo(() => users.map((u) => ({ value: String(u.id), label: u.empCode ? `${u.name} (${u.empCode})` : u.name })), [users]);
  const parentOptions = useMemo(() => parents.map((p) => ({ value: String(p.id), label: `${p.taskCode} · ${p.title}` })), [parents]);
  const sprintOptions = useMemo(() => sprints.filter((s) => s.status !== "Closed" || String(s.id) === form.sprintId)
    .map((s) => ({ value: String(s.id), label: `${s.name} · ${s.status}` })), [sprints, form.sprintId]);

  const set = (k) => (e) => {
    const v = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [k]: v ?? "" }));
  };

  const payload = () => {
    const p = {
      title: form.title.trim(), priority: form.priority, description: form.description || null,
      startDate: form.startDate || null, dueDate: form.dueDate || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      parentId: form.parentId ? Number(form.parentId) : null,
      isBlocked: form.isBlocked, blockedReason: form.isBlocked ? form.blockedReason : null,
      estimatedHours: form.estimatedHours === "" ? null : Number(form.estimatedHours),
    };
    if (SPRINT_TYPES_OK.includes(type)) p.sprintId = form.sprintId ? Number(form.sprintId) : "backlog";
    if (POINT_TYPES.includes(type)) {
      p.storyPoints = form.storyPoints === "" ? null : Number(form.storyPoints);
      p.acceptanceCriteria = form.acceptanceCriteria || null;
    }
    if (isTask) p.remainingHours = form.remainingHours === "" ? null : Number(form.remainingHours);
    if (form.assignedTo) p.assignedTo = Number(form.assignedTo);
    return p;
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      if (isNew) {
        const body = { ...payload(), workItemType: type, projectCode: pc || null };
        if (body.sprintId === "backlog") delete body.sprintId;
        if (!body.parentId) delete body.parentId;
        const r = await workItemApi.create(body);
        toast.success(`${r?.data?.taskCode} created`);
        onSaved?.(r?.data);
        onClose?.();
      } else {
        const body = payload();
        if (item.workItemType !== type) body.workItemType = type;
        if (form.state && form.state !== item.state) body.state = form.state;
        const r = await workItemApi.update(item.id, body);
        toast.success("Saved");
        setItem((x) => ({ ...x, ...r?.data }));
        onSaved?.(r?.data);
        load();
      }
    } catch (e) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => setConfirm({
    title: `Delete ${item.taskCode}?`,
    description: "The work item is removed from the backlog and boards.",
    confirmLabel: "Delete", variant: "destructive",
    onConfirm: async () => {
      try { await workItemApi.remove(item.id); toast.success("Deleted"); onSaved?.(null); onClose?.(); }
      catch (e) { toast.error(e?.message || "Could not delete"); }
    },
  });

  if (!open) return null;
  const typeOptions = isNew ? WI_TYPES : (["PBI", "Bug"].includes(item?.workItemType) ? ["PBI", "Bug"] : [item?.workItemType || type]);
  const states = WI_STATES[type] || [];

  return (
    <div className="fixed inset-0 z-[9994] flex justify-end" role="dialog" data-state="open" aria-modal="true" aria-label="Work item">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className={`relative h-full w-full max-w-[620px] bg-white shadow-2xl flex flex-col border-l-4 ${TYPE_STYLE[type]?.bar} animate-in slide-in-from-right duration-200`}>
        {/* header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#c4d1df] bg-gradient-to-b from-[#f4f4f4] to-[#e3e3e3]">
          <div className="min-w-0 flex items-center gap-2">
            <TypeBadge type={type} />
            <span className="text-[11px] font-semibold text-gray-500">{isNew ? `New ${typeLabel(type)}` : item?.taskCode || "…"}</span>
            {item?.isBlocked && <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-600 font-semibold inline-flex items-center gap-1"><Ban size={10} /> Blocked</span>}
            <span className="text-[11px] text-gray-500 truncate">· {projectLabel || "Company"}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isNew && item?.canDelete && (
              <button onClick={remove} title="Delete" aria-label="Delete work item"
                className="w-8 h-8 rounded-md flex items-center justify-center text-red-600 hover:bg-white"><Trash2 size={15} /></button>
            )}
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-white"><X size={16} /></button>
          </div>
        </div>

        {loading && !item ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : (
          <form className="flex-1 overflow-y-auto" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="p-4 space-y-3">
              <input value={form.title} onChange={set("title")} maxLength={200} disabled={readOnly} autoFocus={isNew}
                placeholder={`${typeLabel(type)} title`} aria-label="Title"
                className="w-full text-base font-semibold text-gray-800 border border-transparent hover:border-gray-300 focus:border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />

              {readOnly && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                {item?.isLocked ? "This task is Done and locked — reopen it from Self Task." : "You can view this item but not edit it."}
              </p>}

              <div className="grid grid-cols-3 gap-3">
                <Field label="Type">
                  <select value={type} onChange={set("workItemType")} disabled={readOnly || typeOptions.length < 2} className={inputCls}>
                    {typeOptions.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
                  </select>
                </Field>
                <Field label="State">
                  <select value={form.state} onChange={set("state")} disabled={readOnly || isNew} className={inputCls}>
                    {states.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select value={form.priority} onChange={set("priority")} disabled={readOnly} className={inputCls}>
                    {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Assigned to">
                  <SearchableSelect options={userOptions} value={form.assignedTo} onChange={set("assignedTo")} disabled={readOnly}
                    placeholder="Me" />
                </Field>
                <Field label={`Parent${PARENT_TYPES[type]?.length ? ` (${PARENT_TYPES[type].map(typeLabel).join(" / ")})` : ""}`}>
                  {PARENT_TYPES[type]?.length ? (
                    <SearchableSelect options={parentOptions} value={form.parentId} onChange={set("parentId")} disabled={readOnly}
                      placeholder="No parent" clearLabel="No parent" />
                  ) : <p className="text-xs text-gray-400 py-2">A Phase is the top level</p>}
                </Field>
              </div>

              {/* planning */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-3">
                <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Planning</p>
                <div className="grid grid-cols-3 gap-3">
                  {SPRINT_TYPES_OK.includes(type) ? (
                    <Field label="Sprint" className="col-span-1">
                      <SearchableSelect options={sprintOptions} value={form.sprintId} onChange={set("sprintId")} disabled={readOnly}
                        placeholder="Backlog" clearLabel="Backlog" />
                    </Field>
                  ) : <Field label="Sprint"><p className="text-xs text-gray-400 py-2">Plan its Activities instead</p></Field>}
                  {POINT_TYPES.includes(type) && (
                    <Field label="Effort points">
                      <input type="number" min="0" step="0.5" value={form.storyPoints} onChange={set("storyPoints")} disabled={readOnly} className={inputCls} />
                    </Field>
                  )}
                  {isTask && (
                    <>
                      <Field label="Estimate (h)">
                        <input type="number" min="0" step="0.25" value={form.estimatedHours} onChange={set("estimatedHours")} disabled={readOnly} className={inputCls} />
                      </Field>
                      <Field label="Remaining (h)">
                        <input type="number" min="0" step="0.25" value={form.remainingHours} onChange={set("remainingHours")} disabled={readOnly} className={inputCls}
                          placeholder={form.estimatedHours ? `= ${form.estimatedHours}` : ""} />
                      </Field>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date"><input type="date" value={form.startDate} onChange={set("startDate")} disabled={readOnly} className={inputCls} /></Field>
                  <Field label="Target date"><input type="date" value={form.dueDate} onChange={set("dueDate")} disabled={readOnly} className={inputCls} /></Field>
                </div>
              </div>

              <Field label="Description">
                <textarea rows={3} value={form.description} onChange={set("description")} disabled={readOnly} className={inputCls} />
              </Field>
              {POINT_TYPES.includes(type) && (
                <Field label="Acceptance criteria">
                  <textarea rows={3} value={form.acceptanceCriteria} onChange={set("acceptanceCriteria")} disabled={readOnly}
                    className={inputCls} placeholder="Done when…" />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tags (comma separated)">
                  <input value={form.tags} onChange={set("tags")} disabled={readOnly} className={inputCls} placeholder="drawing, client" />
                </Field>
                <Field label="Blocked">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 py-2">
                    <input type="checkbox" checked={form.isBlocked} onChange={set("isBlocked")} disabled={readOnly} className="accent-red-600" /> Work is blocked
                  </label>
                </Field>
              </div>
              {form.isBlocked && (
                <Field label="Blocked because">
                  <input value={form.blockedReason} onChange={set("blockedReason")} disabled={readOnly} className={inputCls} placeholder="Waiting for…" />
                </Field>
              )}

              {!readOnly && (
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
                  <button type="submit" data-shortcut="submit" disabled={saving} className={btnPrimary}>
                    {saving && <Loader2 size={14} className="animate-spin" />}{isNew ? `Create ${typeLabel(type)}` : "Save"}
                  </button>
                </div>
              )}
            </div>

            {!isNew && item && (
              <div className="border-t border-gray-200">
                <div className="flex px-4" role="tablist">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 inline-flex items-center gap-1.5 ${tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                      <Icon size={14} /> {label}
                      {id === "children" && item.children?.length > 0 && <span className="text-[10px] bg-gray-100 rounded-full px-1.5">{item.children.length}</span>}
                      {id === "links" && item.links?.length > 0 && <span className="text-[10px] bg-gray-100 rounded-full px-1.5">{item.links.length}</span>}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  {tab === "children" && <ChildrenTab item={item} onOpenItem={onOpenItem} />}
                  {tab === "links" && <LinksTab item={item} projectCode={projectCode} canEdit={item.canEdit} onChanged={load} onOpenItem={onOpenItem} />}
                  {tab === "discussion" && <DiscussionTab item={item} users={users} onChanged={load} />}
                </div>
              </div>
            )}
          </form>
        )}
      </aside>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function ItemRow({ w, onOpenItem, extra }) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <TypeBadge type={w.workItemType} />
      <button type="button" onClick={() => onOpenItem?.(w.id)} className="text-left text-sm text-gray-800 hover:text-blue-700 hover:underline truncate flex-1">
        <span className="text-[11px] text-gray-500 font-semibold mr-1.5">{w.code}</span>{w.title}
      </button>
      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATE_STYLE[w.state] || STATE_STYLE.New}`}>{w.state}</span>
      {extra}
    </li>
  );
}

function ChildrenTab({ item, onOpenItem }) {
  const childType = CHILD_TYPE[item.workItemType];
  return (
    <div className="space-y-3">
      {item.parent && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Parent</p>
          <ul><ItemRow w={item.parent} onOpenItem={onOpenItem} /></ul>
        </div>
      )}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Children</p>
        {item.children?.length
          ? <ul className="divide-y divide-gray-100">{item.children.map((c) => <ItemRow key={c.id} w={c} onOpenItem={onOpenItem} />)}</ul>
          : <p className="text-xs text-gray-400">{childType ? `No ${typePlural(childType)} yet.` : "A task has no children."}</p>}
      </div>
      {childType && item.canEdit && (
        <button type="button" onClick={() => onOpenItem?.(null, { workItemType: childType, parentId: item.id, sprintId: childType === "Task" ? item.sprintId : undefined })}
          className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"><Plus size={14} /> Add {typeLabel(childType)}</button>
      )}
    </div>
  );
}

function LinksTab({ item, projectCode, canEdit, onChanged, onOpenItem }) {
  const [kind, setKind] = useState("WORK_ITEM");
  const [linkType, setLinkType] = useState("related");
  const [target, setTarget] = useState("");
  const [ref, setRef] = useState("");
  const [options, setOptions] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTarget("");
    if (kind === "WORK_ITEM") {
      workItemApi.list({ projectCode: projectCode || "company", limit: 500 })
        .then((r) => setOptions((r?.data?.items || []).filter((w) => w.id !== item.id)
          .map((w) => ({ value: String(w.id), label: `${w.taskCode} · ${w.title}` })))).catch(() => setOptions([]));
    } else if (kind === "FOLLOWUP") {
      followupApi.list({ scope: "involved", perPage: 300 })
        .then((r) => setOptions((r?.data?.items || []).map((f) => ({ value: String(f.id), label: `${f.fuCode} · ${f.title}` })))).catch(() => setOptions([]));
    }
  }, [kind, projectCode, item.id]);

  const add = async () => {
    const body = { targetType: kind, linkType: kind === "WORK_ITEM" ? linkType : "related" };
    if (kind === "ERP_DOC") { if (!ref.trim()) return toast.error("Type the document reference"); body.targetRef = ref.trim(); }
    else { if (!target) return toast.error("Pick what to link"); body.targetId = Number(target); }
    setBusy(true);
    try { await workItemApi.addLink(item.id, body); toast.success("Link added"); setTarget(""); setRef(""); onChanged?.(); }
    catch (e) { toast.error(e?.message || "Could not link"); }
    finally { setBusy(false); }
  };
  const remove = async (l) => {
    try { await workItemApi.removeLink(item.id, l.id); onChanged?.(); } catch (e) { toast.error(e?.message || "Could not remove"); }
  };

  return (
    <div className="space-y-3">
      {item.links?.length ? (
        <ul className="divide-y divide-gray-100">
          {item.links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="text-[10px] uppercase font-semibold text-gray-500 w-20 shrink-0">{l.targetType === "FOLLOWUP" ? "Follow-up" : l.targetType === "ERP_DOC" ? "Document" : l.linkType}</span>
              {l.targetType === "WORK_ITEM" && l.target ? (
                <button type="button" onClick={() => onOpenItem?.(l.target.id)} className="flex-1 text-left truncate hover:text-blue-700 hover:underline">
                  <TypeBadge type={l.target.workItemType} className="mr-1.5" /><span className="text-[11px] text-gray-500 font-semibold mr-1">{l.target.code}</span>{l.target.title}
                </button>
              ) : l.targetType === "FOLLOWUP" && l.target ? (
                <a href={`/task-management/task-tracker?agenda=${l.target.uuid}`} className="flex-1 truncate hover:text-blue-700 hover:underline inline-flex items-center gap-1">
                  <span className="text-[11px] text-gray-500 font-semibold">{l.target.code}</span> {l.target.title} <ExternalLink size={11} />
                </a>
              ) : <span className="flex-1 truncate text-gray-700">{l.target?.ref || l.targetRef || "(removed)"}</span>}
              {canEdit && <button type="button" onClick={() => remove(l)} aria-label="Remove link" className="p-1 text-gray-400 hover:text-red-600"><X size={14} /></button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-gray-400">No links yet.</p>}

      {canEdit && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls} aria-label="Link to">
              <option value="WORK_ITEM">Work item</option>
              <option value="FOLLOWUP">Follow-up</option>
              <option value="ERP_DOC">ERP document</option>
            </select>
            {kind === "WORK_ITEM" ? (
              <select value={linkType} onChange={(e) => setLinkType(e.target.value)} className={inputCls} aria-label="Link type">
                <option value="related">Related</option>
                <option value="predecessor">Predecessor (comes before)</option>
                <option value="successor">Successor (comes after)</option>
              </select>
            ) : <span />}
          </div>
          {kind === "ERP_DOC"
            ? <input value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} placeholder="e.g. SO:SO-2026-00012 or BRR:BRR-0045" />
            : <SearchableSelect options={options} value={target} onChange={(v) => setTarget(v || "")} placeholder={kind === "FOLLOWUP" ? "Pick a follow-up" : "Pick a work item"} />}
          <button type="button" onClick={add} disabled={busy} className={btnSecondary}>{busy && <Loader2 size={14} className="animate-spin" />}<Link2 size={14} /> Add link</button>
        </div>
      )}
    </div>
  );
}

function DiscussionTab({ item, users, onChanged }) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState([]);
  const [busy, setBusy] = useState(false);
  const options = users.filter((u) => !mentions.includes(u.id)).map((u) => ({ value: String(u.id), label: u.name }));

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await workItemApi.comment(item.id, text.trim(), mentions);
      const n = r?.data?.mentioned?.length || 0;
      toast.success(n ? `Comment added · ${n} person(s) mentioned` : "Comment added");
      setText(""); setMentions([]); onChanged?.();
    } catch (e) { toast.error(e?.message || "Could not comment"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder="Add a comment…"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
        <div className="flex flex-wrap items-center gap-2">
          <AtSign size={14} className="text-gray-400" />
          {mentions.map((id) => {
            const u = users.find((x) => x.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-1 pr-2 py-0.5">
                <UserAvatar id={id} name={u?.name} size={16} /> {u?.name}
                <button type="button" onClick={() => setMentions((m) => m.filter((x) => x !== id))} aria-label={`Remove ${u?.name}`}><X size={11} /></button>
              </span>
            );
          })}
          <div className="w-44">
            <SearchableSelect options={options} value="" onChange={(v) => v && setMentions((m) => [...m, Number(v)])} placeholder="Mention someone" />
          </div>
          <div className="flex-1" />
          <button type="button" onClick={send} disabled={busy || !text.trim()} className={btnPrimary}>{busy && <Loader2 size={14} className="animate-spin" />}Comment</button>
        </div>
      </div>
      <ul className="space-y-2.5">
        {(item.activity || []).map((a) => (
          <li key={a.id} className="flex gap-2">
            <UserAvatar id={a.userId} name={a.userName} size={24} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-600"><b className="text-gray-800">{a.userName || "System"}</b> {actLine(a)} <span className="text-gray-400">· {fmtDateTime(a.createdAt)}</span></p>
              {a.comment && <p className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 mt-1 whitespace-pre-wrap break-words">{a.comment}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

