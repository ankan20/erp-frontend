"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Pencil, Trash2, Loader2, Calendar, User, FolderKanban, Send, RotateCcw, Play, Pause, CheckCircle2,
  Ban, Lock, Unlock, ThumbsUp, ThumbsDown, Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import {
  misTaskApi, STATUS_STYLE, PRIORITY_STYLE, fmtDateTime, fmtDateTimeParts, stampFetched,
} from "@/lib/misTasks";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import TaskTimer, { useTick } from "./TaskTimer";
import { GuideHint } from "@/components/mis/guide/Guide";
import { HINTS } from "@/config/guideContent";

const ACTION_TEXT = {
  CREATED: "created the task",
  ASSIGNED: "assigned",
  STATUS: "changed status",
  STARTED: "pressed Start",
  UPDATED: "updated",
  COMMENT: "commented",
  DELETED: "deleted the task",
  REOPEN_REQUESTED: "asked to reopen it",
  REOPENED: "reopened it",
  REOPEN_REJECTED: "rejected the reopen request",
};

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={14} className="mt-0.5 text-gray-400 shrink-0" />
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-800 min-w-0 break-words">{children}</span>
    </div>
  );
}

function activityLine(a) {
  if (a.action === "STATUS") return <>moved <b>{a.oldValue}</b> → <b>{a.newValue}</b></>;
  if (a.action === "ASSIGNED") return a.oldValue
    ? <>reassigned <b>{a.oldValue}</b> → <b>{a.newValue}</b></>
    : <>assigned to <b>{a.newValue}</b></>;
  if (a.action === "UPDATED") return <>updated <b>{(a.oldValue || "").replace("_", " ")}</b>{a.newValue ? <> → {a.newValue}</> : null}</>;
  return ACTION_TEXT[a.action] || a.action;
}

const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border disabled:opacity-50";
const primary = `${btn} bg-blue-600 border-blue-600 text-white hover:bg-blue-700`;
const secondary = `${btn} bg-white border-gray-300 text-gray-700 hover:bg-gray-50`;

/**
 * Right-side panel for one Self Task:
 *   work timer + Start / Pause / Resume / Done / Cancel,
 *   Done = locked → owner asks to reopen, a higher level approves / rejects (or reopens directly),
 *   details, comments, history.
 */
export default function TaskDetailSheet({ taskId, open, onClose, onEdit, onChanged }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [reopenText, setReopenText] = useState("");
  const [askReopen, setAskReopen] = useState(false);
  const [confirm, setConfirm] = useState(null);       // ConfirmDialog state
  const now = useTick(!!task?.isRunning);

  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const r = await misTaskApi.get(taskId);
      setTask(stampFetched(r?.data || null));
    } catch (e) {
      toast.error(e?.message || "Could not load task");
      closeRef.current?.();
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open) { setComment(""); setReopenText(""); setAskReopen(false); load(); } else setTask(null);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !confirm && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, confirm]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setReopenText("");
      setAskReopen(false);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const status = (s, ok) => run(() => misTaskApi.setStatus(task.id, s), ok);

  const markDone = () => setConfirm({
    title: `Mark ${task?.taskCode} Done?`,
    description: "The clock stops and the task is locked. To work on it again you will need a reopen request approved by a higher level.",
    confirmLabel: "Mark Done",
    onConfirm: () => status("Done", "Done — task locked"),
  });

  const cancelTask = () => setConfirm({
    title: `Cancel ${task?.taskCode}?`,
    description: "The clock stops. It can be restored later.",
    confirmLabel: "Cancel task",
    variant: "destructive",
    onConfirm: () => status("Cancelled", "Cancelled"),
  });

  const reopenDirect = () => setConfirm({
    title: `Reopen ${task?.taskCode}?`,
    description: "It goes back to In Progress, the clock resumes, and it counts as rework in the owner's score.",
    confirmLabel: "Reopen",
    onConfirm: () => run(() => misTaskApi.reopen(task.id), "Reopened"),
  });

  const remove = () => setConfirm({
    title: `Delete task ${task?.taskCode}?`,
    description: "It will be removed from all lists.",
    confirmLabel: "Delete",
    variant: "destructive",
    onConfirm: () => run(async () => { await misTaskApi.remove(task.id); onClose?.(); }, "Task deleted"),
  });

  const sendComment = async () => {
    const text = comment.trim();
    if (!text) return;
    setBusy(true);
    try {
      await misTaskApi.comment(task.id, text);
      setComment("");
      await load();
    } catch (e) {
      toast.error(e?.message || "Could not add comment");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const canEdit = !!task?.canEdit;            // false once locked
  const locked = !!task?.isLocked;
  const pending = task?.pendingReopen;

  return (
    <div className="fixed inset-0 z-[9994] flex justify-end" role="dialog" data-state="open" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-[480px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#c4d1df] bg-gradient-to-b from-[#f4f4f4] to-[#e3e3e3]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500">{task?.taskCode || "Task"}</p>
            <h2 className="text-sm font-bold text-gray-800 truncate">{task?.title || "Loading…"}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <>
                <button onClick={() => onEdit?.(task)} title="Edit" aria-label="Edit task"
                  className="w-8 h-8 rounded-md flex items-center justify-center text-gray-600 hover:bg-white">
                  <Pencil size={15} />
                </button>
                <button onClick={remove} disabled={busy} title="Delete" aria-label="Delete task"
                  className="w-8 h-8 rounded-md flex items-center justify-center text-red-600 hover:bg-white disabled:opacity-50">
                  <Trash2 size={15} />
                </button>
              </>
            )}
            <button onClick={onClose} aria-label="Close"
              className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-white">
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && !task ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : task && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[task.status]}`}>{task.status}</span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span>
                {task.isOverdue && <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-medium bg-red-50 text-red-600 border-red-200">Overdue</span>}
                {locked && <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-medium bg-gray-100 text-gray-700 border-gray-300 inline-flex items-center gap-1"><Lock size={10} /> Locked</span>}
                {task.reopenCount > 0 && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-medium bg-purple-50 text-purple-700 border-purple-200 inline-flex items-center gap-1">
                    <RotateCcw size={10} /> Reopened ×{task.reopenCount}
                  </span>
                )}
              </div>

              {/* ── work time + actions ── */}
              <div className={`rounded-lg border p-3 space-y-2.5 ${task.isRunning ? "border-blue-200 bg-blue-50/50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Work time</p>
                  <TaskTimer task={task} now={now} />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                  <span>Started</span><span className="text-gray-800">{task.startedAt ? fmtDateTime(task.startedAt) : "Not started"}</span>
                  <span>Finished</span><span className="text-gray-800">{task.completedAt ? fmtDateTime(task.completedAt) : "—"}</span>
                  <span>Estimate</span><span className="text-gray-800">{task.estimatedHours != null ? `${task.estimatedHours} h` : "—"}</span>
                </div>
                {!locked && (task.canStart || canEdit) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {task.status === "To Do" && task.canStart && (
                      <button className={primary} disabled={busy} onClick={() => run(() => misTaskApi.start(task.id), "Started — time is being measured")}>
                        <Play size={14} /> Start
                      </button>
                    )}
                    {task.status === "In Progress" && canEdit && (
                      <>
                        <button className={primary} disabled={busy} onClick={markDone}><CheckCircle2 size={14} /> Done</button>
                        <button className={secondary} disabled={busy} onClick={() => status("On Hold", "Paused")}><Pause size={14} /> Pause</button>
                      </>
                    )}
                    {task.status === "On Hold" && canEdit && (
                      <>
                        <button className={primary} disabled={busy} onClick={() => run(() => misTaskApi.start(task.id), "Resumed")}><Play size={14} /> Resume</button>
                        <button className={secondary} disabled={busy} onClick={markDone}><CheckCircle2 size={14} /> Done</button>
                      </>
                    )}
                    {["To Do", "In Progress", "On Hold"].includes(task.status) && canEdit && (
                      <button className={secondary} disabled={busy} onClick={cancelTask}><Ban size={14} /> Cancel</button>
                    )}
                    {task.status === "Cancelled" && canEdit && (
                      <button className={secondary} disabled={busy} onClick={() => status("To Do", "Restored")}><RotateCcw size={14} /> Restore</button>
                    )}
                  </div>
                )}
                {task.status === "To Do" && <GuideHint>{task.canStart ? HINTS.startFirst : HINTS.cannotStart}</GuideHint>}
                {!locked && task.status !== "To Do" && !canEdit && <GuideHint>{HINTS.cannotEdit}</GuideHint>}
                {!locked && canEdit && task.estimatedHours == null && <GuideHint>{HINTS.noEstimate}</GuideHint>}
              </div>

              {/* ── locked: reopen request / decision ── */}
              {locked && (
                <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 space-y-2.5">
                  <p className="text-sm text-gray-800 inline-flex items-center gap-1.5"><Lock size={14} /> Done and locked. Only a higher level can reopen it.</p>
                  {pending && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                      <p className="text-amber-900 inline-flex items-center gap-1.5"><Hourglass size={13} /> Reopen requested by <b>{pending.requestedByName}</b> · {fmtDateTime(pending.createdAt)}</p>
                      <p className="text-amber-900 mt-1">“{pending.reason}”</p>
                    </div>
                  )}
                  {task.canDecideReopen && pending && (
                    <div className="space-y-2">
                      <textarea rows={2} value={reopenText} onChange={(e) => setReopenText(e.target.value)} placeholder="Note (needed to reject)"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <div className="flex gap-2">
                        <button className={primary} disabled={busy} onClick={() => run(() => misTaskApi.decideReopen(pending.id, true, reopenText), "Reopened — the clock resumes")}><ThumbsUp size={14} /> Approve &amp; reopen</button>
                        <button className={secondary} disabled={busy || !reopenText.trim()} onClick={() => run(() => misTaskApi.decideReopen(pending.id, false, reopenText), "Request rejected")}><ThumbsDown size={14} /> Reject</button>
                      </div>
                    </div>
                  )}
                  {task.canRequestReopen && !askReopen && (
                    <button className={secondary} onClick={() => setAskReopen(true)}><Unlock size={14} /> Request reopen</button>
                  )}
                  {askReopen && (
                    <div className="space-y-2">
                      <textarea autoFocus rows={2} value={reopenText} onChange={(e) => setReopenText(e.target.value)} placeholder="Why must it be reopened?"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <div className="flex gap-2">
                        <button className={primary} disabled={busy || !reopenText.trim()} onClick={() => run(() => misTaskApi.requestReopen(task.id, reopenText.trim()), "Request sent to a higher level")}>Send request</button>
                        <button className={secondary} onClick={() => setAskReopen(false)}>Cancel</button>
                      </div>
                      <p className="text-[11px] text-gray-500">A reopen counts as rework in your performance score.</p>
                    </div>
                  )}
                  {task.canReopen && !pending && (
                    <button className={secondary} disabled={busy} onClick={reopenDirect}>
                      <Unlock size={14} /> Reopen (higher level)
                    </button>
                  )}
                  {!pending && !task.canRequestReopen && !task.canReopen && (
                    <p className="text-[11px] text-gray-500">Only the task owner can ask to reopen it.</p>
                  )}
                </div>
              )}

              {task.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-md p-3">{task.description}</p>
              )}

              <div className="space-y-2">
                <Row icon={User} label="Assigned to">{task.ownerName}{task.ownerEmpCode ? ` (${task.ownerEmpCode})` : ""}</Row>
                <Row icon={User} label="Assigned by">{task.createdByName}</Row>
                <Row icon={User} label="Handover to">{task.handoverName || "—"}</Row>
                <Row icon={FolderKanban} label="Project">{task.projectCode ? `${task.projectCode} : ${task.projectName || ""}` : "Company"}</Row>
                <Row icon={Calendar} label="Start">{fmtDateTimeParts(task.startDate, task.startTime)}</Row>
                <Row icon={Calendar} label="Due"><span className={task.isOverdue ? "text-red-600 font-semibold" : ""}>{fmtDateTimeParts(task.dueDate, task.dueTime)}</span></Row>
                {task.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-6">
                    {task.tags.map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{t}</span>)}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 p-4 space-y-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Comments &amp; history</p>
              {!locked && (
                <div className="flex gap-2">
                  <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
                    placeholder="Write a comment… (Ctrl+Enter to send)"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button data-shortcut="submit" onClick={sendComment} disabled={busy || !comment.trim()} aria-label="Send comment"
                    className="self-end h-9 w-9 rounded-md bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50">
                    <Send size={15} />
                  </button>
                </div>
              )}
              <ol className="relative border-l border-gray-200 ml-1.5 space-y-3">
                {(task.activity || []).map((a) => (
                  <li key={a.id} className="ml-4">
                    <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${a.action === "COMMENT" ? "bg-blue-500" : "bg-gray-300"}`} />
                    <p className="text-xs text-gray-700"><b>{a.userName || "System"}</b> {activityLine(a)}</p>
                    {a.comment && <p className="text-sm text-gray-800 mt-1 bg-blue-50/60 border border-blue-100 rounded-md px-2.5 py-1.5 whitespace-pre-wrap">{a.comment}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </aside>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
