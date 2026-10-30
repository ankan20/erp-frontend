"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

/**
 * A small search bar inside the AI panel.
 * Props:
 *   onSearch  fn(query: string) — called when user submits
 *   loading   bool
 */
export default function AiSearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    onSearch(q);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask anything about this project…"
        className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-gray-400"
      />
      <button
        type="submit"
        disabled={loading || !query.trim()}
        className="p-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition"
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Send size={13} />
        )}
      </button>
    </form>
  );
}
