"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Clock3, User2, CheckCircle2, Circle, Layers } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { WORKFLOW_ACTIONS } from "@/config/workflowAction.config";

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function isDone(status) {
  const s = (status || "").toLowerCase();
  return s !== "not reached" && s !== "pending" && s !== "not_reached" && s !== "";
}

// ── Dot icon for each node ────────────────────────────────────────────────────
function NodeDot({ action, done }) {
  const isFinal = action?.toUpperCase() === "FINAL_APPROVE";
  const config  = WORKFLOW_ACTIONS[action?.toUpperCase()] || WORKFLOW_ACTIONS.DRAFT;
  const Icon    = config?.icon;

  if (!done) {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-yellow-400 bg-white flex items-center justify-center shrink-0 z-10">
        <Circle className="w-3 h-3 text-yellow-400" />
      </div>
    );
  }

  if (isFinal) {
    return (
      <div className="w-8 h-8 rounded-full border border-emerald-200 bg-white flex items-center justify-center shrink-0 z-10 overflow-hidden shadow-sm">
        <Image src={config.image} alt="Final Approved" width={40} height={40} unoptimized className="w-full h-full object-contain scale-[1.2]" />
      </div>
    );
  }

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm ${config.color} text-white`}>
      {Icon && <Icon className="w-4 h-4" />}
    </div>
  );
}

// ── Single timeline node ──────────────────────────────────────────────────────
function TimelineNode({ node, isLast, nextDone }) {
  const isFinal   = node.action?.toUpperCase() === "FINAL_APPROVE";
  const config    = WORKFLOW_ACTIONS[node.action?.toUpperCase()] || WORKFLOW_ACTIONS.DRAFT;
  const badgeClass = node.done
    ? (isFinal ? "bg-emerald-100 text-emerald-700" : config.badge)
    : "bg-yellow-100 text-yellow-700";
  const label = node.done
    ? (isFinal ? "Final Approved" : config.label)
    : "Pending";

  return (
    <div className="relative flex gap-3">
      {/* dot + vertical line */}
      <div className="flex flex-col items-center">
        <NodeDot action={node.action} done={node.done} />
        {!isLast && (
          <div className={`w-[2px] flex-1 min-h-[28px] mt-[3px] mb-[3px] ${node.done && nextDone ? "bg-green-400" : "bg-yellow-300"}`} />
        )}
      </div>

      {/* card */}
      <div className={`pb-4 flex-1 min-w-0 ${isLast ? "pb-1" : ""}`}>
        <div className={`rounded-xl border px-4 py-3 ${node.done ? "bg-white shadow-sm border-gray-200" : "bg-yellow-50 border-yellow-200 border-dashed"}`}>

          {/* ── big screen: one row ── */}
          <div className="hidden sm:flex items-center justify-between gap-3 flex-nowrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {/* level pill — hidden for SUBMIT */}
              {node.level != null && node.action?.toUpperCase() !== "SUBMIT" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded shrink-0">
                  <Layers className="w-3 h-3" />
                  Level {node.level}
                </span>
              )}
              {/* status badge */}
              <span className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap ${badgeClass}`}>
                {label}
              </span>
              {/* by user */}
              {node.by && (
                <div className="flex items-center gap-1 text-[12px] text-gray-500">
                  <User2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>by <span className="font-medium text-gray-700">{node.by}</span></span>
                </div>
              )}
            </div>
            {/* date */}
            {node.at && (
              <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">{formatDate(node.at)}</span>
            )}
          </div>

          {/* ── small screen ── */}
          <div className="flex flex-col gap-1 sm:hidden">
            {/* row 1: level + status badge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {node.level != null && node.action?.toUpperCase() !== "SUBMIT" && (
                <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                  L{node.level}
                </span>
              )}
              <span className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-md ${badgeClass}`}>
                {label}
              </span>
            </div>
            {/* row 2: by + date (both fit comfortably side by side) */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {node.by && (
                <div className="flex items-center gap-1 text-[12px] text-gray-500">
                  <User2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>by <span className="font-medium text-gray-700">{node.by}</span></span>
                </div>
              )}
              {node.at && (
                <span className="text-[11px] text-gray-400 shrink-0">{formatDate(node.at)}</span>
              )}
            </div>
          </div>

          {/* pending hint */}
          {!node.done && (
            <p className="text-[11px] text-yellow-500 italic mt-1.5">Waiting for approval…</p>
          )}

          {/* comments */}
          {node.comments && (
            <div className="mt-2.5 rounded-lg bg-slate-50 border px-3 py-2">
              <p className="text-[12px] text-gray-600 break-words leading-5">{node.comments}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HistoryTimelineSheet({ open, onClose, title = "History", api, entityId }) {
  const [loading, setLoading]           = useState(false);
  const [nodes, setNodes]               = useState([]);
  const [workflowStatus, setWorkflowStatus] = useState("");

  useEffect(() => {
    if (!open || !entityId) return;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({ url: `${api}/${entityId}`, method: "GET" });
        const d = res?.data;

        if (d && !Array.isArray(d) && d.history) {
          // ── history items → done nodes ────────────────────────
          const doneNodes = (d.history || []).map(item => ({
            done:     true,
            action:   item.action,
            level:    item.level ?? null,
            by:       item.actionBy,
            at:       item.createdAt,
            comments: item.comments || null,
          }));

          // levels already covered by history
          const coveredLevels = new Set((d.history || []).map(h => h.level));

          // ── pending approvalSteps not yet in history → pending nodes ──
          const pendingNodes = (d.approvalSteps || [])
            .filter(s => !isDone(s.status) && !coveredLevels.has(s.level))
            .sort((a, b) => a.level - b.level)
            .map(s => ({
              done:     false,
              action:   null,
              level:    s.level,
              by:       s.approver?.username || null,
              at:       null,
              comments: null,
            }));

          setNodes([...doneNodes, ...pendingNodes]);
          setWorkflowStatus(d.workflowStatus || "");

        } else {
          // old flat-array fallback
          const arr = Array.isArray(d) ? d : [];
          setNodes(arr.map(item => ({
            done:     true,
            action:   item.action,
            level:    item.level ?? null,
            by:       item.actionBy,
            at:       item.createdAt,
            comments: item.comments || null,
          })));
          setWorkflowStatus("");
        }
      } catch (err) {
        toast.error(err?.message || "Failed to fetch history");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, api, entityId]);

  const formatWorkflowStatus = (s) => {
    const m = s?.match(/^Pending_L(\d+)$/i);
    return m ? `Pending at Level ${m[1]}` : s?.replace(/_/g, " ") || s;
  };

  const statusBadge =
    workflowStatus === "Approved"  ? "bg-green-100 text-green-700 border-green-200"     :
    workflowStatus === "Rejected"  ? "bg-red-100 text-red-700 border-red-200"           :
    workflowStatus === "Reback"    ? "bg-yellow-100 text-yellow-700 border-yellow-200"  :
    workflowStatus              ? "bg-blue-100 text-blue-700 border-blue-200"        : "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[580px] p-0 flex flex-col overflow-hidden gap-0 max-h-[90dvh]">

        {/* header */}
        <div className="min-h-[56px] pl-5 pr-10 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b bg-[#e8f2ff] shrink-0">
          <DialogTitle className="text-[18px] font-semibold">{title}</DialogTitle>
          {workflowStatus && (
            <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${statusBadge}`}>
              {formatWorkflowStatus(workflowStatus)}
            </span>
          )}
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-5 py-5">
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : nodes.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-gray-400 gap-3">
                <Clock3 className="w-10 h-10" />
                <p className="text-sm">No history yet</p>
              </div>
            ) : (
              nodes.map((node, idx) => (
                <TimelineNode
                  key={idx}
                  node={node}
                  isLast={idx === nodes.length - 1}
                  nextDone={nodes[idx + 1]?.done ?? true}
                />
              ))
            )}
          </div>
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t bg-white shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="h-[36px] px-5 rounded-md border text-sm font-medium hover:bg-gray-50 cursor-pointer"
          >
            Close
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
