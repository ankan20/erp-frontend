"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Phone, X, Zap } from "lucide-react";
import { useComm } from "@/context/CommContext";

function Badge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span className={`min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold
      flex items-center justify-center ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

const OPTIONS = [
  { mode: "chat", label: "Chat", Icon: MessageCircle,
    idle: "bg-white border-[#003b8e] text-[#003b8e] hover:bg-[#003b8e] hover:text-white" },
  { mode: "call", label: "Call", Icon: Phone,
    idle: "bg-white border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white" },
  { mode: "ping", label: "Ping", Icon: Zap,
    idle: "bg-white border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white" },
];

export default function CommFab() {
  const [expanded, setExpanded] = useState(false);
  const { openPicker, pickerMode, closePicker, unreadMessageCount, unreadPingCount } = useComm();

  const totalBadge = unreadMessageCount + unreadPingCount;
  const counts = { chat: unreadMessageCount, ping: unreadPingCount };
  const active = expanded || !!pickerMode;

  // Clicking anywhere outside the FAB or its panel collapses back to the plain button
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e) => {
      if (!e.target.closest?.("[data-comm-ui]")) setExpanded(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [expanded]);

  const choose = (mode) => {
    openPicker(mode);
    setExpanded(false);
  };

  const onMain = () => {
    if (pickerMode) { closePicker(); return; }
    setExpanded((v) => !v);
  };

  return (
    <div data-comm-ui
      className="fixed bottom-4 left-[7px] z-[9990] flex flex-col items-start gap-2">
      {expanded && OPTIONS.map(({ mode, label, Icon, idle }) => (
        <button key={mode} onClick={() => choose(mode)}
          className={`flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 shadow-md
            transition text-xs font-medium border ${idle}`}>
          <Icon size={14} />
          <span>{label}</span>
          <Badge count={counts[mode]} className="ml-0.5" />
        </button>
      ))}

      <button onClick={onMain}
        title={active ? "Close" : "Chat, call or ping"}
        className="relative w-9 h-9 rounded-full bg-[#003b8e] text-white shadow-lg
          flex items-center justify-center hover:bg-[#002e6e] transition">
        {active ? <X size={17} /> : <MessageCircle size={17} />}
        {!active && <Badge count={totalBadge} className="absolute -top-1 -right-1" />}
      </button>
    </div>
  );
}
