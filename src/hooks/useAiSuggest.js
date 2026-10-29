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
        const raw = overridePayload ?? payloadRef.current;
        // Strip any non-primitive values — prevents circular JSON errors from React refs/DOM nodes
        const body = Object.fromEntries(
          Object.entries(raw).filter(
            ([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
          )
        );
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

  // Safely serialize payload — strips any non-primitive values (React nodes, DOM refs etc.)
  const safePayloadKey = Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object" && typeof v !== "function")
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  useEffect(() => {
    if (!enabled) return;
    const hasValue = Object.values(payload).some((v) => v !== "" && v != null && typeof v !== "object");
    if (!hasValue) return;
    // Only send plain string/number fields to the API
    const safePayload = Object.fromEntries(
      Object.entries(payloadRef.current).filter(
        ([, v]) => typeof v === "string" || typeof v === "number"
      )
    );
    fetch(safePayload);
  }, [enabled, safePayloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { suggestion, loading, error, refetch: fetch };
}
