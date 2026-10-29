"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/apiClient";

/**
 * Calls an AI endpoint and returns { suggestion, loading, error, refetch }.
 *
 * @param {object} opts
 * @param {string}  opts.url      - API endpoint path (from API_ENDPOINTS.AI.*)
 * @param {string}  opts.method   - "POST" | "GET"   (default "POST")
 * @param {object}  opts.payload  - request body / params
 * @param {boolean} opts.enabled  - set false to skip auto-fetch (default true)
 */
export default function useAiSuggest({
  url,
  method = "POST",
  payload = {},
  enabled = true,
}) {
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  // Stable ref so the effect doesn't re-run on every render
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const fetch = useCallback(
    async (overridePayload) => {
      if (!url) return;
      setLoading(true);
      setError(null);
      setSuggestion("");
      try {
        const body = overridePayload ?? payloadRef.current;
        const res = await apiRequest({
          url,
          method,
          data: method === "POST" ? body : undefined,
          params: method === "GET" ? body : undefined,
        });
        const text =
          res?.data?.suggestion ||
          res?.data?.answer ||
          res?.data?.insight ||
          "No suggestion returned.";
        setSuggestion(text);
      } catch (err) {
        setError(err?.message || "AI request failed");
      } finally {
        setLoading(false);
      }
    },
    [url, method],
  );

  // Auto-fetch when payload changes (project switches etc.)
  const payloadKey = JSON.stringify(payload);
  useEffect(() => {
    if (!enabled) return;
    // Only fire when there's a meaningful payload (e.g. project_code set)
    const hasValue = Object.values(payload).some((v) => v !== "" && v != null);
    if (!hasValue) return;
    fetch();
  }, [enabled, payloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { suggestion, loading, error, refetch: fetch };
}
