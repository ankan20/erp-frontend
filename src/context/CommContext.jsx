"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { getCookie } from "@/lib/cookies";
import {
  getConversations,
  getUnreadNotifications,
  getUnreadPingCount,
  getIncomingCalls,
  sendHeartbeat,
} from "@/lib/commApi";

const CommContext = createContext(null);

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

      if (convRes.status === "fulfilled")
        setConversations(convRes.value?.data || convRes.value || []);

      if (notifRes.status === "fulfilled")
        setUnreadNotifCount(notifRes.value?.unreadCount ?? 0);

      if (pingRes.status === "fulfilled")
        setUnreadPingCount(pingRes.value?.count ?? 0);

      if (callRes.status === "fulfilled") {
        const calls = callRes.value?.data || callRes.value || [];
        if (calls.length > 0 && !activeCall) {
          setIncomingCall(calls[0]);
        } else if (calls.length === 0) {
          setIncomingCall(null);
        }
      }
    } catch {
      // silently ignore — user may not be logged in yet
    }
  }, [activeCall]);

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

  return (
    <CommContext.Provider value={{
      myId,
      conversations,
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
