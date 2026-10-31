import { apiRequest } from "./apiClient";

const C = "/comm";

// ─── Conversations ─────────────────────────────────────────────────────────
export const getConversations      = ()      => apiRequest({ url: `${C}/conversations` });
export const startDirect           = (userId) => apiRequest({ url: `${C}/conversations/direct`, method: "POST", data: { userId } });
export const getConvDetail         = (id)    => apiRequest({ url: `${C}/conversations/${id}` });

// ─── Messages ──────────────────────────────────────────────────────────────
export const getMessages    = (convId, beforeId)  => apiRequest({ url: `${C}/conversations/${convId}/messages`, params: beforeId ? { beforeId } : {} });
export const getNewMessages = (convId, afterId)   => apiRequest({ url: `${C}/conversations/${convId}/messages/new`, params: afterId ? { afterId } : {} });
export const sendMessage    = (convId, content)   => apiRequest({ url: `${C}/conversations/${convId}/messages`, method: "POST", data: { content, type: "text" } });
export const setTyping      = (convId)             => apiRequest({ url: `${C}/conversations/${convId}/typing`, method: "POST" });
export const getTyping      = (convId)             => apiRequest({ url: `${C}/conversations/${convId}/typing` });

// ─── Pings ─────────────────────────────────────────────────────────────────
export const sendPing          = (receiverId, pingType, message) => apiRequest({ url: `${C}/pings`, method: "POST", data: { receiverId, pingType, message } });
export const getReceivedPings  = (unreadOnly = false) => apiRequest({ url: `${C}/pings/received`, params: unreadOnly ? { unreadOnly: "true" } : {} });
export const getUnreadPingCount = () => apiRequest({ url: `${C}/pings/unread-count` });
export const markPingRead      = (id) => apiRequest({ url: `${C}/pings/${id}/read`, method: "POST" });
export const markAllPingsRead  = ()   => apiRequest({ url: `${C}/pings/read-all`, method: "POST" });

// ─── Notifications ─────────────────────────────────────────────────────────
export const getUnreadNotifications = () => apiRequest({ url: `${C}/notifications`, params: { unreadOnly: "true" } });
export const markNotifRead          = (id) => apiRequest({ url: `${C}/notifications/${id}/read`, method: "POST" });
export const markAllNotifsRead      = () => apiRequest({ url: `${C}/notifications/read-all`, method: "POST" });

// ─── Calls ─────────────────────────────────────────────────────────────────
export const startCall       = (participantIds, callType = "voice") => apiRequest({ url: `${C}/calls`, method: "POST", data: { participantIds, callType } });
export const answerCall      = (id) => apiRequest({ url: `${C}/calls/${id}/answer`, method: "POST" });
export const endCall         = (id) => apiRequest({ url: `${C}/calls/${id}/end`, method: "POST" });
export const sendSignal      = (callId, receiverId, signalType, payload) => apiRequest({ url: `${C}/calls/${callId}/signal`, method: "POST", data: { receiverId, signalType, payload } });
export const pollSignals     = (callId) => apiRequest({ url: `${C}/calls/${callId}/signals` });
export const getTurnCredentials = () => apiRequest({ url: `${C}/turn-credentials` });
export const getIncomingCalls = () => apiRequest({ url: `${C}/calls/incoming` });

// ─── Directory ─────────────────────────────────────────────────────────────
export const getDirectory   = (search) => apiRequest({ url: `${C}/directory`, params: search ? { search } : {} });
export const sendHeartbeat  = ()       => apiRequest({ url: `${C}/heartbeat`, method: "POST" });
