"use client";

/**
 * DeleteRequestButton
 *
 * Smart delete button for any module record.
 * On click it checks whether the record can be deleted immediately or has
 * downstream children that must be cleared first.
 *
 * Props:
 *   moduleCode  — e.g. "INDENT", "GRN", "PURCHASE_BILL"
 *   recordId    — numeric id of the record
 *   onDeleted   — callback after an immediate direct-delete succeeds
 *                 (the parent should call its own delete API here, then call this)
 *   className   — extra tailwind classes
 *
 * Usage:
 *   <DeleteRequestButton
 *     moduleCode="INDENT"
 *     recordId={indent.id}
 *     onDeleted={() => router.refresh()}
 *   />
 */

import { useState } from "react";
import { Loader2, Trash2, Clock, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import DeleteRequestModal from "./DeleteRequestModal";

export default function DeleteRequestButton({
  moduleCode,
  recordId,
  onDeleted,
  className = "",
}) {
  const [loading, setLoading]       = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [checkData, setCheckData]   = useState(null);

  const handleClick = async () => {
    if (!moduleCode || !recordId) return;
    setLoading(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.DELETE_MANAGER.CHECK}/${moduleCode}/${recordId}`,
        method: "GET",
      });

      const data = res?.data || res;

      // Already has a pending request — show modal in read-only mode
      if (data.pending_request) {
        setCheckData(data);
        setModalOpen(true);
        return;
      }

      // Can delete right now — let parent handle actual delete, just confirm
      if (data.can_delete_now) {
        setCheckData(data);
        setModalOpen(true);
        return;
      }

      // Blocked — show modal to raise a delete request
      setCheckData(data);
      setModalOpen(true);
    } catch (err) {
      toast.error(err.message || "Failed to check delete status");
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setCheckData(null);
  };

  const handleRequestRaised = () => {
    setModalOpen(false);
    setCheckData(null);
    toast.success("Delete request raised. Notifications sent via WhatsApp.");
  };

  const handleImmediateDelete = () => {
    setModalOpen(false);
    setCheckData(null);
    if (onDeleted) onDeleted();
  };

  // Determine button state
  const isPending = checkData?.pending_request != null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`
          h-8.5 min-w-30 px-4 rounded-md border text-md font-medium
          flex items-center justify-center gap-2 transition
          ${loading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
          border-red-400 bg-red-100 text-red-700 hover:bg-red-200
          ${className}
        `}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPending ? (
          <Clock className="h-4 w-4" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {loading ? "Checking..." : isPending ? "Request Pending" : "Delete"}
      </button>

      {modalOpen && checkData && (
        <DeleteRequestModal
          open={modalOpen}
          onClose={handleModalClose}
          checkData={checkData}
          moduleCode={moduleCode}
          recordId={recordId}
          onRequestRaised={handleRequestRaised}
          onImmediateDelete={handleImmediateDelete}
        />
      )}
    </>
  );
}
