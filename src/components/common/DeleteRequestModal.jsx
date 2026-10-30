"use client";

/**
 * DeleteRequestModal
 *
 * Shown by DeleteRequestButton after a check call.
 * Handles three states:
 *   1. can_delete_now: true  — confirms immediate delete (parent handles actual API)
 *   2. can_delete_now: false — shows blockers + reason input → raises delete request via WA
 *   3. pending_request exists — shows current pending request status (read-only)
 */

import { useState } from "react";
import { X, AlertTriangle, Clock, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";

const MODULE_LABELS = {
  INDENT:            "Indent",
  ENQUIRY:           "Enquiry",
  ORDER:             "Purchase Order",
  PW_ORDER:          "Project Work Order",
  GRN:               "Goods Received Note",
  SRN:               "Site Return Note",
  GIN:               "Gate Inward Note",
  DC:                "Delivery Challan",
  DLR:               "Daily Labour Report",
  BVS:               "Vendor Billing (GRN)",
  BSS:               "Vendor Billing (SRN)",
  BRR:               "Bill Receive Register",
  BRG:               "BRR Billing GRN",
  BRS:               "BRR Billing SRN",
  BRB:               "BRR Billing",
  PURCHASE_BILL:     "Purchase Bill",
  BILL_PAYMENT:      "Bill Payment",
  PURCHASE_VOUCHER:  "Purchase Voucher",
  PAYMENT_VOUCHER:   "Payment Voucher",
  SALE_BILL:         "Sale Bill",
  SALE_RECEIPT_BILLING: "Sale Receipt Billing",
  JOURNAL_ENTRY:     "Journal Entry",
  CONTRA_ENTRY:      "Contra Entry",
  CREDIT_NOTE:       "Credit Note",
  DEBIT_NOTE:        "Debit Note",
  PETTY_CASH_BUDGET: "Petty Cash Budget",
  PETTY_CASH_VOUCHER:"Petty Cash Voucher",
  OG_SALE_ORDER:     "OG Sale Order",
  BILLING:           "Custom Billing",
  UNCERTAIN_ALLOC:   "Uncertain Allocation",
  BATCHING_PLANT:    "Batching Plant",
  BBS_REGISTER:      "BBS Register",
  HINDRANCE_REGISTER:"Hindrance Register",
  SALE_RECEIPT:      "Sale Receipt",
  DRAWING_REGISTER:  "Drawing Register",
  CONCRETE_REGISTRY: "Concrete Registry",
};

const STATUS_COLORS = {
  PENDING:   "text-yellow-600 bg-yellow-50 border-yellow-200",
  COMPLETED: "text-green-600 bg-green-50 border-green-200",
  CANCELLED: "text-gray-500 bg-gray-50 border-gray-200",
};

export default function DeleteRequestModal({
  open,
  onClose,
  checkData,
  moduleCode,
  recordId,
  onRequestRaised,
  onImmediateDelete,
}) {
  const [reason, setReason]     = useState("");
  const [loading, setLoading]   = useState(false);

  if (!open) return null;

  const {
    can_delete_now,
    blocked_by      = [],
    pending_request,
    record_no,
  } = checkData || {};

  const moduleLabel = MODULE_LABELS[moduleCode] || moduleCode;

  // ── Raise delete request ──────────────────────────────────────────
  const handleRaiseRequest = async () => {
    setLoading(true);
    try {
      await apiRequest({
        url:    `${API_ENDPOINTS.DELETE_MANAGER.RAISE_REQUEST}/${moduleCode}/${recordId}`,
        method: "POST",
        data:   { reason },
      });
      onRequestRaised?.();
    } catch (err) {
      toast.error(err.message || "Failed to raise delete request");
    } finally {
      setLoading(false);
    }
  };

  // ── Render: can delete immediately ───────────────────────────────
  // Checked FIRST — even if a pending_request exists but blockers are cleared,
  // show the confirm dialog so the user can manually perform the delete.
  if (can_delete_now) {
    const handleConfirmDelete = async () => {
      setLoading(true);
      try {
        await apiRequest({
          url:    `${API_ENDPOINTS.DELETE_MANAGER.RAISE_REQUEST}/${moduleCode}/${recordId}`,
          method: "POST",
          data:   { reason: "Direct delete — no blocking records." },
        });
        onImmediateDelete?.();
      } catch (err) {
        toast.error(err.message || "Failed to delete record");
      } finally {
        setLoading(false);
      }
    };

    return (
      <Overlay onClose={onClose}>
        <ModalBox title={`Delete ${moduleLabel}`} onClose={onClose}>
          <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-md mb-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Are you sure you want to delete{" "}
              <strong>{record_no || `#${recordId}`}</strong>?
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {loading ? "Deleting..." : "Yes, Delete"}
            </button>
          </div>
        </ModalBox>
      </Overlay>
    );
  }

  // ── Render: pending request exists and still blocked (read-only) ──
  if (pending_request) {
    const pr = pending_request;
    const statusClass = STATUS_COLORS[pr.status] || "text-gray-600";
    return (
      <Overlay onClose={onClose}>
        <ModalBox title={`Delete Request — ${moduleLabel}`} onClose={onClose}>
          <div className="space-y-4 text-sm">
            <InfoRow label="Document" value={pr.record_no || record_no} />
            <InfoRow label="Raised at" value={pr.requested_at ? new Date(pr.requested_at).toLocaleString() : "—"} />
            <InfoRow label="Reason" value={pr.reason || "—"} />
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium w-28">Status</span>
              <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${statusClass}`}>
                {pr.status}
              </span>
            </div>
            {pr.blocked_by_modules?.length > 0 && (
              <div>
                <p className="text-gray-500 font-medium mb-1">Waiting for</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700">
                  {pr.blocked_by_modules.map((m) => (
                    <li key={m}>{MODULE_LABELS[m] || m}</li>
                  ))}
                </ul>
              </div>
            )}
            {pr.blocked_by_docs && (
              <div>
                <p className="text-gray-500 font-medium mb-1">Blocking documents</p>
                <p className="text-gray-700 break-words">{pr.blocked_by_docs}</p>
              </div>
            )}
            {pr.wa_sent && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                WhatsApp notification sent
                {pr.wa_sent_at ? ` on ${new Date(pr.wa_sent_at).toLocaleString()}` : ""}
              </p>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition"
            >
              Close
            </button>
          </div>
        </ModalBox>
      </Overlay>
    );
  }

  // ── Render: blocked — raise delete request ───────────────────────
  return (
    <Overlay onClose={onClose}>
      <ModalBox title={`Request Delete — ${moduleLabel}`} onClose={onClose}>
        <div className="space-y-4 text-sm">
          <div className="flex gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <Clock className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">
                {moduleLabel} <strong>{record_no || `#${recordId}`}</strong> cannot be deleted yet.
              </p>
              <p className="text-yellow-700 mt-0.5">
                The following linked records must be deleted first. Managers will be
                notified via WhatsApp.
              </p>
            </div>
          </div>

          {/* Blocking records list */}
          <div>
            <p className="font-medium text-gray-600 mb-2">Blocking records</p>
            <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {blocked_by.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-medium text-gray-700">
                    {MODULE_LABELS[b.module_code] || b.module_code}
                  </span>
                  <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono">
                    {b.doc_no}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="font-medium text-gray-600 block mb-1">
              Reason <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you want to delete this record?"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRaiseRequest}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Sending..." : "Raise Delete Request"}
          </button>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── shared layout helpers ──────────────────────────────────────────

function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function ModalBox({ title, onClose, children }) {
  return (
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 font-medium w-28 shrink-0">{label}</span>
      <span className="text-gray-700 break-words">{value}</span>
    </div>
  );
}
