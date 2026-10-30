"use client";

import { useState } from "react";
import { MessageCircle, Phone, Bell, X, Zap } from "lucide-react";
import { useComm } from "@/context/CommContext";

export default function CommFab() {
  const [expanded, setExpanded] = useState(false);
  const { openChat, unreadNotifCount, unreadPingCount } = useComm();

  const totalBadge = unreadNotifCount + unreadPingCount;

  return (
    <div className="fixed bottom-6 left-5 z-[9990] flex flex-col-reverse items-start gap-3">
      {/* Sub-action buttons (visible when expanded) */}
      {expanded && (
        <>
          <button
            onClick={() => { openChat(null); setExpanded(false); }}
            className="flex items-center gap-2 bg-white border border-[#003b8e] text-[#003b8e]
              rounded-full pl-3 pr-4 py-2 shadow-md hover:bg-[#003b8e] hover:text-white
              transition text-sm font-medium"
          >
            <MessageCircle size={16} />
            <span>Chat</span>
          </button>

          <button
            className="flex items-center gap-2 bg-white border border-emerald-600 text-emerald-700
              rounded-full pl-3 pr-4 py-2 shadow-md hover:bg-emerald-600 hover:text-white
              transition text-sm font-medium"
            onClick={() => setExpanded(false)}
          >
            <Phone size={16} />
            <span>Call</span>
          </button>

          <button
            className="flex items-center gap-2 bg-white border border-amber-500 text-amber-600
              rounded-full pl-3 pr-4 py-2 shadow-md hover:bg-amber-500 hover:text-white
              transition text-sm font-medium"
            onClick={() => setExpanded(false)}
          >
            <Zap size={16} />
            <span>Ping</span>
          </button>
        </>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="relative w-12 h-12 rounded-full bg-[#003b8e] text-white shadow-lg
          flex items-center justify-center hover:bg-[#002e6e] transition"
      >
        {expanded ? <X size={22} /> : <MessageCircle size={22} />}
        {!expanded && totalBadge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500
            text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        )}
      </button>
    </div>
  );
}
