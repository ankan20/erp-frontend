"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Ban, CheckCircle2, ArrowRight, PlayCircle, ListTodo, Timer, Trash2, Send, ThumbsUp, Wrench, Flag, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar, btnPrimary } from "@/components/mis/MisModal";
import { fmtDate } from "@/lib/misTasks";
import { boardsSprintApi } from "@/lib/misBoards";

const empty = (text) => <p className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">{text}</p>;

function ItemLine({ x, onOpen, extra }) {
  return (
    <li className="text-xs text-gray-700 leading-snug">
      <button onClick={() => onOpen(x.id)} className="text-left hover:text-blue-700 hover:underline">
        <span className="text-[10px] text-gray-500 font-semibold mr-1">{x.code}</span>{x.title}
      </button>
      {extra}
    </li>
  );
}

function Section({ icon: Icon, tone, title, items, render, emptyText }) {
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 inline-flex items-center gap-1 ${tone}`}><Icon size={12} /> {title} <span className="text-gray-400 font-normal">({items.length})</span></p>
      {items.length ? <ul className="space-y-1">{items.map(render)}</ul> : <p className="text-[11px] text-gray-400">{emptyText}</p>}
    </div>
  );
}

/** Daily stand-up: per person — since the last working day, now, blocked. */
export function Standup({ sprint, onOpen, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!sprint) return;
    setLoading(true);
    try { const r = await boardsSprintApi.standup(sprint.id); setData(r?.data || null); }
    catch (e) { toast.error(e?.message || "Could not load the stand-up"); }
    finally { setLoading(false); }
  }, [sprint]);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (!sprint) return empty("Choose a sprint.");
  if (loading && !data) return <div className="py-10 flex justify-center text-gray-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (!data) return null;
  if (!data.people.length) return empty("Nobody has work in this sprint yet.");

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">Changes since <b>{fmtDate(data.since)}</b> (last working day) · today {fmtDate(data.today)}. Blocked people come first.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
        {data.people.map((p) => (
          <article key={p.userId} className={`bg-white rounded-xl border p-3 space-y-2.5 ${p.blocked.length ? "border-red-300" : "border-gray-200"}`} aria-label={p.name}>
            <header className="flex items-center gap-2">
              <UserAvatar id={p.userId} name={p.name} size={30} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                <p className="text-[11px] text-gray-500">{p.remainingHours} h left · {p.comments} comment(s)</p>
              </div>
              {p.blocked.length > 0 && <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><Ban size={10} /> Blocked</span>}
            </header>
            <Section icon={CheckCircle2} tone="text-emerald-700" title="Done since last stand-up" items={p.done} emptyText="Nothing finished."
              render={(x) => <ItemLine key={x.id} x={x} onOpen={onOpen} />} />
            {p.moved.length > 0 && (
              <Section icon={ArrowRight} tone="text-gray-600" title="Moved" items={p.moved} emptyText=""
                render={(x) => <ItemLine key={x.id} x={x} onOpen={onOpen} extra={<span className="text-[10px] text-gray-500"> · {x.from || "—"} → {x.to}</span>} />} />
            )}
            <Section icon={PlayCircle} tone="text-blue-700" title="Working on now" items={p.inProgress} emptyText="Nothing in progress."
              render={(x) => <ItemLine key={x.id} x={x} onOpen={onOpen} extra={<>
                {x.remainingHours != null && <span className="text-[10px] text-gray-500"> · {x.remainingHours} h</span>}
                {x.isRunning && <Timer size={10} className="inline ml-1 text-blue-600" aria-label="clock running" />}
              </>} />} />
            {p.toDo.length > 0 && (
              <Section icon={ListTodo} tone="text-gray-600" title="Up next" items={p.toDo} emptyText=""
                render={(x) => <ItemLine key={x.id} x={x} onOpen={onOpen} />} />
            )}
            {p.blocked.length > 0 && (
              <Section icon={Ban} tone="text-red-600" title="Blocked" items={p.blocked} emptyText=""
                render={(x) => <ItemLine key={x.id} x={x} onOpen={onOpen} extra={x.reason ? <span className="block text-[11px] text-red-600">“{x.reason}”</span> : null} />} />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

const RETRO_COLS = [
  { id: "went_well", title: "Went well", icon: ThumbsUp, tone: "border-t-emerald-500", ph: "What helped us?" },
  { id: "improve", title: "To improve", icon: Wrench, tone: "border-t-amber-500", ph: "What slowed us down?" },
  { id: "action", title: "Actions", icon: Flag, tone: "border-t-blue-500", ph: "What will we do next sprint?" },
];

/** Sprint retrospective: three columns; an action can become a backlog PBI. */
export function Retro({ sprint, onOpen, onChanged }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({ went_well: "", improve: "", action: "" });
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!sprint) return;
    try { const r = await boardsSprintApi.retro(sprint.id); setItems(r?.data?.items || []); }
    catch (e) { toast.error(e?.message || "Could not load the retrospective"); }
  }, [sprint]);
  useEffect(() => { load(); }, [load]);

  if (!sprint) return empty("Choose a sprint.");

  const add = async (cat) => {
    const text = draft[cat].trim();
    if (!text) return;
    setBusy(cat);
    try { await boardsSprintApi.retroAdd(sprint.id, cat, text); setDraft((d) => ({ ...d, [cat]: "" })); load(); }
    catch (e) { toast.error(e?.message || "Could not add"); }
    finally { setBusy(null); }
  };
  const remove = async (it) => {
    try { await boardsSprintApi.retroDelete(sprint.id, it.id); load(); } catch (e) { toast.error(e?.message || "Could not remove"); }
  };
  const toBacklog = async (it) => {
    setBusy(it.id);
    try { const r = await boardsSprintApi.retroToBacklog(sprint.id, it.id); toast.success(`${r?.data?.workItem?.code} added to the backlog`); load(); onChanged?.(); }
    catch (e) { toast.error(e?.message || "Could not add to backlog"); }
    finally { setBusy(null); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {RETRO_COLS.map(({ id, title, icon: Icon, tone, ph }) => {
        const col = items.filter((i) => i.category === id);
        return (
          <section key={id} className={`bg-gray-50/80 rounded-xl border border-gray-200 border-t-4 ${tone} flex flex-col`} aria-label={title}>
            <header className="px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide inline-flex items-center gap-1.5"><Icon size={13} /> {title}</span>
              <span className="text-[11px] text-gray-500">{col.length}</span>
            </header>
            <div className="px-2 pb-2 space-y-2 flex-1">
              {col.map((it) => (
                <article key={it.id} className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{it.text}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <UserAvatar id={it.authorId} name={it.authorName} size={18} />
                    <span className="text-[10px] text-gray-500 flex-1 truncate">{it.authorName}</span>
                    {id === "action" && (it.workItem ? (
                      <button onClick={() => onOpen(it.workItem.id)} className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-0.5">{it.workItem.code} <ExternalLink size={10} /></button>
                    ) : (
                      <button onClick={() => toBacklog(it)} disabled={busy === it.id} className="text-[11px] text-blue-700 hover:underline disabled:opacity-50">→ Backlog</button>
                    ))}
                    {it.canDelete && <button onClick={() => remove(it)} aria-label="Remove card" className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>}
                  </div>
                </article>
              ))}
              <div className="flex gap-1.5">
                <textarea rows={2} value={draft[id]} onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))} placeholder={ph}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(id); } }}
                  aria-label={`New ${title} card`}
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => add(id)} disabled={busy === id || !draft[id].trim()} aria-label={`Add ${title} card`} className={`${btnPrimary} px-2.5`}>
                  {busy === id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
