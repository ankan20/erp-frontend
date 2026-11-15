"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { MisModal, btnSecondary } from "./MisModal";
import { misTaskApi, fmtDateTime } from "@/lib/misTasks";

/** Reopen requests waiting for me (I am a higher level for those tasks). */
export default function ReopenRequestsDialog({ open, onClose, onOpenTask, onChanged }) {
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    misTaskApi.reopenRequests("decide").then((r) => setRows(r?.data || [])).catch(() => setRows([]));
  }, []);
  useEffect(() => { if (open) { setRows(null); setNotes({}); load(); } }, [open, load]);

  const decide = async (r, approve) => {
    const note = (notes[r.id] || "").trim();
    if (!approve && !note) return toast.error("Write a reason to reject");
    setBusy(r.id);
    try {
      await misTaskApi.decideReopen(r.id, approve, note);
      toast.success(approve ? `${r.taskCode} reopened` : "Request rejected");
      load();
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || "Could not decide");
    } finally {
      setBusy(null);
    }
  };

  return (
    <MisModal open={open} onClose={onClose} title="Reopen requests" maxWidth="max-w-2xl"
      footer={<button type="button" onClick={onClose} className={btnSecondary}>Close</button>}>
      {rows === null ? (
        <div className="py-8 flex justify-center text-gray-500"><Loader2 size={16} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">Nothing waiting for you.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <button className="text-sm font-semibold text-blue-700 hover:underline text-left" onClick={() => onOpenTask?.(r.taskId)}>
                  {r.taskCode} · {r.taskTitle}
                </button>
                <span className="text-[11px] text-gray-500">{fmtDateTime(r.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700"><b>{r.requestedByName}</b> asks: “{r.reason}”</p>
              <div className="flex flex-wrap gap-2 items-center">
                <input value={notes[r.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Note (needed to reject)"
                  className="flex-1 min-w-[180px] border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button disabled={busy === r.id} onClick={() => decide(r, true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  <ThumbsUp size={14} /> Approve
                </button>
                <button disabled={busy === r.id} onClick={() => decide(r, false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50">
                  <ThumbsDown size={14} /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-gray-500">Approving puts the task back to In Progress (clock resumes) and counts as rework in the owner&apos;s score.</p>
    </MisModal>
  );
}
