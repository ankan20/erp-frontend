"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/apiClient";

export function useMyApprovalStatus(api, entityId, enabled = true) {
  const [isPendingForMe, setIsPendingForMe] = useState(false);
  const [myLevel, setMyLevel]               = useState(null);
  const [fetchKey, setFetchKey]             = useState(0);
  const [dismissed, setDismissed]           = useState(false);

  useEffect(() => {
    if (!api || !entityId || !enabled) {
      setIsPendingForMe(false);
      setMyLevel(null);
      return;
    }

    let cancelled = false;
    setDismissed(false); // reset dismiss on every re-fetch

    apiRequest({ url: `${api}/${entityId}`, method: "GET" })
      .then((res) => {
        if (!cancelled) {
          setIsPendingForMe(res?.data?.isPendingForMe ?? false);
          setMyLevel(res?.data?.myLevel ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsPendingForMe(false);
          setMyLevel(null);
        }
      });

    return () => { cancelled = true; };
  }, [api, entityId, enabled, fetchKey]);

  // Call after approve/reback/reject to re-check status from server
  const refresh = useCallback(() => setFetchKey((k) => k + 1), []);

  // Session-only dismiss — banner hides until next page load or refresh()
  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    isPendingForMe: isPendingForMe && !dismissed,
    myLevel,
    refresh,
    dismiss,
  };
}
