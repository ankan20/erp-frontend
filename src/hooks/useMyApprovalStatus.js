"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/apiClient";

export function useMyApprovalStatus(api, entityId, enabled = true) {
  const [isPendingForMe, setIsPendingForMe] = useState(false);
  const [myLevel, setMyLevel]               = useState(null);

  useEffect(() => {
    if (!api || !entityId || !enabled) {
      setIsPendingForMe(false);
      setMyLevel(null);
      return;
    }

    let cancelled = false;

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
  }, [api, entityId, enabled]);

  return { isPendingForMe, myLevel };
}
