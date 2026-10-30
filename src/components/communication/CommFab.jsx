"use client";

import { useState } from "react";
import { MessageCircle, Phone, X, Zap } from "lucide-react";
import { useComm } from "@/context/CommContext";

export default function CommFab() {
  const [expanded, setExpanded] = useState(false);
  const { openPicker, pickerMode, closePicker, unreadNotifCount, unreadPingCount } = useComm();

  const totalBadge = unreadNotifCount + unreadPingCount;

  const open = (mode) => {
    if (pickerMode === mode) { closePicker(); }
    else { openPicker(mode); }
    setExpanded(false);
  };

  return (
    <div className="fixed bottom-6 left-5 z-[9990] flex flex-col-reverse items-start gap-3">
      {expanded && (
        <>
          <button
            onClick={() => open("chat")}
            className={`flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-md
              transition text-sm font-medium border
              ${pickerMode === "chat"
                ? "bg-[#003b8e] text-white border-[#003b8e]"
                : "bg-white border-[#003b8e] text-[#003b8e] hover:bg-[#003b8e] hover:text-white"}`}
          >
            <MessageCircle size={16} />
            <span>Chat</span>
          </button>

          <button
            onClick={() => open("call")}
            className={`flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-md
              transition text-sm font-medium border
              ${pickerMode === "call"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white"}`}
          >
            <Phone size={16} />
            <span>Call</span>
          </button>

          <button
            onClick={() => open("ping")}
            className={`flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-md
              transition text-sm font-medium border
              ${pickerMode === "ping"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white"}`}
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
