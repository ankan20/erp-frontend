"use client";

/**
 * Reback request dialog for a fully approved record. Opened from the page
 * header's Approve / Action icon (see PageActionButtons + lib/rebackRequest).
 *
 *   no open request  -> write a comment, "Raise request" (or why it can't be sent back)
 *   open request     -> who raised it + comment;
 *                       final approver / admin: Accept / Decline
 *                       person who raised it:   Cancel
 *                       everyone else:          "Waiting for <final approver>"
 */

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/apiClient";
import { reloadCurrentPage } from "@/lib/dataSync";
import { API_ENDPOINTS } from "@/config/api.config";
import { APPROVAL_ACTIONS } from "@/config/approvalActions.config";
import {
  subscribeRebackRequest,
  getRebackRequestState,
  getServerRebackRequestState,
  closeRebackRequestDialog,
  rebackRequestsChanged,
} from "@/lib/rebackRequest";

const BASE = API_ENDPOINTS.WORKFLOW.REBACK_REQUESTS;

export const fmtWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function RebackRequestDialog() {
  const { record, open } = useSyncExternalStore(subscribeRebackRequest, getRebackRequestState, getServerRebackRequestState);
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(null);       // "raise" | "accept" | "decline" | "cancel"

  if (!record?.approved) return null;
  const req = record.request;
  const approvers = (record.finalApprovers || []).map((a) => a.name).filter(Boolean).join(", ") || "the final approver";

  const close = () => {
    if (busy) return;
    setText("");
    closeRebackRequestDialog();
  };

  const call = async (kind, url, data) => {
    setBusy(kind);
    try {
      const res = await apiRequest({ url, method: "POST", data });
      toast.success(res?.message || "Done");
      setText("");
      closeRebackRequestDialog();
      rebackRequestsChanged();
      reloadCurrentPage();          // page + header icon load fresh
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
      // e.g. already declined / accepted elsewhere: close and show the current state
      setText("");
      closeRebackRequestDialog();
      rebackRequestsChanged();
    } finally {
      setBusy(null);
    }
  };

  const raise = () => call("raise", BASE, { module: record.module, id: Number(record.id), reason: text.trim(), pageUrl: pathname });
  const accept = () => call("accept", `${BASE}/${req.id}/accept`, { comment: text.trim() });
  const decline = () => call("decline", `${BASE}/${req.id}/decline`, { comment: text.trim() });
  const cancel = () => call("cancel", `${BASE}/${req.id}/cancel`, {});

  const chips = APPROVAL_ACTIONS.reback?.commentSuggestions || [];
  const box = (placeholder) => (
    <div>
      {!req && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!!busy}
              onClick={() => setText(s)}
              className={`rounded-full border px-2.5 py-0.5 text-xs cursor-pointer ${text === s ? "border-[#144664] bg-[#e8f2ff] text-[#144664]" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!!busy}
        placeholder={placeholder}
        className="w-full h-[80px] resize-none rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-400"
      />
    </div>
  );

  const btn = "flex h-[36px] min-w-[100px] items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-60 cursor-pointer";
  const spin = (k) => busy === k && <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-[18px] font-semibold">
            <RotateCcw className="h-4 w-4 text-yellow-700" /> Reback request · {record.recordNo}
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4 text-sm">
          {req ? (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-amber-900">
                  <b>{req.requestedByName || "Someone"}</b> asked to send this approved record back
                  <span className="text-amber-700"> · {fmtWhen(req.requestedAt)}</span>
                </p>
                <p className="mt-1 text-amber-900">“{req.reason}”</p>
              </div>
              {record.canDecide ? (
                <>
                  {record.blockedReason && (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                      Can&apos;t be sent back now: {record.blockedReason} You can decline it.
                    </p>
                  )}
                  <p className="text-gray-600">
                    Accept undoes the approval (its accounts / stock entry is removed) and sends the record back to
                    the creator. It then goes through every approval level again.
                  </p>
                  <label className="block font-medium">
                    Comment <span className="text-gray-400">(needed to decline)</span>
                  </label>
                  {box("Your comment")}
                </>
              ) : (
                <p className="text-gray-600">Waiting for {approvers} (or an admin) to accept or decline.</p>
              )}
            </>
          ) : record.canRaise ? (
            <>
              <p className="text-gray-600">
                This record is fully approved. Your request goes to {approvers}; once accepted the record comes back
                for correction and is approved again from the first level.
              </p>
              <label className="block font-medium">
                Why should it be sent back? <span className="text-red-500">*</span>
              </label>
              {box("Reason (required)")}
            </>
          ) : (
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
              {record.blockedReason
                ? <>Can&apos;t be sent back: {record.blockedReason}</>
                : "Only people on this record's approval path can ask for a reback."}
            </p>
          )}

          {!req && record.lastRequest && (
            <p className="text-xs text-gray-500">
              Last request: {record.lastRequest.status.toLowerCase()} by {record.lastRequest.decidedByName || "—"}
              {record.lastRequest.decisionComment ? ` — “${record.lastRequest.decisionComment}”` : ""}
              {record.lastRequest.decidedAt ? ` · ${fmtWhen(record.lastRequest.decidedAt)}` : ""}
            </p>
          )}
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <div className="flex w-full items-center justify-end gap-3">
            <button type="button" disabled={!!busy} onClick={close} className="h-[36px] rounded-md border px-4 text-sm hover:bg-gray-50 disabled:opacity-60 cursor-pointer">
              Close
            </button>
            {req?.canCancel && !record.canDecide && (
              <button type="button" disabled={!!busy} onClick={cancel} className={`${btn} border border-gray-400 text-gray-700 hover:bg-gray-50`}>
                {spin("cancel")} Cancel request
              </button>
            )}
            {req && record.canDecide && (
              <>
                <button type="button" disabled={!!busy || !text.trim()} onClick={decline} className={`${btn} border border-red-600 text-red-700 hover:bg-red-50`}>
                  {spin("decline")} Decline
                </button>
                <button type="button" disabled={!!busy || !!record.blockedReason} onClick={accept} className={`${btn} bg-[#0c3472] text-white hover:bg-[#092552]`}>
                  {spin("accept")} Accept
                </button>
              </>
            )}
            {!req && record.canRaise && (
              <button type="button" disabled={!!busy || !text.trim()} onClick={raise} className={`${btn} bg-[#0c3472] text-white hover:bg-[#092552]`}>
                {spin("raise")} Raise request
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
