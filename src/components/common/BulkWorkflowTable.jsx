"use client";

/**
 * DataTable + bulk Approve / Reback / Reject.
 *
 * Drop-in for <DataTable> on a workflow list screen:
 *
 *   <BulkWorkflowTable
 *     module="petty_cash_docket"     // key in backend app/modules/workflow/bulk.py
 *     canAct={access.canApprove}     // page permission; no bar/tick boxes without it
 *     rowId="_id"                    // row field holding the record id (default "id")
 *     columns={columns} data={rows} ...any other DataTable prop
 *   />
 *
 * Only rows that are pending AND waiting on this user (asked from the backend,
 * same rule as the single-record "my-approval-status") get a tick box. Each
 * record is processed on its own by the backend; the result shows what passed
 * and what failed (with the reason), then the page reloads its list.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, XCircle, Loader2, X } from "lucide-react";

import DataTable from "@/components/common/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/apiClient";
import { reloadCurrentPage } from "@/lib/dataSync";
import { API_ENDPOINTS } from "@/config/api.config";
import { APPROVAL_ACTIONS } from "@/config/approvalActions.config";

const MAX_PER_CALL = 100;     // backend cap per bulk-action call
const MAX_ELIGIBLE = 500;     // backend cap per eligibility call

const ACTION_STYLE = {
  approve: { icon: CheckCircle2, btn: "border-green-600 text-green-700 hover:bg-green-50", box: "border-green-200 bg-green-50 text-green-800" },
  reback:  { icon: RotateCcw,    btn: "border-yellow-600 text-yellow-700 hover:bg-yellow-50", box: "border-yellow-200 bg-yellow-50 text-yellow-800" },
  reject:  { icon: XCircle,      btn: "border-red-600 text-red-700 hover:bg-red-50", box: "border-red-200 bg-red-50 text-red-800" },
};
const PAST = { approve: "approved", reback: "sent back", reject: "rejected" };

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export default function BulkWorkflowTable({
  module,
  canAct = false,
  rowId = "id",
  statusKey,            // default: first column whose accessor ends with "status"
  labelKey,             // default: second column (the document number)
  actions = ["approve", "reback", "reject"],
  ...tableProps
}) {
  const { data = [], columns = [] } = tableProps;
  const getKey = (row) => Number(typeof rowId === "function" ? rowId(row) : row[rowId]);
  const sKey = statusKey || columns.find((c) => c.accessor?.toLowerCase().endsWith("status"))?.accessor || "workflowStatus";
  const lKey = labelKey || columns[1]?.accessor;

  // ids pending somewhere in the workflow (cheap, client side)
  const pendingIds = useMemo(
    () => data.filter((r) => String(r[sKey] || "").toLowerCase().startsWith("pending")).map(getKey).filter((n) => n > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, sKey, rowId],
  );
  const pendingKey = pendingIds.join(",");

  // of those, the ones waiting on ME (backend, per record)
  const [eligible, setEligible] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (!canAct || !module || !pendingIds.length) {
      setEligible(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const found = new Set();
      try {
        for (const ids of chunk(pendingIds, MAX_ELIGIBLE)) {
          const res = await apiRequest({ url: API_ENDPOINTS.WORKFLOW.BULK_ELIGIBLE, method: "POST", data: { module, ids } });
          (res?.data?.eligibleIds || []).forEach((id) => found.add(Number(id)));
        }
      } catch {
        /* no tick boxes is a safe fallback; single-record actions still work */
      }
      if (!cancelled) {
        setEligible(found);
        setSelected((prev) => new Set([...prev].filter((id) => found.has(id))));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct, module, pendingKey]);

  // ── action dialog
  const [action, setAction] = useState(null);        // "approve" | "reback" | "reject"
  const [remarks, setRemarks] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);        // { done, failed: [{id, label, message}] }

  const labelOf = useMemo(() => {
    const m = new Map();
    data.forEach((r) => m.set(getKey(r), lKey ? r[lKey] : null));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lKey, rowId]);

  const remarksRequired = action === "reback" || action === "reject";
  const ids = [...selected];

  const openAction = (a) => {
    setAction(a);
    setRemarks("");
    setResult(null);
    setProgress(0);
  };

  const closeDialog = () => {
    if (running) return;
    const hadChanges = result && result.done > 0;
    setAction(null);
    setResult(null);
    if (hadChanges) {
      setSelected(new Set());
      reloadCurrentPage();   // re-mounts the page so the list is fetched again
    }
  };

  const run = async () => {
    if (!action || !ids.length) return;
    if (remarksRequired && !remarks.trim()) {
      toast.error("Remarks are required");
      return;
    }
    setRunning(true);
    let done = 0;
    const failed = [];
    let processed = 0;
    for (const part of chunk(ids, MAX_PER_CALL)) {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.WORKFLOW.BULK_ACTION,
          method: "POST",
          data: { module, action, ids: part, remarks: remarks.trim() },
        });
        (res?.data?.results || []).forEach((r) => {
          if (r.ok) done += 1;
          else failed.push({ id: r.id, label: labelOf.get(Number(r.id)), message: r.message });
        });
      } catch (err) {
        part.forEach((id) => failed.push({ id, label: labelOf.get(id), message: err?.message || "Request failed" }));
      }
      processed += part.length;
      setProgress(processed);
    }
    setRunning(false);
    setResult({ done, failed });
    if (done && !failed.length) toast.success(`${done} ${PAST[action]}`);
    else if (done) toast.warning(`${done} ${PAST[action]}, ${failed.length} failed`);
    else toast.error(`Nothing ${PAST[action]} — ${failed.length} failed`);
  };

  const showBar = canAct && eligible.size > 0;
  const selection = showBar
    ? { keys: selected, getKey, isSelectable: (row) => eligible.has(getKey(row)), onChange: setSelected }
    : undefined;
  const style = action ? ACTION_STYLE[action] : null;
  const suggestions = action ? APPROVAL_ACTIONS[action]?.commentSuggestions ?? [] : [];

  return (
    <>
      {showBar && (
        <div className="mb-1.5 flex flex-wrap items-center gap-2 rounded-sm border border-[#6d9dc5] bg-[#e8f2ff] px-2 py-1 text-[12px] text-[#144664]">
          {selected.size === 0 ? (
            <span>
              <b>{eligible.size}</b> waiting for your approval — tick rows to approve, reback or reject them together.
            </span>
          ) : (
            <>
              <span className="font-semibold">{selected.size} selected</span>
              {actions.map((a) => {
                const Icon = ACTION_STYLE[a].icon;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => openAction(a)}
                    className={`inline-flex items-center gap-1 rounded-sm border bg-white px-2 py-[2px] font-medium cursor-pointer ${ACTION_STYLE[a].btn}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {APPROVAL_ACTIONS[a].label} all
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-[2px] text-gray-600 hover:bg-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </>
          )}
        </div>
      )}

      <DataTable {...tableProps} selection={selection} />

      <Dialog open={!!action} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b">
            <DialogTitle className="text-[18px] font-semibold">
              {action ? `${APPROVAL_ACTIONS[action].label} ${ids.length} record${ids.length === 1 ? "" : "s"}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {!result && action && (
              <>
                <div className={`rounded-md border px-3 py-2 text-sm ${style.box}`}>
                  Each record is processed on its own with the normal approval rules. Records that cannot be{" "}
                  {PAST[action]} are skipped and listed with the reason.
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Remarks {remarksRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={running}
                        onClick={() => setRemarks(s)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs cursor-pointer ${remarks === s ? "border-[#144664] bg-[#e8f2ff] text-[#144664]" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={running}
                    placeholder={remarksRequired ? "Reason (required)" : "Comment for all selected records"}
                    className="mt-2 w-full h-[80px] resize-none rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>

                {running && (
                  <p className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing {progress}/{ids.length}…
                  </p>
                )}
              </>
            )}

            {result && (
              <div className="space-y-3 text-sm">
                <p className="font-semibold">
                  {result.done} {PAST[action]}
                  {result.failed.length ? `, ${result.failed.length} failed` : ""}
                </p>
                {result.failed.length > 0 && (
                  <ul className="divide-y rounded-md border border-red-200 bg-red-50">
                    {result.failed.map((f) => (
                      <li key={f.id} className="px-3 py-1.5">
                        <span className="font-medium text-red-800">{f.label || `#${f.id}`}</span>
                        <span className="text-red-700"> — {f.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t px-5 py-4">
            <div className="flex w-full items-center justify-end gap-3">
              {result ? (
                <button type="button" onClick={closeDialog} className="h-[36px] min-w-[100px] rounded-md bg-[#0c3472] px-4 text-sm font-medium text-white hover:bg-[#092552] cursor-pointer">
                  Done
                </button>
              ) : (
                <>
                  <button type="button" disabled={running} onClick={closeDialog} className="h-[36px] rounded-md border px-4 text-sm hover:bg-gray-50 disabled:opacity-60 cursor-pointer">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={running || !ids.length || (remarksRequired && !remarks.trim())}
                    onClick={run}
                    className="flex h-[36px] min-w-[110px] items-center justify-center gap-2 rounded-md bg-[#0c3472] px-4 text-sm font-medium text-white hover:bg-[#092552] disabled:opacity-60 cursor-pointer"
                  >
                    {running && <Loader2 className="h-4 w-4 animate-spin" />}
                    {action ? `${APPROVAL_ACTIONS[action].label} ${ids.length}` : "Confirm"}
                  </button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
