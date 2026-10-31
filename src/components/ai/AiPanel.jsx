"use client";

import { useState } from "react";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { API_ENDPOINTS } from "@/config/api.config";
import useAiSuggest from "@/hooks/useAiSuggest";
import AiSuggestionCard from "./AiSuggestionCard";
import AiSearchBar from "./AiSearchBar";

/**
 * Floating AI side panel. Renders a fixed toggle button + slide-in drawer.
 *
 * Props:
 *   projectCode   string         — current project, drives auto-suggestion
 *   endpoint      string         — API_ENDPOINTS.AI.* for auto-suggestion
 *   method        "POST"|"GET"   — default "POST"
 *   payload       object         — extra payload fields merged with project_code
 *   onApply       fn(suggestion) — what happens when user clicks Apply
 *   applyLabel    string
 *   title         string         — panel heading
 */
export default function AiPanel({
  projectCode = "",
  endpoint,
  method = "POST",
  payload = {},
  onApply,
  applyLabel = "Apply Suggestion",
  title = "AI Assistant",
}) {
  const [open, setOpen] = useState(false);

  // ── Auto-suggestion — only plain string/number values, no React objects ──
  const autoPayload = Object.fromEntries(
    Object.entries({ project_code: projectCode, ...payload }).filter(
      ([, v]) => typeof v === "string" || typeof v === "number"
    )
  );
  const {
    suggestion: autoSuggestion,
    fields: autoFields,
    loading: autoLoading,
    error: autoError,
    refetch: autoRefetch,
  } = useAiSuggest({
    url: endpoint,
    method,
    payload: autoPayload,
    enabled: !!projectCode && !!endpoint,
  });

  // ── Chat / search ────────────────────────────────────────────────────────
  const [chatSuggestion, setChatSuggestion] = useState("");
  const {
    loading: chatLoading,
    error: chatError,
    refetch: chatFetch,
  } = useAiSuggest({
    url: API_ENDPOINTS.AI.CHAT,
    method: "POST",
    payload: {},
    enabled: false, // manual only
  });

  const handleSearch = (query) => {
    setChatSuggestion("");
    chatFetch({ query, module: "finance" }).then(() => {});
  };

  // chatFetch updates the hook's own state — mirror it here via a wrapper
  const [chatResult, setChatResult] = useState("");
  const [chatResultLoading, setChatResultLoading] = useState(false);
  const [chatResultError, setChatResultError] = useState(null);

  const handleSearchQuery = async (query) => {
    setChatResultLoading(true);
    setChatResultError(null);
    setChatResult("");
    try {
      const { apiRequest } = await import("@/lib/apiClient");
      const res = await apiRequest({
        url: API_ENDPOINTS.AI.CHAT,
        method: "POST",
        data: { query, module: "finance" },
      });
      setChatResult(
        res?.answer || res?.suggestion || "No answer returned."
      );
    } catch (err) {
      setChatResultError(err?.message || "Request failed");
    } finally {
      setChatResultLoading(false);
    }
  };

  return (
    <>
      {/* ── Toggle button ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="AI Assistant"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg text-xs font-semibold transition"
      >
        <Sparkles size={14} />
        AI
        {!open && <ChevronRight size={12} />}
      </button>

      {/* ── Slide-in drawer ── */}
      {open && (
        <div className="fixed top-0 right-0 h-full w-80 z-50 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-violet-50 dark:bg-violet-950/40">
            <span className="flex items-center gap-2 font-semibold text-sm text-violet-700 dark:text-violet-300">
              <Sparkles size={15} />
              {title}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Project badge */}
            {projectCode && (
              <div className="text-[11px] text-gray-400">
                Project:{" "}
                <span className="font-semibold text-violet-600">{projectCode}</span>
              </div>
            )}

            {/* Auto suggestion */}
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">
                Auto suggestion
              </p>
              <AiSuggestionCard
                suggestion={autoSuggestion}
                loading={autoLoading}
                error={autoError}
                onApply={onApply ? () => onApply(autoFields, autoSuggestion) : null}
                onRefresh={() => autoRefetch()}
                applyLabel={applyLabel}
              />
              {autoFields && !autoLoading && (
                <div className="mt-2 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-3 py-2 text-[11px] text-violet-700 dark:text-violet-300 space-y-0.5">
                  {autoFields.erp_doc_no && <div><span className="font-semibold">Sale Order:</span> {autoFields.erp_doc_no}</div>}
                  <div><span className="font-semibold">CC Code:</span> {autoFields.cc_code} — {autoFields.cc_name}</div>
                  <div><span className="font-semibold">Avg Amount:</span> ₹{Number(autoFields.basic_amount).toLocaleString("en-IN")}</div>
                  <div><span className="font-semibold">GST:</span> {autoFields.gst_type}</div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-gray-800" />

            {/* Chat result */}
            {(chatResult || chatResultLoading || chatResultError) && (
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">
                  Search result
                </p>
                <AiSuggestionCard
                  suggestion={chatResult}
                  loading={chatResultLoading}
                  error={chatResultError}
                  onApply={null}
                  onRefresh={null}
                />
              </div>
            )}

            {/* Search bar */}
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">
                Ask anything
              </p>
              <AiSearchBar
                onSearch={handleSearchQuery}
                loading={chatResultLoading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
