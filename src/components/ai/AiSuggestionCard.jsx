"use client";

import { Loader2, Sparkles, RefreshCw, CheckCheck } from "lucide-react";

/**
 * Renders Claude's suggestion text with an optional Apply button.
 *
 * Props:
 *   suggestion  string   — Claude's text
 *   loading     bool
 *   error       string | null
 *   onApply     fn | null — if provided, shows Apply button
 *   onRefresh   fn        — re-calls the AI
 *   applyLabel  string    — button label (default "Apply Suggestion")
 */
export default function AiSuggestionCard({
  suggestion,
  loading,
  error,
  onApply,
  onRefresh,
  applyLabel = "Apply Suggestion",
}) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800 p-3 text-sm space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-violet-700 dark:text-violet-300 font-semibold text-xs uppercase tracking-wide">
          <Sparkles size={13} />
          AI Suggestion
        </span>
        {onRefresh && !loading && (
          <button
            type="button"
            onClick={() => onRefresh()}
            title="Refresh suggestion"
            className="text-violet-400 hover:text-violet-600 transition"
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>

      {/* Body */}
      {loading && (
        <div className="flex items-center gap-2 text-violet-500 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">Thinking…</span>
        </div>
      )}

      {!loading && error && (
        <p className="text-red-500 text-xs">{error}</p>
      )}

      {!loading && !error && suggestion && (
        <pre className="whitespace-pre-wrap font-sans text-xs text-gray-700 dark:text-gray-200 leading-relaxed max-h-64 overflow-y-auto">
          {suggestion}
        </pre>
      )}

      {!loading && !error && !suggestion && (
        <p className="text-gray-400 text-xs italic">No suggestion yet.</p>
      )}

      {/* Apply button */}
      {onApply && suggestion && !loading && (
        <button
          type="button"
          onClick={onApply}
          className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition"
        >
          <CheckCheck size={13} />
          {applyLabel}
        </button>
      )}
    </div>
  );
}
