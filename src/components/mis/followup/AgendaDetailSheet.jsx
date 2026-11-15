"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Pencil, Trash2, Loader2, Play, Send, ArrowRightLeft, Undo2, CheckCircle2, RotateCcw, UserPlus,
  Calendar, FolderKanban, Flag, Clock,
} from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/common/SearchableSelect";
import { Field, inputCls, btnPrimary, btnSecondary, UserAvatar } from "@/components/mis/MisModal";
import { followupApi, BOARD_STYLE, STEP_STYLE } from "@/lib/misFollowups";
import { PRIORITY_STYLE, fmtDate, fmtDateTime } from "@/lib/misTasks";

const ACT = {
  CREATED: "created it", ASSIGNED: "assigned", STARTED: "started work", HANDOFF: "handed off",
  RETURNED: "returned it for review", REJECTED: "sent it back", CLOSED: "closed it", STATUS: "moved it",
  SPRINT: "moved sprint", UPDATED: "edited details", SUPERVISOR: "changed supervisor", COMMENT: "commented", DELETED: "deleted it",
};

function actLine(a) {
  if (a.action === "ASSIGNED") return a.oldValue ? <>reassigned <b>{a.oldValue}</b> → <b>{a.newValue}</b></> : <>assigned <b>{a.newValue}</b></>;
  if (a.action === "HANDOFF") return <>handed off to <b>{a.newValue}</b></>;
  if (a.action === "REJECTED") return <>sent it back to <b>{a.newValue}</b></>;
  if (["STATUS", "SPRINT", "SUPERVISOR"].includes(a.action)) return <>{ACT[a.action]} <b>{a.oldValue}</b> → <b>{a.newValue}</b></>;
  return ACT[a.action] || a.action;
}

/** small inline form inside the sheet */
function Panel({ title, tone = "blue", children }) {
  const tones = { blue: "border-blue-200 bg-blue-50/50", violet: "border-violet-200 bg-violet-50/50", gray: "border-gray-200 bg-gray-50" };
  return (
    <div className={`rounded-lg border p-3 space-y-2.5 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

export default function AgendaDetailSheet({ agendaId, open, onClose, onEdit, onChanged, sprints = [] }) {
  const [f, setF] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState(null);     // handoff | return | assign | close | reject
  const [form, setForm] = useState({ to: "", instruction: "", dueDate: "", note: "" });
  const [comment, setComment] = useState("");
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const load = useCallback(async () => {
    if (!agendaId) return;
    setLoading(true);
    try {
      const r = await followupApi.get(agendaId);
      setF(r?.data || null);
    } catch (e) {
      toast.error(e?.message || "Could not load");
      closeRef.current?.();
    } finally {
      setLoading(false);
    }
  }, [agendaId]);

  useEffect(() => {
    if (open) { setMode(null); setComment(""); load(); } else setF(null);
  }, [open, load]);

  // people for hand-off / assign = members of this agenda's project
  useEffect(() => {
    if (!open || !f) return;
    followupApi.assignable(f.projectCode || undefined)
      .then((r) => setUsers((r?.data || []).map((u) => ({ value: String(u.id), label: u.empCode ? `${u.name} (${u.empCode})` : u.name }))))
      .catch(() => setUsers([]));
  }, [open, f?.projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !mode) closeRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mode]);

  const startMode = (m) => {
    const lastDone = f ? [...(f.steps || [])].reverse().find((s) => s.status === "Done") : null;
    setForm({ to: m === "reject" && lastDone ? String(lastDone.assigneeUserId) : "", instruction: "", dueDate: "", note: "" });
    setMode(m);
  };

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r?.data) setF(r.data);
      toast.success(okMsg);
      setMode(null);
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const submitMode = () => {
    const id = f.id;
    const step = { instruction: form.instruction || null, dueDate: form.dueDate || null };
    if (mode === "handoff") {
      if (!form.to) return toast.error("Choose who gets it next");
      return run(() => followupApi.handoff(id, { nextAssigneeUserId: Number(form.to), note: form.note, ...step }),
        "Handed off — they have been notified");
    }
    if (mode === "return") return run(() => followupApi.returnToSupervisor(id, form.note), "Sent to supervisor for review");
    if (mode === "assign") {
      if (!form.to) return toast.error("Choose a person");
      return run(() => followupApi.assign(id, { assigneeUserId: Number(form.to), ...step }), "Assigned — they have been notified");
    }
    if (mode === "close") return run(() => followupApi.close(id, form.note), "Closed");
    if (mode === "reject") {
      if (!form.note.trim()) return toast.error("Say what needs to be fixed");
      return run(() => followupApi.reject(id, { note: form.note, assigneeUserId: form.to ? Number(form.to) : undefined, ...step }),
        "Sent back for rework");
    }
  };

  const sendComment = async () => {
    const t = comment.trim();
    if (!t) return;
    setBusy(true);
    try {
      await followupApi.comment(f.id, t);
      setComment("");
      await load();
    } catch (e) {
      toast.error(e?.message || "Could not add comment");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${f.fuCode}? It will be removed from the board.`)) return;
    setBusy(true);
    try {
      await followupApi.remove(f.id);
      toast.success("Deleted");
      onChanged?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  const moveSprint = (sid) => run(() => followupApi.moveSprint(f.id, sid ? Number(sid) : null), "Moved");

  if (!open) return null;
  const cur = f?.currentStep;
  const done = f?.boardStatus === "Done";
  const sup = !!f?.canSupervise;
  const set = (k) => (e) => setForm((x) => ({ ...x, [k]: e?.target ? e.target.value : e ?? "" }));
  const sprintOptions = [
    { value: "", label: "Backlog (no sprint)" },
    ...sprints.filter((s) => s.status !== "Closed" && (s.projectCode || null) === (f?.projectCode || null))
      .map((s) => ({ value: String(s.id), label: `${s.name} · ${s.status}` })),
  ];

  const stepFields = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Due">
          <input type="date" value={form.dueDate} onChange={set("dueDate")} className={inputCls} />
        </Field>
        <Field label="Instruction">
          <input value={form.instruction} onChange={set("instruction")} className={inputCls} placeholder="What to do" />
        </Field>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-[9994] flex justify-end" role="dialog" data-state="open" aria-modal="true" aria-label="Follow-up details">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-[520px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#c4d1df] bg-gradient-to-b from-[#f4f4f4] to-[#e3e3e3]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500">{f?.fuCode || "Follow-up"}</p>
            <h2 className="text-sm font-bold text-gray-800 truncate">{f?.title || "Loading…"}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {sup && !done && (
              <button onClick={() => onEdit?.(f)} title="Edit" aria-label="Edit follow-up"
                className="w-8 h-8 rounded-md flex items-center justify-center text-gray-600 hover:bg-white"><Pencil size={15} /></button>
            )}
            {sup && (
              <button onClick={remove} disabled={busy} title="Delete" aria-label="Delete follow-up"
                className="w-8 h-8 rounded-md flex items-center justify-center text-red-600 hover:bg-white disabled:opacity-50"><Trash2 size={15} /></button>
            )}
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-white"><X size={16} /></button>
          </div>
        </div>

        {loading && !f ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : f && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${BOARD_STYLE[f.boardStatus]}`}>{f.boardStatus}</span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${PRIORITY_STYLE[f.priority]}`}>{f.priority}</span>
                {f.storyPoints != null && <span className="text-[11px] px-2.5 py-0.5 rounded-full border bg-white text-gray-700 border-gray-200">{f.storyPoints} pts</span>}
                {f.isOverdue && <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-medium bg-red-50 text-red-600 border-red-200">Overdue</span>}
                {f.reworkCount > 0 && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-medium bg-purple-50 text-purple-700 border-purple-200 inline-flex items-center gap-1">
                    <RotateCcw size={10} /> Rework ×{f.reworkCount}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-gray-500 inline-flex items-center gap-1.5"><Flag size={13} /> Supervisor</span>
                <span className="text-gray-800">{f.supervisorName}</span>
                <span className="text-gray-500 inline-flex items-center gap-1.5"><FolderKanban size={13} /> Project</span>
                <span className="text-gray-800">{f.projectCode ? `${f.projectCode} : ${f.projectName || ""}` : "Company"}</span>
                <span className="text-gray-500 inline-flex items-center gap-1.5"><Clock size={13} /> Sprint</span>
                <span className="text-gray-800">{f.sprintName || "Backlog"}</span>
                <span className="text-gray-500 inline-flex items-center gap-1.5"><Calendar size={13} /> Target</span>
                <span className={f.isOverdue ? "text-red-600 font-semibold" : "text-gray-800"}>{fmtDate(f.dueDate)}</span>
              </div>
              {f.description && <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-md p-3">{f.description}</p>}

              {/* ── my turn ── */}
              {f.isMyTurn && cur && (
                <Panel title={`Your turn · step ${cur.seqNo}${cur.isRework ? " (rework)" : ""}`} tone="blue">
                  {cur.instruction && <p className="text-sm text-gray-800">“{cur.instruction}” <span className="text-gray-500">— {cur.assignedByName}</span></p>}
                  {cur.dueDate && <p className="text-xs text-gray-600">Due {fmtDate(cur.dueDate)}</p>}
                  {!mode && (
                    <div className="flex flex-wrap gap-2">
                      {cur.status === "Pending" && (
                        <button onClick={() => run(() => followupApi.start(f.id), "Started")} disabled={busy} className={btnPrimary}>
                          <Play size={14} /> Start
                        </button>
                      )}
                      <button onClick={() => startMode("handoff")} className={cur.status === "Pending" ? btnSecondary : btnPrimary}>
                        <ArrowRightLeft size={14} /> Done – hand off
                      </button>
                      <button onClick={() => startMode("return")} className={btnSecondary}><Undo2 size={14} /> Done – return to supervisor</button>
                    </div>
                  )}
                </Panel>
              )}

              {/* ── supervisor ── */}
              {sup && !done && !mode && (
                <Panel title="Supervisor" tone={f.boardStatus === "Review" ? "violet" : "gray"}>
                  {f.boardStatus === "Review" && <p className="text-sm text-violet-800 font-medium">Waiting for your review.</p>}
                  <div className="flex flex-wrap gap-2">
                    {f.boardStatus === "Review" && (
                      <>
                        <button onClick={() => startMode("close")} className={btnPrimary}><CheckCircle2 size={14} /> Accept &amp; close</button>
                        <button onClick={() => startMode("reject")} className={btnSecondary}><RotateCcw size={14} /> Send back</button>
                      </>
                    )}
                    <button onClick={() => startMode("assign")} className={btnSecondary}>
                      <UserPlus size={14} /> {cur ? "Reassign" : "Assign"}
                    </button>
                    {f.boardStatus !== "Review" && (
                      <button onClick={() => startMode("close")} className={btnSecondary}><CheckCircle2 size={14} /> Close</button>
                    )}
                  </div>
                  <div className="pt-1">
                    <Field label="Sprint">
                      <SearchableSelect options={sprintOptions} value={f.sprintId ? String(f.sprintId) : ""} onChange={moveSprint} placeholder="Backlog" />
                    </Field>
                  </div>
                </Panel>
              )}

              {/* ── action form ── */}
              {mode && (
                <Panel tone={mode === "reject" ? "violet" : "blue"} title={{
                  handoff: "Hand off to the next person", return: "Return to supervisor", assign: cur ? `Reassign (now with ${cur.assigneeName})` : "Assign",
                  close: "Close this follow-up", reject: "Send back for rework",
                }[mode]}>
                  {["handoff", "assign", "reject"].includes(mode) && (
                    <Field label={mode === "reject" ? "Who fixes it" : "Person"} required={mode !== "reject"}>
                      <SearchableSelect options={users} value={form.to} onChange={set("to")} placeholder="Choose a project member" />
                    </Field>
                  )}
                  {["handoff", "assign", "reject"].includes(mode) && stepFields}
                  {mode !== "assign" && (
                    <Field label={mode === "reject" ? "What needs fixing" : "Note"} required={mode === "reject"}>
                      <textarea rows={2} value={form.note} onChange={set("note")} className={inputCls}
                        placeholder={mode === "handoff" ? "What you did / what is attached" : ""} />
                    </Field>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setMode(null)} className={btnSecondary}>Cancel</button>
                    <button data-shortcut="submit" onClick={submitMode} disabled={busy} className={btnPrimary}>
                      {busy && <Loader2 size={14} className="animate-spin" />}Confirm
                    </button>
                  </div>
                  {["handoff", "assign", "reject"].includes(mode) && <p className="text-[11px] text-gray-500">The person gets a WhatsApp message.</p>}
                </Panel>
              )}

              {/* ── relay chain ── */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Relay chain</p>
                {(f.steps || []).length === 0 ? (
                  <p className="text-sm text-gray-500">Not assigned to anyone yet.</p>
                ) : (
                  <ol className="relative ml-3 border-l-2 border-gray-200 space-y-3">
                    {f.steps.map((s) => (
                      <li key={s.id} className="ml-5">
                        <span className="absolute -left-[15px]"><UserAvatar id={s.assigneeUserId} name={s.assigneeName} size={28} ring /></span>
                        <div className={`rounded-lg border p-2.5 ${s.status === "Pending" || s.status === "In Progress" ? "border-blue-300 bg-blue-50/40" : "border-gray-200 bg-white"}`}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-800">{s.seqNo}. {s.assigneeName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STEP_STYLE[s.status]}`}>{s.status}</span>
                            {s.isRework && <span className="text-[10px] px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">Rework</span>}
                            {s.status === "Done" && s.onTime === true && <span className="text-[10px] text-emerald-700">✓ on time</span>}
                            {s.status === "Done" && s.onTime === false && <span className="text-[10px] text-red-600">late</span>}
                          </div>
                          {s.instruction && <p className="text-xs text-gray-700 mt-1">“{s.instruction}” <span className="text-gray-400">— {s.assignedByName}</span></p>}
                          {s.completionNote && <p className="text-xs text-gray-800 mt-1 bg-gray-50 rounded px-2 py-1">{s.completionNote}</p>}
                          <p className="text-[10px] text-gray-400 mt-1">
                            Given {fmtDateTime(s.assignedAt)}
                            {s.startedAt && <> · started {fmtDateTime(s.startedAt)}</>}
                            {s.completedAt && <> · finished {fmtDateTime(s.completedAt)}</>}
                            {s.dueDate && <> · due {fmtDate(s.dueDate)}</>}
                          </p>
                        </div>
                      </li>
                    ))}
                    {f.boardStatus === "Review" && (
                      <li className="ml-5 text-xs text-violet-700 font-medium">→ With {f.supervisorName} for review</li>
                    )}
                    {done && <li className="ml-5 text-xs text-emerald-700 font-medium">✓ Closed {fmtDateTime(f.closedAt)}</li>}
                  </ol>
                )}
              </div>
            </div>

            {/* comments + history */}
            <div className="border-t border-gray-100 p-4 space-y-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Comments &amp; history</p>
              <div className="flex gap-2">
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button {...(!mode ? { "data-shortcut": "submit" } : {})} onClick={sendComment} disabled={busy || !comment.trim()} aria-label="Send comment"
                  className="self-end h-9 w-9 rounded-md bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50">
                  <Send size={15} />
                </button>
              </div>
              <ol className="relative border-l border-gray-200 ml-1.5 space-y-3">
                {(f.activity || []).map((a) => (
                  <li key={a.id} className="ml-4">
                    <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${a.action === "COMMENT" ? "bg-blue-500" : "bg-gray-300"}`} />
                    <p className="text-xs text-gray-700"><b>{a.userName || "System"}</b> {actLine(a)}</p>
                    {a.comment && <p className="text-sm text-gray-800 mt-1 bg-blue-50/60 border border-blue-100 rounded-md px-2.5 py-1.5 whitespace-pre-wrap">{a.comment}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
