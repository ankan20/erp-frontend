"use client";

// Sale Order amendments: extra items on an Approved order.
// Renders a compact "Amendments" button (placed beside the order's Items
// header). Hover shows a quick list; click opens a side drawer with the full
// amendment history (Original → AMD-1 → AMD-2 …), which lets a Sale Order
// creator raise / edit / submit / delete an amendment, and lets the current
// approver approve / reback / reject it. On final approval the backend adds the
// lines to the order (tagged AMD-n) — the order form above is then reloaded.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FilePlus2, ChevronRight, Pencil, Send, Trash2, Plus, Loader2, History, ShieldCheck, Paperclip, Undo2, Layers, X,
} from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ApprovalActionModal  from "@/components/common/ApprovalActionModal";
import HistoryTimelineSheet from "@/components/common/HistoryTimelineSheet";
import { apiRequest }       from "@/lib/apiClient";
import { API_ENDPOINTS }    from "@/config/api.config";
import { formatAmount }     from "@/helper/numberFormatter";

const EP = API_ENDPOINTS.PROJECT.OG_SALE_ORDER;

const dmy = (s) => (/^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10).split("-").reverse().join("-") : s || "");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const num = (v) => Number(String(v ?? "").replace(/,/g, "")) || 0;
const isOpen = (s) => s === "Draft" || s === "Reback" || String(s || "").startsWith("Pending");

const STATUS_CLS = (s) =>
  s === "Approved" ? "bg-green-50 text-green-700 border-green-200"
    : s === "Rejected" ? "bg-red-50 text-red-700 border-red-200"
      : s === "Reback" ? "bg-amber-50 text-amber-800 border-amber-200"
        : String(s).startsWith("Pending") ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-gray-100 text-gray-700 border-gray-200";

// ── highlight lines in the order's Items table (rows carry data-so-line / data-amd) ──
// Inline styles (not classes): the cells and inputs have their own backgrounds.
const HL = { outline: "2px solid #9333ea", tint: "#f3e8ff" };       // all lines of an amendment
const HL_ONE = { outline: "3px solid #f59e0b", tint: "#fef3c7" };   // one line
function highlightLines(selector, on, look = HL) {
  if (typeof document === "undefined") return;
  const rows = document.querySelectorAll(selector);
  rows.forEach((row) => {
    // a <tr> outline is not painted in a border-collapse table → style the cells
    const cells = [...row.children];
    cells.forEach((td, i) => {
      td.style.borderTop = on ? look.outline : "";
      td.style.borderBottom = on ? look.outline : "";
      if (i === 0) td.style.borderLeft = on ? look.outline : "";
      if (i === cells.length - 1) td.style.borderRight = on ? look.outline : "";
      td.style.backgroundColor = on ? look.tint : "";
      td.querySelectorAll("input, select, textarea").forEach((c) => { c.style.backgroundColor = on ? look.tint : ""; });
    });
  });
  if (on && rows[0]) rows[0].scrollIntoView({ block: "nearest", behavior: "smooth" });
}
const clearHighlights = () => highlightLines("[data-so-line]", false);

const hlAmd = (label, on) => {
  if (!label) return;
  if (typeof document !== "undefined") document.body.dataset.hlAmd = on ? label : "";
  highlightLines(`[data-amd="${label}"]`, on);
};
const hlLine = (type, slNo, on) => {
  if (!slNo) return;
  highlightLines(`[data-so-line="${type}-${slNo}"]`, on, HL_ONE);
  // back to the amendment-wide highlight when leaving the single line
  if (!on) {
    const row = document.querySelector(`[data-so-line="${type}-${slNo}"]`);
    const amd = row?.getAttribute("data-amd");
    if (amd && row.closest("body")?.dataset.hlAmd === amd) highlightLines(`[data-so-line="${type}-${slNo}"]`, true);
  }
};

const EMPTY_LINE = { type: "non-boq", itemCode: "", itemName: "", itemDescription: "", unit: "", orderQty: "", rate: "", gstPercent: "" };

export function AmdBadge({ label, className = "" }) {
  if (!label) return null;
  return (
    <span title={`Added by amendment ${label}`}
      className={`inline-flex items-center whitespace-nowrap rounded px-1 py-[1px] text-[10px] font-semibold leading-none bg-purple-100 text-purple-700 border border-purple-200 align-middle ${className}`}>
      {label}
    </span>
  );
}

export default function SaleOrderAmendments({ saleOrderId, onOrderChanged }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState({});
  const [editor,   setEditor]   = useState(null);   // null | { mode: "create" | "edit", amd? }
  const [busyId,   setBusyId]   = useState(null);
  const [pending,  setPending]  = useState({});     // amendment id → { isPendingForMe, myLevel }
  const [approve,  setApprove]  = useState(null);   // amendment being approved
  const [timeline, setTimeline] = useState(null);   // amendment id
  const [drawer,   setDrawer]   = useState(false);
  const [peek,     setPeek]     = useState(false);   // hover preview
  const [pos,      setPos]      = useState(() => {   // floating box position (dragged by its header, remembered)
    try { return JSON.parse(localStorage.getItem("soAmdBoxPos") || "null"); } catch { return null; }
  });

  const startDrag = (e) => {
    if (e.button !== 0 || e.target.closest("button, a, input")) return;
    const box = e.currentTarget.parentElement.getBoundingClientRect();
    const dx = e.clientX - box.left, dy = e.clientY - box.top;
    let last = null;
    const move = (ev) => {
      last = {
        x: Math.min(Math.max(ev.clientX - dx, 8), window.innerWidth - 160),
        y: Math.min(Math.max(ev.clientY - dy, 8), window.innerHeight - 60),
      };
      setPos(last);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (last) { try { localStorage.setItem("soAmdBoxPos", JSON.stringify(last)); } catch { /* ignore */ } }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    e.preventDefault();
  };
  const resetPos = () => { setPos(null); try { localStorage.removeItem("soAmdBoxPos"); } catch { /* ignore */ } };

  const load = useCallback(async () => {
    if (!saleOrderId) return;
    try {
      const r = await apiRequest({ url: `${EP.AMENDMENTS_OF}/${saleOrderId}/amendments`, method: "GET" });
      const d = r.data;
      setData(d);
      // who can approve the pending ones
      const pend = (d.amendments || []).filter((a) => String(a.workflowStatus).startsWith("Pending"));
      const entries = await Promise.all(pend.map((a) =>
        apiRequest({ url: `${EP.AMENDMENT_MY_STATUS}/${a.id}`, method: "GET" })
          .then((x) => [a.id, x.data]).catch(() => [a.id, null])));
      setPending(Object.fromEntries(entries));
      setOpen((p) => {
        const n = { ...p };
        (d.amendments || []).forEach((a) => { if (n[a.id] === undefined) n[a.id] = isOpen(a.workflowStatus); });
        return n;
      });
    } catch {
      setData(null);
    } finally { setLoading(false); }
  }, [saleOrderId]);

  useEffect(() => { load(); }, [load]);

  const refreshAll = () => { load(); onOrderChanged?.(); };

  // never leave a line highlighted when the box / preview closes or this unmounts
  useEffect(() => { if (!drawer && !peek) clearHighlights(); }, [drawer, peek]);
  useEffect(() => clearHighlights, []);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !editor && !approve && !timeline) setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, editor, approve, timeline]);

  const openDrawer = (focusId) => {
    setPeek(false);
    if (focusId) setOpen((p) => ({ ...p, [focusId]: true }));
    setDrawer(true);
  };

  const submit = async (a) => {
    setBusyId(a.id);
    try {
      const r = await apiRequest({ url: `${EP.AMENDMENT_SUBMIT}/${a.id}`, method: "POST" });
      toast.success(r.message || "Submitted");
      refreshAll();
    } catch (e) { toast.error(e?.message || "Submit failed"); }
    finally { setBusyId(null); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete ${a.label}? This cannot be undone.`)) return;
    setBusyId(a.id);
    try {
      const r = await apiRequest({ url: `${EP.AMENDMENT}/${a.id}`, method: "DELETE" });
      toast.success(r.message || "Deleted");
      load();
    } catch (e) { toast.error(e?.message || "Delete failed"); }
    finally { setBusyId(null); }
  };

  const askReback = async (a) => {
    const reason = window.prompt(`Why should ${a.label} be sent back? Its items will be taken out of the Sale Order once accepted.`);
    if (!reason || !reason.trim()) return;
    setBusyId(a.id);
    try {
      const r = await apiRequest({
        url: API_ENDPOINTS.WORKFLOW.REBACK_REQUESTS, method: "POST",
        data: { module: "og_sale_order_amendment", id: a.id, reason: reason.trim(),
                pageUrl: `/project-management/contacts/sale-order/${saleOrderId}` },
      });
      toast.success(r.message || "Reback request sent to the final approver");
    } catch (e) { toast.error(e?.message || "Could not raise the request"); }
    finally { setBusyId(null); }
  };

  if (loading || !data) return null;
  const amds = data.amendments || [];
  if (!amds.length && !data.canAmend && data.workflowStatus !== "Approved") return null;
  const approvedCount = amds.filter((a) => a.workflowStatus === "Approved").length;
  const openAmd = amds.find((a) => isOpen(a.workflowStatus));
  const forMe = amds.some((a) => pending[a.id]?.isPendingForMe);

  return (
    <>
      {/* ── trigger (beside the Items header) + hover preview ── */}
      <div className="relative inline-block" onMouseEnter={() => setPeek(true)} onMouseLeave={() => setPeek(false)}>
        <button type="button" onClick={() => openDrawer()}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[#7c9cc4] bg-white text-[12.5px] font-semibold text-[#1e3a5f] hover:bg-[#edf4fb]"
          aria-haspopup="dialog" title="Amendments of this order">
          <Layers className="w-4 h-4" />
          Amendments
          {approvedCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[10.5px] leading-[18px] text-center">{approvedCount}</span>
          )}
          {openAmd && (
            <span className={`w-2 h-2 rounded-full ${forMe ? "bg-red-500 animate-pulse" : "bg-amber-500"}`}
              title={forMe ? "Waiting for your approval" : `${openAmd.label} is ${openAmd.workflowStatus}`} />
          )}
        </button>

        {peek && (
          <div className="absolute right-0 top-full z-40 pt-1.5">
            <div className="w-[340px] rounded-lg border border-[#c4d1df] bg-white shadow-xl text-[12px] font-normal">
              <div className="px-3 py-2 border-b bg-[#f5f8fc] rounded-t-lg text-gray-700">
                Original ₹ {formatAmount(data.originalTotal)}
                {approvedCount > 0 && <> → now <b>₹ {formatAmount(data.currentTotal)}</b></>}
              </div>
              <div className="max-h-[240px] overflow-y-auto divide-y">
                {amds.length === 0 && <div className="px-3 py-2 text-gray-500">No amendments yet.</div>}
                {amds.map((a) => (
                  <button key={a.id} type="button" onClick={() => openDrawer(a.id)}
                    onMouseEnter={() => hlAmd(a.label, true)} onMouseLeave={() => hlAmd(a.label, false)}
                    title="Click to open · its lines are highlighted in Items"
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#edf4fb]">
                    <AmdBadge label={a.label} />
                    <span className="truncate flex-1 text-gray-700" title={a.reason}>{a.reason}</span>
                    <span className="tabular-nums text-gray-800">+{formatAmount(a.totalAmount)}</span>
                    <span className={`text-[10.5px] px-1 rounded border ${STATUS_CLS(a.workflowStatus)}`}>{a.workflowStatus}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border-t">
                <button type="button" onClick={() => openDrawer()} className="text-blue-600 hover:underline">Open amendments</button>
                {data.canAmend && (
                  <button type="button" onClick={() => { setPeek(false); setEditor({ mode: "create" }); }}
                    className="ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[#1e3a5f] text-white hover:bg-[#2a5080]">
                    <FilePlus2 className="w-3.5 h-3.5" /> Amend
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── floating box: only as tall as its content, scrolls inside; the page stays
          visible and usable around it. Closes with ✕ or Esc. ── */}
      {drawer && (
        <div role="dialog" aria-label={`Amendments of ${data.ogSaleOrderNo}`}
          style={pos ? { left: pos.x, top: pos.y, right: "auto", maxHeight: `calc(100vh - ${pos.y + 16}px)` } : undefined}
          className="fixed z-40 right-4 top-[120px] w-[min(760px,calc(100vw-2rem))] max-h-[calc(100vh-150px)] flex flex-col
                     rounded-xl border border-[#9fb6d4] bg-white shadow-2xl animate-in fade-in-0 slide-in-from-right-4 duration-150">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b bg-[#edf4fb] rounded-t-xl cursor-move select-none"
        onMouseDown={startDrag} onDoubleClick={resetPos} title="Drag to move · double-click to put it back">
        <Layers className="w-4 h-4 text-[#1e3a5f]" />
        <span className="text-[14px] font-semibold text-[#1e3a5f]">Amendments · {data.ogSaleOrderNo}</span>
        <span className="text-[12px] text-gray-600">
          Original {data.originalDate ? `(${dmy(data.originalDate)})` : ""} ₹ {formatAmount(data.originalTotal)}
          {amds.some((a) => a.workflowStatus === "Approved") && <> → now <b>₹ {formatAmount(data.currentTotal)}</b></>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!data.canAmend && data.cannotAmendReason && data.isCreator && (
            <span className="text-[11.5px] text-gray-500">{data.cannotAmendReason}</span>
          )}
          {data.canAmend && (
            <button type="button" onClick={() => setEditor({ mode: "create" })}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1e3a5f] text-white text-[12.5px] font-medium hover:bg-[#2a5080]">
              <FilePlus2 className="w-4 h-4" /> Amend (add items)
            </button>
          )}
          <button type="button" onClick={() => setDrawer(false)} title="Close (Esc)"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-contain">
      {amds.length === 0 ? (
        <div className="px-3 py-4 text-[12.5px] text-gray-500">
          No amendments yet. Use <b>Amend</b> to add extra items to this approved order. They go through the same approval, and
          once approved they are added at the end of the order, marked <AmdBadge label="AMD-1" />, and show up in the next bills.
        </div>
      ) : (
        <div className="divide-y">
          {amds.map((a) => {
            const pend = pending[a.id];
            const canEdit = data.isCreator && (a.workflowStatus === "Draft" || a.workflowStatus === "Reback");
            return (
              <div key={a.id} className="px-3 py-2 hover:bg-[#fafcfe]"
                onMouseEnter={() => hlAmd(a.label, true)} onMouseLeave={() => hlAmd(a.label, false)}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <button type="button" onClick={() => setOpen((p) => ({ ...p, [a.id]: !p[a.id] }))}
                    className="flex items-center gap-1.5" aria-expanded={!!open[a.id]}>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open[a.id] ? "rotate-90" : ""}`} />
                    <AmdBadge label={a.label} className="text-[11px]" />
                  </button>
                  <span className="text-[12.5px] text-gray-700">{dmy(a.amendmentDate)}</span>
                  <span className="text-[12.5px] text-gray-800 truncate max-w-[320px]" title={a.reason}>{a.reason}</span>
                  {a.customerRef && <span className="text-[12px] text-gray-500">Ref: {a.customerRef}</span>}
                  <span className="text-[12px] text-gray-500">{a.itemCount} item{a.itemCount === 1 ? "" : "s"}</span>
                  <span className="text-[12.5px] font-medium tabular-nums">+ ₹ {formatAmount(a.totalAmount)}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border ${STATUS_CLS(a.workflowStatus)}`}>{a.workflowStatus}</span>
                  {a.attachment && (
                    <a href={a.attachment} target="_blank" rel="noreferrer" className="text-[12px] text-blue-600 inline-flex items-center gap-0.5 hover:underline">
                      <Paperclip className="w-3.5 h-3.5" /> letter
                    </a>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    {pend?.isPendingForMe && (
                      <button type="button" onClick={() => setApprove(a)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-green-600 text-white text-[12px] hover:bg-green-700">
                        <ShieldCheck className="w-3.5 h-3.5" /> Approve / Reback / Reject
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <button type="button" onClick={() => setEditor({ mode: "edit", amd: a })} disabled={busyId === a.id}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button type="button" onClick={() => submit(a)} disabled={busyId === a.id}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-blue-600 text-white text-[12px] hover:bg-blue-700 disabled:opacity-40">
                          {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Submit
                        </button>
                        <button type="button" onClick={() => remove(a)} disabled={busyId === a.id} title="Delete amendment"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {a.workflowStatus === "Approved" && (
                      <button type="button" onClick={() => askReback(a)} disabled={busyId === a.id}
                        title="Ask the final approver to send this amendment back (its items come out of the order)"
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-40">
                        <Undo2 className="w-4 h-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => setTimeline(a.id)} title="Approval history"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100">
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {open[a.id] && (
                  <div className="mt-2 ml-6 space-y-1.5">
                    <div className="text-[11.5px] text-gray-500 flex flex-wrap gap-x-4">
                      <span>Raised by {a.createdBy || "—"} on {dmy(a.createdAt)}</span>
                      {a.submittedAt && <span>Submitted {dmy(a.submittedAt)}</span>}
                      {a.workflowStatus === "Approved" && (
                        <span className="text-green-700">
                          Approved by {a.approvedBy || "—"} on {dmy(a.finalApprovedAt)} · order ₹ {formatAmount(a.orderTotalBefore)} → ₹ {formatAmount(a.orderTotalAfter)}
                        </span>
                      )}
                      {a.workflowStatus === "Rejected" && <span className="text-red-600">Rejected by {a.rejectedBy || "—"} on {dmy(a.rejectedAt)} — nothing was added</span>}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px] min-w-[760px] border border-[#e2e8f0]">
                        <thead className="bg-[#f5f8fc] text-gray-600">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium w-10">#</th>
                            <th className="px-2 py-1 text-left font-medium w-20">Type</th>
                            <th className="px-2 py-1 text-left font-medium w-20">Code</th>
                            <th className="px-2 py-1 text-left font-medium">Item</th>
                            <th className="px-2 py-1 text-left font-medium w-14">Unit</th>
                            <th className="px-2 py-1 text-right font-medium w-20">Qty</th>
                            <th className="px-2 py-1 text-right font-medium w-24">Rate</th>
                            <th className="px-2 py-1 text-right font-medium w-14">GST %</th>
                            <th className="px-2 py-1 text-right font-medium w-28">Amount</th>
                            <th className="px-2 py-1 text-left font-medium w-24">In order as</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(a.items || []).map((i) => (
                            <tr key={i.id} className="border-t border-[#e2e8f0] hover:bg-purple-50"
                              onMouseEnter={() => hlLine(i.type, i.orderSlNo, true)}
                              onMouseLeave={() => hlLine(i.type, i.orderSlNo, false)}>
                              <td className="px-2 py-1 text-gray-500">{i.slNo}</td>
                              <td className="px-2 py-1">{i.type === "boq" ? "BOQ" : "Non-BOQ"}</td>
                              <td className="px-2 py-1">{i.itemCode}</td>
                              <td className="px-2 py-1">
                                <div>{i.itemName}</div>
                                {i.itemDescription && <div className="text-gray-500">{i.itemDescription}</div>}
                              </td>
                              <td className="px-2 py-1">{i.unit}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{i.orderQty}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{formatAmount(i.rate)}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{i.gstPercent}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{formatAmount(i.amount + i.gstAmount)}</td>
                              <td className="px-2 py-1 text-gray-600">
                                {i.orderSlNo ? `${i.type === "boq" ? "BOQ" : "Non-BOQ"} Sl. ${i.orderSlNo}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#e2e8f0] bg-[#fafcfe]">
                            <td colSpan={8} className="px-2 py-1 text-right text-gray-600">
                              Basic ₹ {formatAmount(a.basicAmount)} · GST ₹ {formatAmount(a.gstAmount)} · Total
                            </td>
                            <td className="px-2 py-1 text-right font-semibold tabular-nums">{formatAmount(a.totalAmount)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
        </div>
      )}

      {editor && (
        <AmendmentEditor
          saleOrderId={saleOrderId}
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); load(); }}
        />
      )}

      <ApprovalActionModal
        open={!!approve}
        onClose={() => setApprove(null)}
        payload={{ id: approve?.id }}
        pendingInfo={approve ? pending[approve.id] : null}
        actions={[
          { type: "approve", api: EP.AMENDMENT_APPROVE },
          { type: "reback",  api: EP.AMENDMENT_REBACK },
          { type: "reject",  api: EP.AMENDMENT_REJECT },
        ]}
        onSuccess={() => { setApprove(null); refreshAll(); }}
      />

      <HistoryTimelineSheet
        open={!!timeline}
        onClose={() => setTimeline(null)}
        title="Amendment Approve History"
        api={EP.AMENDMENT_HISTORY}
        entityId={timeline}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════

function AmendmentEditor({ saleOrderId, editor, onClose, onSaved }) {
  const amd = editor.amd;
  const [date,     setDate]     = useState(amd?.amendmentDate?.slice(0, 10) || todayIso());
  const [reason,   setReason]   = useState(amd?.reason || "");
  const [ref,      setRef]      = useState(amd?.customerRef || "");
  const [file,     setFile]     = useState(null);
  const [lines,    setLines]    = useState(
    amd?.items?.length
      ? amd.items.map((i) => ({ type: i.type, itemCode: i.itemCode || "", itemName: i.itemName || "", itemDescription: i.itemDescription || "",
          unit: i.unit || "", orderQty: String(i.orderQty ?? ""), rate: String(i.rate ?? ""), gstPercent: String(i.gstPercent ?? "") }))
      : [{ ...EMPTY_LINE }],
  );
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(null);     // the order's lines as they are now
  const [hoverRow, setHoverRow] = useState(null);   // current item under the mouse → details strip

  useEffect(() => {
    apiRequest({ url: `${EP.GET_BY_ID}${saleOrderId}`, method: "GET" })
      .then((r) => {
        const d = r.data || {};
        setCurrent({
          rows: [
            ...(d.items || []).map((i) => ({ ...i, type: "non-boq" })),
            ...(d.boqItems || []).map((i) => ({ ...i, type: "boq" })),
          ],
          basic: d.basicAmount, gst: d.gstAmount, total: d.totalAmount,
        });
      })
      .catch(() => setCurrent({ rows: [], error: true }));
  }, [saleOrderId]);

  // same code / name already on the order → show where
  const existingKey = (t, v) => `${t}|${String(v || "").trim().toLowerCase()}`;
  const existing = {};
  (current?.rows || []).forEach((r) => {
    if (r.itemCode) existing[existingKey("c", r.itemCode)] = r;
    if (r.itemName) existing[existingKey("n", r.itemName)] = r;
  });
  const dupOf = (l) => (l.itemCode && existing[existingKey("c", l.itemCode)]) || (l.itemName && existing[existingKey("n", l.itemName)]) || null;

  const addFrom = (r) => setLines((p) => {
    const blank = p.length === 1 && !p[0].itemName.trim() && !p[0].itemCode.trim();
    const line = { type: r.type, itemCode: r.itemCode || "", itemName: r.itemName || "", itemDescription: r.itemDescription || "",
                   unit: r.unit || "", orderQty: "", rate: String(r.rate ?? ""), gstPercent: String(r.gstPercent ?? "") };
    return blank ? [line] : [...p, line];
  });

  const setLine = (idx, k, v) => setLines((p) => p.map((l, j) => (j === idx ? { ...l, [k]: v } : l)));
  const basic = lines.reduce((s, l) => s + num(l.orderQty) * num(l.rate), 0);
  const gst = lines.reduce((s, l) => s + (num(l.orderQty) * num(l.rate) * num(l.gstPercent)) / 100, 0);

  const save = async (andSubmit) => {
    if (!date) { toast.error("Amendment Date is required"); return; }
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    const filled = lines.filter((l) => l.itemName.trim() || l.itemCode.trim());
    if (!filled.length) { toast.error("Add at least one item"); return; }
    const bad = filled.findIndex((l) => !l.itemName.trim() || num(l.orderQty) <= 0 || num(l.gstPercent) > 100);
    if (bad >= 0) { toast.error(`Item ${bad + 1}: name, Qty > 0 and GST % up to 100 are needed`); return; }

    const fd = new FormData();
    fd.append("amendmentDate", date);
    fd.append("reason", reason.trim());
    fd.append("customerRef", ref.trim());
    fd.append("items", JSON.stringify(filled));
    if (file) fd.append("attachment", file);

    setSaving(true);
    try {
      const r = await apiRequest({
        url: editor.mode === "create" ? `${EP.AMENDMENT_CREATE}/${saleOrderId}/amendment/create` : `${EP.AMENDMENT_EDIT}/${amd.id}`,
        method: editor.mode === "create" ? "POST" : "PUT",
        data: fd,
      });
      const id = r?.data?.id || amd?.id;
      if (andSubmit && id) {
        const s = await apiRequest({ url: `${EP.AMENDMENT_SUBMIT}/${id}`, method: "POST" });
        toast.success(s.message || "Submitted for approval");
      } else {
        toast.success(r.message || "Saved as Draft");
      }
      onSaved();
    } catch (e) {
      toast.error(e?.message || "Could not save");
    } finally { setSaving(false); }
  };

  const inp = "h-8 w-full border border-gray-300 rounded px-2 text-[12.5px] outline-none focus:ring-1 focus:ring-blue-300 bg-white";

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-[min(1560px,97vw)] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editor.mode === "create" ? "Amend Sale Order — add items" : `Edit ${amd.label}`}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="text-[12px] text-gray-600">Amendment Date *
            <input type="date" className={`${inp} mt-0.5`} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-[12px] text-gray-600">Customer Amendment Ref
            <input className={`${inp} mt-0.5`} value={ref} maxLength={100} placeholder="Letter / revised PO no." onChange={(e) => setRef(e.target.value)} />
          </label>
          <label className="text-[12px] text-gray-600 sm:col-span-2">Attachment (client&apos;s letter)
            <input type="file" className="block mt-1 text-[12px]" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {amd?.attachment && !file && <a href={amd.attachment} target="_blank" rel="noreferrer" className="text-[11.5px] text-blue-600 hover:underline">current file</a>}
          </label>
          <label className="text-[12px] text-gray-600 sm:col-span-4">Reason *
            <textarea className="w-full border border-gray-300 rounded px-2 py-1 text-[12.5px] mt-0.5 outline-none focus:ring-1 focus:ring-blue-300" rows={2}
              value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are these items being added?" />
          </label>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,5fr)_minmax(0,9fr)] gap-3 mt-1">
          {/* LEFT: what the order has now */}
          <div className="rounded-lg border border-[#c4d1df] bg-[#fafcfe] flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b bg-[#edf4fb] rounded-t-lg">
              <span className="text-[12.5px] font-semibold text-[#1e3a5f]">Current order items</span>
              <span className="text-[11.5px] text-gray-500">{current ? `${current.rows.length} lines` : "loading…"}</span>
              {current && !current.error && <span className="ml-auto text-[11.5px] text-gray-700 tabular-nums">₹ {formatAmount(current.total)}</span>}
            </div>
            <div className="overflow-auto max-h-[52vh]">
              <table className="w-full text-[11.5px]">
                <thead className="sticky top-0 bg-[#f1f5fa] text-gray-600 z-10">
                  <tr>
                    <th className="px-1.5 py-1 text-left font-medium w-10">Sl</th>
                    <th className="px-1.5 py-1 text-left font-medium">Item</th>
                    <th className="px-1.5 py-1 text-right font-medium w-16">Qty</th>
                    <th className="px-1.5 py-1 text-right font-medium w-20">Rate</th>
                    <th className="px-1.5 py-1 text-right font-medium w-12">GST</th>
                    <th className="w-7" />
                  </tr>
                </thead>
                <tbody>
                  {(current?.rows || []).map((r) => (
                    <tr key={`${r.type}-${r.id}`}
                      onMouseEnter={() => setHoverRow(r)} onMouseLeave={() => setHoverRow((h) => (h === r ? null : h))}
                      className={`border-t border-[#e2e8f0] align-top cursor-default ${hoverRow === r ? "bg-blue-50" : "hover:bg-white"}`}>
                      <td className="px-1.5 py-1 text-gray-500 whitespace-nowrap">
                        {r.type === "boq" ? "B" : "N"}{r.slNo}
                        {r.amendmentNo && <div><AmdBadge label={r.amendmentNo} /></div>}
                      </td>
                      <td className="px-1.5 py-1">
                        <div className="text-gray-800">{r.itemCode ? <span className="text-gray-500">{r.itemCode} · </span> : null}{r.itemName}</div>
                        <div className="text-gray-400">{r.type === "boq" ? "BOQ" : "Non-BOQ"}{r.unit ? ` · ${r.unit}` : ""}</div>
                      </td>
                      <td className="px-1.5 py-1 text-right tabular-nums">{r.orderQty}</td>
                      <td className="px-1.5 py-1 text-right tabular-nums">{formatAmount(r.rate)}</td>
                      <td className="px-1.5 py-1 text-right tabular-nums">{r.gstPercent}%</td>
                      <td className="px-1 py-0.5">
                        <button type="button" onClick={() => addFrom(r)} title="Add a new line like this one (enter the extra qty)"
                          className="h-6 w-6 inline-flex items-center justify-center rounded text-blue-600 hover:bg-blue-50">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {current?.error && <tr><td colSpan={6} className="px-2 py-2 text-red-600">Could not load the order items.</td></tr>}
                </tbody>
              </table>
            </div>
            {/* details of the hovered line (fixed height so the list doesn't jump) */}
            <div className="px-2.5 py-1.5 border-t text-[11.5px] min-h-[52px] bg-white rounded-b-lg">
              {hoverRow ? (
                <div className="space-y-0.5">
                  <div className="text-gray-800">
                    <b>{hoverRow.type === "boq" ? "BOQ" : "Non-BOQ"} Sl. {hoverRow.slNo}</b>
                    {hoverRow.itemCode ? ` · ${hoverRow.itemCode}` : ""} · {hoverRow.itemName}
                    {hoverRow.amendmentNo && <> <AmdBadge label={hoverRow.amendmentNo} /></>}
                  </div>
                  {hoverRow.itemDescription && <div className="text-gray-500 line-clamp-2">{hoverRow.itemDescription}</div>}
                  <div className="text-gray-600 tabular-nums">
                    {hoverRow.orderQty} {hoverRow.unit || ""} × ₹ {formatAmount(hoverRow.rate)} = ₹ {formatAmount(hoverRow.amount)}
                    {" "}+ GST {hoverRow.gstPercent}% ₹ {formatAmount(hoverRow.gstAmount)}
                    {" "}→ <b>₹ {formatAmount(num(hoverRow.amount) + num(hoverRow.gstAmount))}</b>
                  </div>
                </div>
              ) : (
                <span className="text-gray-500">
                  Hover a line for its full details. Use <Plus className="w-3 h-3 inline" /> to start a new line from it. Existing lines are never changed.
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: the new lines */}
          <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-[#1e3a5f] mb-1">New items in this amendment</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[880px]">
            <thead className="bg-[#1e3a5f] text-white">
              <tr>
                <th className="px-1.5 py-1.5 w-8">#</th>
                <th className="px-1.5 py-1.5 w-28 text-left">Type</th>
                <th className="px-1.5 py-1.5 w-24 text-left">Item Code</th>
                <th className="px-1.5 py-1.5 text-left min-w-[180px]">Item Name *</th>
                <th className="px-1.5 py-1.5 text-left w-48">Description</th>
                <th className="px-1.5 py-1.5 w-16 text-left">Unit</th>
                <th className="px-1.5 py-1.5 w-20 text-right">Qty *</th>
                <th className="px-1.5 py-1.5 w-24 text-right">Rate</th>
                <th className="px-1.5 py-1.5 w-16 text-right">GST %</th>
                <th className="px-1.5 py-1.5 w-28 text-right">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const b = num(l.orderQty) * num(l.rate);
                const dup = dupOf(l);
                return [
                  <tr key={idx} className={idx % 2 ? "bg-[#f5f8fc]" : "bg-white"}>
                    <td className="px-1.5 text-center text-gray-500">{idx + 1}</td>
                    <td className="px-1 py-0.5">
                      <select className={inp} value={l.type} onChange={(e) => setLine(idx, "type", e.target.value)}>
                        <option value="non-boq">Non-BOQ</option>
                        <option value="boq">BOQ</option>
                      </select>
                    </td>
                    <td className="px-1 py-0.5"><input className={inp} value={l.itemCode} onChange={(e) => setLine(idx, "itemCode", e.target.value)} /></td>
                    <td className="px-1 py-0.5"><input className={inp} value={l.itemName} onChange={(e) => setLine(idx, "itemName", e.target.value)} /></td>
                    <td className="px-1 py-0.5"><input className={inp} value={l.itemDescription} onChange={(e) => setLine(idx, "itemDescription", e.target.value)} /></td>
                    <td className="px-1 py-0.5"><input className={inp} value={l.unit} onChange={(e) => setLine(idx, "unit", e.target.value)} /></td>
                    <td className="px-1 py-0.5"><input className={`${inp} text-right`} inputMode="decimal" value={l.orderQty} onChange={(e) => setLine(idx, "orderQty", e.target.value)} /></td>
                    <td className="px-1 py-0.5"><input className={`${inp} text-right`} inputMode="decimal" value={l.rate} onChange={(e) => setLine(idx, "rate", e.target.value)} /></td>
                    <td className="px-1 py-0.5"><input className={`${inp} text-right`} inputMode="decimal" value={l.gstPercent} onChange={(e) => setLine(idx, "gstPercent", e.target.value)} /></td>
                    <td className="px-1.5 text-right tabular-nums">{formatAmount(b + (b * num(l.gstPercent)) / 100)}</td>
                    <td className="px-1">
                      <button type="button" disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((_, j) => j !== idx))}
                        className="h-7 w-7 inline-flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30" title="Remove line">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>,
                  dup ? (
                    <tr key={`${idx}d`} className={idx % 2 ? "bg-[#f5f8fc]" : "bg-white"}>
                      <td />
                      <td colSpan={10} className="px-1.5 pb-1 text-[11px] text-amber-700">
                        Already on the order as {dup.type === "boq" ? "BOQ" : "Non-BOQ"} Sl. {dup.slNo}
                        {dup.amendmentNo ? ` (${dup.amendmentNo})` : ""}: qty {dup.orderQty} @ {formatAmount(dup.rate)}. This adds a separate line.
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setLines((p) => [...p, { ...EMPTY_LINE, type: p[p.length - 1]?.type || "non-boq" }])}
            className="inline-flex items-center gap-1 text-[12.5px] text-blue-600 hover:underline">
            <Plus className="w-3.5 h-3.5" /> Add item
          </button>
          <span className="ml-auto text-[12.5px] text-gray-700 tabular-nums">
            Basic ₹ {formatAmount(basic)} · GST ₹ {formatAmount(gst)} · <b>Adds ₹ {formatAmount(basic + gst)}</b>
          </span>
        </div>
        <p className="text-[11.5px] text-gray-500">
          After final approval these items are added at the end of the order, marked with the amendment number.
        </p>
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={onClose} disabled={saving}
            className="h-9 px-4 rounded-md border text-[13px] text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => save(false)} disabled={saving}
            className="h-9 px-4 rounded-md border border-[#1e3a5f] text-[13px] text-[#1e3a5f] hover:bg-[#edf4fb] disabled:opacity-50">
            Save as Draft
          </button>
          <button type="button" onClick={() => save(true)} disabled={saving}
            className="h-9 px-4 rounded-md bg-[#1e3a5f] text-white text-[13px] hover:bg-[#2a5080] disabled:opacity-50 inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Save &amp; Submit
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
