"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getReplySuggestions } from "@/lib/commApi";

// Quick-reply chips for a received message. Renders nothing until suggestions load.
// <SmartReplies messageId={lastMsg.id} onPick={(text) => send(text)} />
export default function SmartReplies({ messageId, onPick, disabled }) {
  const [loaded, setLoaded] = useState({ id: null, items: [] });

  useEffect(() => {
    if (!messageId) return;
    let cancelled = false;
    getReplySuggestions(messageId)
      .then(r => { if (!cancelled) setLoaded({ id: messageId, items: Array.isArray(r?.suggestions) ? r.suggestions : [] }); })
      .catch(() => { if (!cancelled) setLoaded({ id: messageId, items: [] }); });
    return () => { cancelled = true; };
  }, [messageId]);

  // Ignore results that belong to a previous message
  const items = loaded.id === messageId ? loaded.items : [];

  if (!items.length) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
      <Sparkles size={13} className="text-[#003b8e] shrink-0" />
      {items.map(text => (
        <button key={text} type="button" disabled={disabled} onClick={() => onPick?.(text)}
          className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-[#003b8e]/30 text-[#003b8e]
            bg-white hover:bg-[#003b8e] hover:text-white transition disabled:opacity-40">
          {text}
        </button>
      ))}
    </div>
  );
}
