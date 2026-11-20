"use client";

/**
 * Reback Requests — requests to send a fully approved record back.
 *   admin:          every request
 *   final approver: requests waiting on them (+ ones they raised)
 *   everyone:       requests they raised
 * Accept / Decline here, or on the record itself (Approve / Action icon).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { fmtWhen } from "@/components/common/RebackRequestDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { grantRebackView, rebackRequestsChanged } from "@/lib/rebackRequest";

const BASE = API_ENDPOINTS.WORKFLOW.REBACK_REQUESTS;
const STATUS_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "", label: "All" },
];
const STATUS_STYLE = {
  PENDING:   "bg-yellow-100 text-yellow-800 border-yellow-300",
  ACCEPTED:  "bg-green-100 text-green-700 border-green-300",
  DECLINED:  "bg-red-100 text-red-700 border-red-300",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-300",
};
const VERB = { accept: "Accept", decline: "Decline", cancel: "Cancel request" };

export default function Page() {
  const router = useRouter();
  const [status, setStatus] = useState("PENDING");
  const [module, setModule] = useState("");
  const [modules, setModules] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [act, setAct] = useState(null);          // { kind, row }
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.WORKFLOW.REBACK_REQUEST_MODULES, method: "GET" })
      .then((res) => setModules(res?.data || []))
      .catch(() => setModules([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (module) params.set("module", module);
      const res = await apiRequest({ url: `${BASE}?${params}`, method: "GET" });
      setRows((res?.data || []).map((r, i) => ({ ...r, sl: i + 1 })));
    } catch (err) {
      toast.error(err?.message || "Failed to load reback requests");
    } finally {
      setLoading(false);
    }
  }, [status, module]);

  useEffect(() => { load(); }, [load]);

  const run = async () => {
    if (!act) return;
    setBusy(true);
    try {
      const res = await apiRequest({ url: `${BASE}/${act.row.id}/${act.kind}`, method: "POST", data: { comment: comment.trim() } });
      toast.success(res?.message || "Done");
      setAct(null);
      rebackRequestsChanged();
      load();
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const small = "rounded-sm border bg-white px-2 py-[1px] text-[12px] font-medium cursor-pointer";
  const columns = [
    { header: "Sl. No", accessor: "sl", width: "60px" },
    { header: "Module", accessor: "moduleLabel", width: "150px" },
    {
      header: "Document",
      accessor: "recordNo",
      width: "140px",
      render: (row) => row.pageUrl ? (
        <span
          className="text-blue-600 hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            grantRebackView(row.pageUrl);
            // full load: the record page checks access on its first render
            window.location.assign(row.pageUrl);
          }}
        >
          {row.recordNo}
        </span>
      ) : row.recordNo,
    },
    { header: "Project", accessor: "projectCode", width: "90px" },
    { header: "Raised By", accessor: "requestedByName", width: "130px" },
    { header: "Raised On", accessor: "requestedAt", width: "150px", render: (row) => fmtWhen(row.requestedAt) },
    { header: "Reason", accessor: "reason" },
    {
      header: "Status",
      accessor: "status",
      width: "100px",
      render: (row) => (
        <span className={`rounded border px-1.5 py-[1px] text-[11px] font-semibold ${STATUS_STYLE[row.status] || ""}`}>
          {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      header: "Decision",
      accessor: "decisionComment",
      render: (row) => row.decidedByName
        ? <span>{row.decidedByName}{row.decisionComment ? ` — ${row.decisionComment}` : ""}</span>
        : "-",
    },
    {
      header: "Action",
      accessor: "action",
      width: "170px",
      render: (row) => (
        <div className="flex gap-1">
          {row.canDecide && (
            <>
              <button type="button" className={`${small} border-green-600 text-green-700 hover:bg-green-50`}
                onClick={(e) => { e.stopPropagation(); setComment(""); setAct({ kind: "accept", row }); }}>
                Accept
              </button>
              <button type="button" className={`${small} border-red-600 text-red-700 hover:bg-red-50`}
                onClick={(e) => { e.stopPropagation(); setComment(""); setAct({ kind: "decline", row }); }}>
                Decline
              </button>
            </>
          )}
          {row.canCancel && !row.canDecide && (
            <button type="button" className={`${small} border-gray-400 text-gray-700 hover:bg-gray-50`}
              onClick={(e) => { e.stopPropagation(); setComment(""); setAct({ kind: "cancel", row }); }}>
              Cancel
            </button>
          )}
        </div>
      ),
    },
  ];

  const actions = getPageActions({ router });
  const needComment = act?.kind === "decline";

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-semibold text-[#144664]">Reback Requests</span>
          <div className="flex rounded-sm border border-[#6d9dc5] overflow-hidden">
            {STATUS_TABS.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setStatus(t.value)}
                className={`px-2.5 py-[3px] cursor-pointer ${status === t.value ? "bg-[#144664] text-white" : "bg-white text-[#144664] hover:bg-[#e8f2ff]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="h-[26px] rounded-sm border border-[#6d9dc5] bg-white px-1 text-[12px]"
          >
            <option value="">All modules</option>
            {modules.map((m) => <option key={m.module} value={m.module}>{m.label}</option>)}
          </select>
        </div>

        <DataTable columns={columns} data={rows} loading={loading} storageKey="reback-requests" />
      </div>

      <Dialog open={!!act} onOpenChange={(o) => { if (!o && !busy) setAct(null); }}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b">
            <DialogTitle className="text-[18px] font-semibold">
              {act ? `${VERB[act.kind]} · ${act.row.recordNo}` : ""}
            </DialogTitle>
          </DialogHeader>
          {act && (
            <div className="p-5 space-y-3 text-sm">
              <p className="text-gray-700">
                <b>{act.row.requestedByName}</b>: “{act.row.reason}”
              </p>
              {act.kind === "accept" && (
                <p className="text-gray-600">
                  The approval is undone (accounts / stock entry removed) and {act.row.recordNo} goes back to the
                  creator for correction.
                </p>
              )}
              {act.kind !== "cancel" && (
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={busy}
                  placeholder={needComment ? "Why is it declined? (required)" : "Comment (optional)"}
                  className="w-full h-[80px] resize-none rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-400"
                />
              )}
            </div>
          )}
          <DialogFooter className="border-t px-5 py-4">
            <div className="flex w-full justify-end gap-3">
              <button type="button" disabled={busy} onClick={() => setAct(null)} className="h-[36px] rounded-md border px-4 text-sm hover:bg-gray-50 disabled:opacity-60 cursor-pointer">
                Close
              </button>
              <button
                type="button"
                disabled={busy || (needComment && !comment.trim())}
                onClick={run}
                className="flex h-[36px] min-w-[100px] items-center justify-center gap-2 rounded-md bg-[#0c3472] px-4 text-sm font-medium text-white hover:bg-[#092552] disabled:opacity-60 cursor-pointer"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {act ? VERB[act.kind] : "OK"}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HeaderWrapper>
  );
}
