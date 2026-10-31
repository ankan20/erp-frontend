"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { getCookie } from "@/lib/cookies";
import { sounds, getOpenConversation } from "@/lib/commSounds";
import { getRecordRoute, moduleLabel } from "@/lib/moduleRegistry";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getConversations,
  getUnreadNotifications,
  getUnreadPingCount,
  getIncomingCalls,
  sendHeartbeat,
  getReceivedPings,
  markPingRead,
} from "@/lib/commApi";

const CommContext = createContext(null);

// Pop-up for a new ping on whatever page the user is on; approval pings get an
// "Open" button that jumps straight to the record.
async function showLatestPingToast(router) {
  try {
    const list = await getReceivedPings(true);
    const p = Array.isArray(list) ? list[0] : null;
    if (!p) return;
    const href   = getRecordRoute(p.contextModule, p.contextRecordId);
    const record = p.contextRecordRef ? `${moduleLabel(p.contextModule)} ${p.contextRecordRef}` : null;
    toast(`${p.pingLabel} from ${p.senderName || "Someone"}`, {
      description: [record, p.message].filter(Boolean).join(" — ") || undefined,
      duration: 10000,
      ...(href ? {
        action: {
          label: "Open",
          onClick: () => { markPingRead(p.id).catch(() => {}); router.push(href); },
        },
      } : {}),
    });
  } catch {}
}

export function CommProvider({ children }) {
  const [conversations,      setConversations]      = useState([]);
  const [unreadNotifCount,   setUnreadNotifCount]   = useState(0);
  const [unreadPingCount,    setUnreadPingCount]    = useState(0);
  const [incomingCall,       setIncomingCall]       = useState(null);
  const [activeCall,         setActiveCall]         = useState(null);
  // pickerMode: null | "chat" | "call" | "ping"
  const [pickerMode,         setPickerMode]         = useState(null);
  const [activeChatConvId,   setActiveChatConvId]   = useState(null);
  const pollRef = useRef(null);
  // null until the first poll, so existing unread items don't make a sound on page load
  const prevUnreadMsgs  = useRef(null);
  const prevUnreadPings = useRef(null);

  const router = useRouter();

  const myId = () => {
    try { return Number(getCookie("userId")) || null; } catch { return null; }
  };

  const refresh = useCallback(async () => {
    if (!myId()) return;
    try {
      const [convRes, notifRes, pingRes, callRes] = await Promise.allSettled([
        getConversations(),
        getUnreadNotifications(),
        getUnreadPingCount(),
        getIncomingCalls(),
      ]);

      if (convRes.status === "fulfilled") {
        const convs  = convRes.value?.data || convRes.value || [];
        const openId = getOpenConversation();
        const unread = (Array.isArray(convs) ? convs : [])
          .filter(c => c.conversationId !== openId)
          .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        if (prevUnreadMsgs.current !== null && unread > prevUnreadMsgs.current) sounds.messageReceived();
        prevUnreadMsgs.current = unread;
        setConversations(convs);
      }

      if (notifRes.status === "fulfilled")
        setUnreadNotifCount(notifRes.value?.unreadCount ?? 0);

      if (pingRes.status === "fulfilled") {
        const pings = pingRes.value?.count ?? 0;
        if (prevUnreadPings.current !== null && pings > prevUnreadPings.current) {
          sounds.pingReceived();
          showLatestPingToast(router);
        }
        prevUnreadPings.current = pings;
        setUnreadPingCount(pings);
      }

      if (callRes.status === "fulfilled") {
        const calls = Array.isArray(callRes.value) ? callRes.value
          : Array.isArray(callRes.value?.data) ? callRes.value.data : [];
        if (calls.length > 0 && !activeCall) {
          setIncomingCall(prev => {
            // Only update if it's a different call to avoid toast flicker
            if (prev?.callId === calls[0]?.callId) return prev;
            return calls[0];
          });
        } else if (calls.length === 0) {
          setIncomingCall(null);
        }
      }
    } catch {
      // silently ignore — user may not be logged in yet
    }
  }, [activeCall, router]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 5000);
    // Heartbeat every 30s so server knows we're online
    const hbRef = setInterval(() => {
      if (myId()) sendHeartbeat().catch(() => {});
    }, 30000);
    sendHeartbeat().catch(() => {}); // immediate on mount
    return () => { clearInterval(pollRef.current); clearInterval(hbRef); };
  }, [refresh]);

  const openPicker = (mode, convId = null) => {
    setPickerMode(mode);
    if (convId) setActiveChatConvId(convId);
  };

  const closePicker = () => {
    setPickerMode(null);
    setActiveChatConvId(null);
  };

  const answerIncomingCall = (call) => {
    setActiveCall(call);
    setIncomingCall(null);
  };

  const endActiveCall = () => {
    setActiveCall(null);
  };

  const unreadMessageCount = (Array.isArray(conversations) ? conversations : [])
    .reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <CommContext.Provider value={{
      myId,
      conversations,
      unreadMessageCount,
      unreadNotifCount,
      unreadPingCount,
      incomingCall,
      activeCall,
      pickerMode,
      activeChatConvId,
      openPicker,
      closePicker,
      answerIncomingCall,
      endActiveCall,
      refresh,
      setActiveChatConvId,
      // legacy aliases so AppNavbar/other consumers still work
      chatOpen: pickerMode === "chat",
      openChat: (convId) => openPicker("chat", convId),
      closeChat: () => closePicker(),
    }}>
      {children}
    </CommContext.Provider>
  );
}

export const useComm = () => {
  const ctx = useContext(CommContext);
  if (!ctx) throw new Error("useComm must be used inside CommProvider");
  return ctx;
};
