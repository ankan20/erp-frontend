"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

/**
 * Returns a Set of record IDs that have a PENDING delete request for the given module.
 * Used by list pages to show a blinking indicator on rows awaiting action.
 */
export function useDeletePendingIds(moduleCode, enabled = true) {
  const [pendingIds, setPendingIds] = useState(new Set());

  useEffect(() => {
    if (!moduleCode || !enabled) return;
    apiRequest({
      url: `${API_ENDPOINTS.DELETE_MANAGER.LIST_REQUESTS}?module_code=${moduleCode}&status=PENDING&per_page=200`,
      method: "GET",
    })
      .then((res) => {
        const data = res?.data ?? res;
        const ids = new Set((data?.results || []).map((r) => Number(r.record_id)));
        setPendingIds(ids);
      })
      .catch(() => {});
  }, [moduleCode, enabled]);

  return pendingIds;
}
