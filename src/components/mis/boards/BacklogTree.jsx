"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, GripVertical, Plus, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/common/SearchableSelect";
import { UserAvatar, btnSecondary } from "@/components/mis/MisModal";
import { TASK_PRIORITIES } from "@/lib/misTasks";
import { workItemApi, flattenTree, PARENT_TYPES, CHILD_TYPE, SPRINT_TYPES_OK, POINT_TYPES, TYPE_STYLE, STATE_STYLE } from "@/lib/misBoards";
import { TypeBadge } from "./WorkItemSheet";

export const WI_DRAG = "text/wi-id";

/**
 * Azure-style backlog grid: a tree (Epic › Feature › PBI/Bug › Task) with
 *   · drag a row above / below a sibling → reorder (backlog rank)
 *   · drag a row onto the middle of a valid parent → re-parent
 *   · drag a row onto a sprint in the planning pane (handled by the parent via WI_DRAG)
 *   · checkboxes + bulk bar (sprint / assignee / priority)
 */
export default function BacklogTree({
  roots, loading, onOpen, onAddChild, sprints = [], users = [], dragging, setDragging, onChanged, compact = false, emptyText,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [drop, setDrop] = useState(null);           // { id, zone: "before" | "after" | "into" }
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const rows = useMemo(() => flattenTree(roots || [], collapsed), [roots, collapsed]);
  const byId = useMemo(() => {
    const m = new Map();
    const walk = (ns) => ns.forEach((n) => { m.set(n.id, n); n.children?.length && walk(n.children); });
    walk(roots || []);
    return m;
  }, [roots]);

  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const expandAll = () => setCollapsed(new Set());
  const collapseTo = (keepTypes) => setCollapsed(new Set([...byId.values()].filter((n) => !keepTypes.includes(n.workItemType)).map((n) => n.id)));
  const sel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── drag & drop ──
  const zoneFor = (e, target) => {
    const src = byId.get(dragging);
    if (!src || src.id === target.id) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    const sibling = (src.parentId || null) === (target.parentId || null);
    const canParent = (PARENT_TYPES[src.workItemType] || []).includes(target.workItemType) && src.parentId !== target.id;
    if (sibling && y < 0.35) return "before";
    if (sibling && y > 0.65) return "after";
    if (canParent) return "into";
    if (sibling) return y < 0.5 ? "before" : "after";
    return null;
  };
  const onDragOver = (target) => (e) => {
    if (!dragging) return;
    const z = zoneFor(e, target);
    if (!z) { setDrop(null); return; }
    e.preventDefault();
    if (drop?.id !== target.id || drop?.zone !== z) setDrop({ id: target.id, zone: z });
  };
  const onDrop = (target) => async (e) => {
    e.preventDefault();
    const z = drop?.id === target.id ? drop.zone : null;
    setDrop(null);
    const id = Number(e.dataTransfer.getData(WI_DRAG) || dragging);
    setDragging?.(null);
    const src = byId.get(id);
    if (!src || !z) return;
    try {
      if (z === "into") {
        await workItemApi.update(src.id, { parentId: target.id });
        toast.success(`${src.taskCode} moved under ${target.taskCode}`);
      } else {
        await workItemApi.reorder(src.id, z === "before" ? { beforeId: target.id } : { afterId: target.id });
      }
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Could not move");
    }
  };

  // ── bulk ──
  const bulk = async (changes, label) => {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      await workItemApi.bulk([...selected], changes);
      toast.success(`${selected.size} item(s) ${label}`);
      setSelected(new Set());
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || "Bulk change failed");
    } finally {
      setBulkBusy(false);
    }
  };
  const sprintOpts = [{ value: "backlog", label: "Backlog (no sprint)" },
    ...sprints.filter((s) => s.status !== "Closed").map((s) => ({ value: String(s.id), label: `${s.name} · ${s.status}` }))];
  const userOpts = users.map((u) => ({ value: String(u.id), label: u.name }));
  const selectedPlannable = [...selected].every((id) => SPRINT_TYPES_OK.includes(byId.get(id)?.workItemType));

  if (loading && !rows.length) {
    return <div className="py-10 flex justify-center text-gray-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  }
  if (!rows.length) {
    return <p className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">{emptyText || "Nothing on the backlog yet."}</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50/70 text-xs">
        {selected.size > 0 ? (
          <>
            <span className="font-semibold text-gray-700">{selected.size} selected</span>
            {selectedPlannable && (
              <div className="w-52"><SearchableSelect options={sprintOpts} value="" placeholder="Move to sprint…" disabled={bulkBusy}
                onChange={(v) => v && bulk({ sprintId: v === "backlog" ? "backlog" : Number(v) }, "moved")} /></div>
            )}
            <div className="w-44"><SearchableSelect options={userOpts} value="" placeholder="Assign to…" disabled={bulkBusy}
              onChange={(v) => v && bulk({ assignedTo: Number(v) }, "assigned")} /></div>
            <select defaultValue="" disabled={bulkBusy} onChange={(e) => { const v = e.target.value; e.target.value = ""; v && bulk({ priority: v }, "updated"); }}
              className="border border-gray-300 rounded-md px-2 py-1.5 bg-white" aria-label="Set priority">
              <option value="" disabled>Priority…</option>
              {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:underline">Clear</button>
            {bulkBusy && <Loader2 size={14} className="animate-spin text-gray-500" />}
          </>
        ) : (
          <>
            <span className="text-gray-500">Show:</span>
            <button onClick={() => collapseTo([])} className="px-2 py-1 rounded hover:bg-white border border-transparent hover:border-gray-200">Epics</button>
            <button onClick={() => collapseTo(["Epic"])} className="px-2 py-1 rounded hover:bg-white border border-transparent hover:border-gray-200">Features</button>
            <button onClick={() => collapseTo(["Epic", "Feature"])} className="px-2 py-1 rounded hover:bg-white border border-transparent hover:border-gray-200">PBIs</button>
            <button onClick={expandAll} className="px-2 py-1 rounded hover:bg-white border border-transparent hover:border-gray-200">Everything</button>
            <span className="flex-1" />
            {!compact && <span className="text-gray-400">Drag ⠿ to reorder · drop on a parent to move under it · drop on a sprint to plan</span>}
          </>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              <th className="w-8 px-2 py-2" />
              <th className="px-2 py-2 text-left">Title</th>
              <th className="px-2 py-2 text-left w-28">State</th>
              <th className="px-2 py-2 text-left w-40">Assigned</th>
              <th className="px-2 py-2 text-right w-20" title="Story points (PBI/Bug) · remaining hours (Task)">Effort</th>
              {!compact && <th className="px-2 py-2 text-left w-36">Sprint</th>}
              <th className="px-2 py-2 text-left">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const hasKids = r.children?.length > 0;
              const z = drop?.id === r.id ? drop.zone : null;
              const childType = CHILD_TYPE[r.workItemType];
              const effort = POINT_TYPES.includes(r.workItemType) ? (r.storyPoints != null ? `${r.storyPoints} pt` : "")
                : r.workItemType === "Task" ? (r.remainingHours != null ? `${r.remainingHours} h` : "") : "";
              return (
                <tr key={r.id}
                  draggable={r.canEdit}
                  onDragStart={(e) => { e.dataTransfer.setData(WI_DRAG, String(r.id)); e.dataTransfer.effectAllowed = "move"; setDragging?.(r.id); }}
                  onDragEnd={() => { setDragging?.(null); setDrop(null); }}
                  onDragOver={onDragOver(r)} onDragLeave={() => setDrop((d) => (d?.id === r.id ? null : d))} onDrop={onDrop(r)}
                  className={`group ${dragging === r.id ? "opacity-40" : ""} ${z === "into" ? "bg-blue-50 outline outline-2 outline-blue-400 -outline-offset-2" : "hover:bg-blue-50/40"}
                    ${z === "before" ? "shadow-[inset_0_2px_0_0_#3b82f6]" : ""} ${z === "after" ? "shadow-[inset_0_-2px_0_0_#3b82f6]" : ""}
                    ${["Done", "Removed", "Cancelled"].includes(r.state) ? "text-gray-400" : ""}`}>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => sel(r.id)} aria-label={`Select ${r.taskCode}`} className="accent-blue-600" disabled={!r.canEdit} />
                      {r.canEdit && <GripVertical size={14} className="text-gray-300 group-hover:text-gray-500 cursor-grab" aria-hidden />}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 max-w-[520px]">
                    <div className="flex items-center gap-1.5 min-w-0" style={{ paddingLeft: r.depth * 18 }}>
                      {hasKids ? (
                        <button onClick={() => toggle(r.id)} aria-label={collapsed.has(r.id) ? "Expand" : "Collapse"} aria-expanded={!collapsed.has(r.id)}
                          className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 shrink-0">
                          {collapsed.has(r.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                      ) : <span className="w-5 shrink-0" />}
                      <span className={`w-1 h-4 rounded-full shrink-0 ${TYPE_STYLE[r.workItemType]?.dot}`} aria-hidden />
                      <TypeBadge type={r.workItemType} />
                      <button onClick={() => onOpen(r.id)} className="text-left truncate hover:text-blue-700 hover:underline min-w-0">
                        <span className="text-[11px] text-gray-500 font-semibold mr-1.5">{r.taskCode}</span>
                        <span className={["Done", "Removed", "Cancelled"].includes(r.state) ? "line-through" : "text-gray-800 font-medium"}>{r.title}</span>
                      </button>
                      {r.isBlocked && <Ban size={13} className="text-red-500 shrink-0" title={r.blockedReason || "Blocked"} />}
                      {childType && r.canEdit && (
                        <button onClick={() => onAddChild(r, childType)} title={`Add ${childType}`} aria-label={`Add ${childType} under ${r.taskCode}`}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-5 h-5 rounded flex items-center justify-center text-blue-600 hover:bg-blue-100 shrink-0">
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${STATE_STYLE[r.state] || STATE_STYLE.New}`}>{r.state}</span></td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5 min-w-0"><UserAvatar id={r.ownerUserId} name={r.ownerName} size={20} /><span className="text-xs text-gray-700 truncate">{r.ownerName}</span></span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">{effort}</td>
                  {!compact && <td className="px-2 py-1.5 text-xs text-gray-600 truncate max-w-[150px]">{r.sprintName || (SPRINT_TYPES_OK.includes(r.workItemType) ? <span className="text-gray-400">Backlog</span> : "")}</td>}
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">{(r.tags || []).slice(0, 3).map((t) => <span key={t} className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5">{t}</span>)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NewItemButtons({ onNew, types = ["Epic", "Feature", "PBI", "Bug", "Task"] }) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden bg-white" role="group" aria-label="New work item">
      <span className="px-2.5 py-2 text-sm text-gray-500 border-r border-gray-200 inline-flex items-center gap-1"><Plus size={14} /> New</span>
      {types.map((t) => (
        <button key={t} onClick={() => onNew(t)} className={`${btnSecondary.replace("rounded-md border border-gray-300", "")} rounded-none border-r last:border-r-0 border-gray-200 px-3`}>
          <span className={`w-2 h-2 rounded-full ${TYPE_STYLE[t].dot}`} /> {t}
        </button>
      ))}
    </div>
  );
}
