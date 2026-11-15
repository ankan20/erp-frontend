"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Pencil, Trash2, Loader2, Calendar, User, FolderKanban, Clock, Send, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  misTaskApi, TASK_STATUSES, STATUS_STYLE, PRIORITY_STYLE, fmtDate, fmtDateTime,
} from "@/lib/misTasks";

const ACTION_TEXT = {
  CREATED: "created the task",
  ASSIGNED: "assigned",
  STATUS: "changed status",
  UPDATED: "updated",
  COMMENT: "commented",
  DELETED: "deleted the task",
};

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={14} className="mt-0.5 text-gray-400 shrink-0" />
      <span className="w-24 shrink-0 text-gray-500">{label}</span>
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

/** Right-side panel: details, quick status, comments, timeline. */
export default function TaskDetailSheet({ taskId, open, onClose, onEdit, onChanged }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");

  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const r = await misTaskApi.get(taskId);
      setTask(r?.data || null);
    } catch (e) {
      toast.error(e?.message || "Could not load task");
      closeRef.current?.();
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open) { setComment(""); load(); } else setTask(null);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const changeStatus = async (s) => {
    if (!task || s === task.status) return;
    setBusy(true);
    try {
      await misTaskApi.setStatus(task.id, s);
      toast.success(`Marked ${s}`);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || "Could not change status");
    } finally {
      setBusy(false);
    }
  };

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

  const remove = async () => {
    if (!window.confirm(`Delete task ${task.taskCode}? It will be removed from all lists.`)) return;
    setBusy(true);
    try {
      await misTaskApi.remove(task.id);
      toast.success("Task deleted");
      onChanged?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Could not delete task");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const canEdit = !!task?.canEdit;

  return (
    <div className="fixed inset-0 z-[9994] flex justify-end" role="dialog" data-state="open" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-[460px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
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
                {task.reopenCount > 0 && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-medium bg-purple-50 text-purple-700 border-purple-200 inline-flex items-center gap-1">
                    <RotateCcw size={10} /> Reopened ×{task.reopenCount}
                  </span>
                )}
              </div>

              {canEdit && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Move to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TASK_STATUSES.map((s) => (
                      <button key={s} disabled={busy || s === task.status} onClick={() => changeStatus(s)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition ${s === task.status
                          ? `${STATUS_STYLE[s]} font-semibold cursor-default`
                          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"} disabled:opacity-70`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {task.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-md p-3">{task.description}</p>
              )}

              <div className="space-y-2">
                <Row icon={User} label="Assigned to">{task.ownerName}{task.ownerEmpCode ? ` (${task.ownerEmpCode})` : ""}</Row>
                <Row icon={User} label="Created by">{task.createdByName}</Row>
                <Row icon={FolderKanban} label="Project">{task.projectCode ? `${task.projectCode} : ${task.projectName || ""}` : "Company"}</Row>
                <Row icon={Calendar} label="Start / Due">{fmtDate(task.startDate)} → <span className={task.isOverdue ? "text-red-600 font-semibold" : ""}>{fmtDate(task.dueDate)}</span></Row>
                {task.completedAt && <Row icon={Calendar} label="Completed">{fmtDateTime(task.completedAt)}</Row>}
                {(task.estimatedHours != null || task.actualHours != null) && (
                  <Row icon={Clock} label="Hours">{task.estimatedHours ?? "—"} est. · {task.actualHours ?? "—"} actual</Row>
                )}
                {task.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-6">
                    {task.tags.map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{t}</span>)}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 p-4 space-y-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Comments &amp; history</p>
              <div className="flex gap-2">
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment… (Ctrl+Enter to send)"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button data-shortcut="submit" onClick={sendComment} disabled={busy || !comment.trim()} aria-label="Send comment"
                  className="self-end h-9 w-9 rounded-md bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50">
                  <Send size={15} />
                </button>
              </div>
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
    </div>
  );
}
