"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { getLocalStorage } from "@/lib/localStorage";
import {
  getConversations,
  getUnreadNotifications,
  getUnreadPingCount,
  getIncomingCalls,
} from "@/lib/commApi";

const CommContext = createContext(null);

export function CommProvider({ children }) {
  const [conversations,      setConversations]      = useState([]);
  const [unreadNotifCount,   setUnreadNotifCount]   = useState(0);
  const [unreadPingCount,    setUnreadPingCount]    = useState(0);
  const [incomingCall,       setIncomingCall]       = useState(null);   // { callId, callType, roomCode, initiatorName }
  const [activeCall,         setActiveCall]         = useState(null);   // same shape, set when answered
  const [chatOpen,           setChatOpen]           = useState(false);
  const [activeChatConvId,   setActiveChatConvId]   = useState(null);
  const pollRef = useRef(null);

  const myId = () => {
    try { return Number(getLocalStorage("userId")) || null; } catch { return null; }
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
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  const openChat = (convId = null) => {
    setChatOpen(true);
    setActiveChatConvId(convId);
  };

  const closeChat = () => {
    setChatOpen(false);
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
      chatOpen,
      activeChatConvId,
      openChat,
      closeChat,
      answerIncomingCall,
      endActiveCall,
      refresh,
      setActiveChatConvId,
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
