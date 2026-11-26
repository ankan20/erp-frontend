"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings2, Loader2, Ban, ChevronDown, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { MisModal, Field, inputCls, btnPrimary, btnSecondary, UserAvatar } from "@/components/mis/MisModal";
import { PRIORITY_STRIPE } from "@/lib/misTasks";
import { workItemApi, KANBAN_LEVELS, WI_STATES, TYPE_STYLE, typeLabel } from "@/lib/misBoards";
import { TypeBadge } from "./WorkItemSheet";

const DRAG = "text/kb-card";
const LEVEL_TYPE = { PBI: "PBI", Feature: "Feature", Epic: "Epic" };

function Card({ c, onOpen, dragging, setDragging }) {
  const p = c.childProgress || { done: 0, total: 0 };
  return (
    <article draggable={c.canEdit}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG, String(c.id)); e.dataTransfer.effectAllowed = "move"; setDragging(c.id); }}
      onDragEnd={() => setDragging(null)}
      onClick={() => onOpen(c.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(c.id)} tabIndex={0}
      aria-label={`${c.taskCode} ${c.title}`}
      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${TYPE_STYLE[c.workItemType]?.bar} p-2 shadow-sm cursor-pointer hover:shadow-md transition
        ${dragging === c.id ? "opacity-40" : ""} ${c.isBlocked ? "ring-1 ring-red-300" : ""}`}>
      <div className="flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5 min-w-0">
          {c.workItemType === "Bug" && <TypeBadge type="Bug" />}
          <span className="text-[10px] text-gray-500 font-semibold">{c.taskCode}</span>
        </span>
        <span className="flex items-center gap-1">
          {c.isBlocked && <Ban size={12} className="text-red-500" title={c.blockedReason || "Blocked"} />}
          {c.storyPoints != null && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded px-1">{c.storyPoints} pt</span>}
        </span>
      </div>
      <p className="text-[13px] text-gray-800 font-medium leading-snug break-words mt-0.5">{c.title}</p>
      {p.total > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5" title={`${p.done} of ${p.total} child items done`}>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(100 * p.done) / p.total}%` }} /></div>
          <span className="text-[10px] text-gray-500">{p.done}/{p.total}</span>
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 min-w-0">
          <UserAvatar id={c.ownerUserId} name={c.ownerName} size={18} />
          <span className="text-[10px] text-gray-600 truncate">{c.ownerName}</span>
        </span>
        <span className={`w-1.5 h-4 rounded-sm border-l-4 ${PRIORITY_STRIPE[c.priority]}`} title={`${c.priority} priority`} />
      </div>
      {(c.tags || []).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">{c.tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5">{t}</span>)}</div>
      )}
    </article>
  );
}

/** Backlog-level Kanban (Azure "Boards"): custom columns → states, WIP limits, Doing/Done split, swimlanes. */
export default function KanbanBoard({ projectCode, onOpen, refreshKey, onNew }) {
  const [level, setLevel] = useState("PBI");
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [settings, setSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await workItemApi.kanban(projectCode || "company", level);
      setBoard(r?.data || null);
    } catch (e) {
      setBoard(null);
      toast.error(e?.message || "Could not load the board");
    } finally {
      setLoading(false);
    }
  }, [projectCode, level]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const lanes = useMemo(() => ["", ...(board?.swimlanes || [])], [board]);
  const counts = useMemo(() => {
    const m = {};
    (board?.cards || []).forEach((c) => { m[c.column] = (m[c.column] || 0) + 1; });
    return m;
  }, [board]);

  const drop = (column, done, lane) => async (e) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData(DRAG) || dragging);
    setDragging(null);
    const c = board?.cards.find((x) => x.id === id);
    if (!c || (c.column === column && !!c.columnDone === !!done && c.lane === lane)) return;
    // optimistic move, then confirm
    setBoard((b) => ({ ...b, cards: b.cards.map((x) => (x.id === id ? { ...x, column, columnDone: !!done, lane } : x)) }));
    try {
      const r = await workItemApi.boardMove(id, { column, done: !!done, lane });
      if (r?.data?.warning) toast.warning(r.data.warning); else toast.success(`${c.taskCode} → ${column}${done ? " · Done" : ""}`);
    } catch (err) {
      toast.error(err?.message || "Move not allowed");
    }
    load();
  };

  const zone = (column, done, lane) => ({
    onDragOver: (e) => { if (dragging) { e.preventDefault(); const k = `${column}|${done ? 1 : 0}|${lane}`; if (over !== k) setOver(k); } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); },
    onDrop: drop(column, done, lane),
  });
  const isOver = (column, done, lane) => over === `${column}|${done ? 1 : 0}|${lane}`;

  const cols = board?.columns || [];
  const template = cols.map((c) => (c.split ? "minmax(300px,2fr)" : "minmax(200px,1fr)")).join(" ");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-gray-300 overflow-hidden" role="radiogroup" aria-label="Backlog level">
          {KANBAN_LEVELS.map((l) => (
            <button key={l.id} role="radio" aria-checked={level === l.id} onClick={() => setLevel(l.id)}
              className={`px-3 py-1.5 text-sm ${level === l.id ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>{l.label}</button>
          ))}
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        <span className="flex-1" />
        <span className="text-[11px] text-gray-500">Done shows the last {board?.doneDays ?? 30} days</span>
        <button onClick={() => onNew?.(LEVEL_TYPE[level])} className={btnSecondary}><Plus size={14} /> New {typeLabel(LEVEL_TYPE[level])}</button>
        {board?.canEdit && <button onClick={() => setSettings(true)} className={btnSecondary}><Settings2 size={14} /> Board settings</button>}
      </div>

      {board && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <div className="min-w-max">
            {/* column headers */}
            <div className="grid border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: template }}>
              {cols.map((c) => {
                const n = counts[c.name] || 0;
                const overWip = c.wip > 0 && n > c.wip;
                return (
                  <div key={c.name} className="border-l first:border-l-0 border-gray-200">
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide truncate" title={`State: ${c.state}`}>{c.name}</span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 border ${overWip ? "bg-red-50 text-red-600 border-red-200" : "bg-white text-gray-500 border-gray-200"}`}
                        title={c.wip ? `WIP limit ${c.wip}` : "No WIP limit"}>
                        {overWip && <AlertTriangle size={10} className="inline -mt-0.5 mr-0.5" />}{n}{c.wip ? ` / ${c.wip}` : ""}
                      </span>
                    </div>
                    {c.split && (
                      <div className="grid grid-cols-2 border-t border-gray-200 text-[10px] font-semibold text-gray-500 uppercase">
                        <span className="px-3 py-1">Doing</span><span className="px-3 py-1 border-l border-dashed border-gray-300">Done</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* lanes */}
            {lanes.map((lane) => {
              const laneCards = board.cards.filter((x) => x.lane === lane);
              const isCol = collapsed.has(lane);
              return (
                <div key={lane || "default"} className="border-b border-gray-100 last:border-b-0">
                  {lanes.length > 1 && (
                    <button onClick={() => setCollapsed((s) => { const n = new Set(s); n.has(lane) ? n.delete(lane) : n.add(lane); return n; })}
                      aria-expanded={!isCol}
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/70 text-xs font-semibold text-gray-700 hover:bg-gray-100 text-left">
                      {isCol ? <ChevronRight size={13} /> : <ChevronDown size={13} />} {lane || "Default lane"} <span className="font-normal text-gray-500">({laneCards.length})</span>
                    </button>
                  )}
                  {!isCol && (
                    <div className="grid" style={{ gridTemplateColumns: template }}>
                      {cols.map((c) => {
                        const inCol = laneCards.filter((x) => x.column === c.name);
                        const halves = c.split ? [false, true] : [false];
                        return (
                          <div key={c.name} className={`border-l first:border-l-0 border-gray-100 grid ${c.split ? "grid-cols-2" : "grid-cols-1"}`}>
                            {halves.map((done) => (
                              <div key={String(done)} {...zone(c.name, done, lane)} aria-label={`${c.name}${c.split ? (done ? " done" : " doing") : ""}${lane ? ` · ${lane}` : ""}`}
                                className={`p-1.5 space-y-1.5 min-h-[120px] ${done ? "border-l border-dashed border-gray-200 bg-gray-50/40" : ""}
                                  ${isOver(c.name, done, lane) ? "bg-blue-50 outline outline-2 outline-blue-300 -outline-offset-2" : ""}`}>
                                {inCol.filter((x) => !!x.columnDone === done).map((x) => (
                                  <Card key={x.id} c={x} onOpen={onOpen} dragging={dragging} setDragging={setDragging} />
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BoardSettingsDialog open={settings} onClose={() => setSettings(false)} board={board} level={level}
        projectCode={projectCode} onSaved={(b) => setBoard((x) => ({ ...x, ...b }))} />
    </div>
  );
}

function BoardSettingsDialog({ open, onClose, board, level, projectCode, onSaved }) {
  const [cols, setCols] = useState([]);
  const [lanes, setLanes] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open || !board) return;
    setCols(board.columns.map((c) => ({ ...c })));
    setLanes([...(board.swimlanes || [])]);
  }, [open, board]);
  const states = WI_STATES[LEVEL_TYPE[level]].filter((s) => s !== "Removed");

  const setCol = (i, patch) => setCols((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (i, d) => setCols((cs) => { const n = [...cs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  const save = async () => {
    setSaving(true);
    try {
      const r = await workItemApi.saveBoardConfig({
        projectCode: projectCode || null, level,
        columns: cols.map((c) => ({ name: c.name, state: c.state, wip: Number(c.wip) || 0, split: !!c.split })),
        swimlanes: lanes.filter((l) => l.trim()),
      });
      toast.success("Board settings saved");
      onSaved?.(r?.data);
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MisModal open={open} onClose={onClose} onSubmit={save} maxWidth="max-w-2xl"
      title={`Board settings · ${KANBAN_LEVELS.find((l) => l.id === level)?.label}`}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        <button type="submit" data-shortcut="submit" disabled={saving} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin" />}Save</button>
      </>}>
      <p className="text-xs text-gray-500">The first column must be <b>New</b> and the last <b>Done</b>; every state needs at least one column. Several columns may share a state. WIP 0 = no limit (an over-limit move is allowed but flagged). Split adds Doing / Done halves.</p>
      <div className="space-y-2">
        {cols.map((c, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_150px_80px_auto_auto] items-center gap-2">
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move column left" className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={13} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === cols.length - 1} aria-label="Move column right" className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={13} /></button>
            </div>
            <input value={c.name} onChange={(e) => setCol(i, { name: e.target.value })} maxLength={40} className={inputCls} aria-label={`Column ${i + 1} name`} />
            <select value={c.state} onChange={(e) => setCol(i, { state: e.target.value })} className={inputCls} aria-label={`Column ${i + 1} state`}>
              {states.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input type="number" min="0" max="999" value={c.wip} onChange={(e) => setCol(i, { wip: e.target.value })} className={inputCls} aria-label={`Column ${i + 1} WIP limit`} title="WIP limit" />
            <label className="inline-flex items-center gap-1 text-xs text-gray-600" title={i === 0 || i === cols.length - 1 ? "First and last columns cannot be split" : ""}>
              <input type="checkbox" checked={!!c.split} disabled={i === 0 || i === cols.length - 1} onChange={(e) => setCol(i, { split: e.target.checked })} className="accent-blue-600" /> Split
            </label>
            <button type="button" onClick={() => setCols((cs) => cs.filter((_, j) => j !== i))} disabled={cols.length <= 2} aria-label={`Remove column ${c.name}`}
              className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setCols((cs) => [...cs.slice(0, -1), { name: "", state: states[1] || states[0], wip: 0, split: false }, ...cs.slice(-1)])}
          disabled={cols.length >= 12} className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"><Plus size={14} /> Add column</button>
      </div>
      <Field label="Swimlanes (the default lane is always there)">
        <div className="space-y-1.5">
          {lanes.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={l} onChange={(e) => setLanes((ls) => ls.map((x, j) => (j === i ? e.target.value : x)))} maxLength={40} className={inputCls} aria-label={`Swimlane ${i + 1}`} />
              <button type="button" onClick={() => setLanes((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove swimlane ${l}`} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setLanes((ls) => [...ls, ""])} disabled={lanes.length >= 10}
            className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"><Plus size={14} /> Add swimlane</button>
        </div>
      </Field>
    </MisModal>
  );
}
