"use client";

import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

/**
 * Checks if a record has a pending deletion request.
 * Returns orange banner data for HeaderWrapper's pendingDeletion prop.
 */
export function useDeletePending(moduleCode, recordId, enabled = true) {
  const [isPendingDeletion, setIsPendingDeletion] = useState(false);
  const [pendingInfo, setPendingInfo] = useState(null);   // { blockedBy, pending_request }
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    if (!moduleCode || !recordId || !enabled) return;
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.DELETE_MANAGER.CHECK}/${moduleCode}/${recordId}`,
        method: "GET",
      });
      const data = res?.data ?? res;
      if (data?.pending_request) {
        const blocked = data.blocked_by ?? [];
        setIsPendingDeletion(true);
        setPendingInfo({
          blockedBy: blocked.length > 0 ? blocked.join(", ") : null,
          pending_request: data.pending_request,
        });
      } else {
        setIsPendingDeletion(false);
        setPendingInfo(null);
      }
    } catch {
      // non-blocking — banner simply won't show if API fails
    }
  }, [moduleCode, recordId, enabled]);

  useEffect(() => {
    check();
  }, [check]);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    isPendingDeletion: isPendingDeletion && !dismissed,
    pendingInfo,
    dismissDeletion: dismiss,
    refreshDeleteStatus: check,
  };
}
