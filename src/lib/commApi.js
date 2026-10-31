import { apiRequest } from "./apiClient";

const C = "/comm";

// ─── Conversations ─────────────────────────────────────────────────────────
export const getConversations      = ()      => apiRequest({ url: `${C}/conversations` });
export const startDirect           = (userId) => apiRequest({ url: `${C}/conversations/direct`, method: "POST", data: { userId } });
export const getConvDetail         = (id)    => apiRequest({ url: `${C}/conversations/${id}` });

// ─── Messages ──────────────────────────────────────────────────────────────
export const getMessages    = (convId, beforeId)  => apiRequest({ url: `${C}/conversations/${convId}/messages`, params: beforeId ? { beforeId } : {} });
export const getNewMessages = (convId, afterId)   => apiRequest({ url: `${C}/conversations/${convId}/messages/new`, params: afterId ? { afterId } : {} });
export const sendMessage    = (convId, content, { replyToId } = {}) =>
  apiRequest({ url: `${C}/conversations/${convId}/messages`, method: "POST", data: { content, type: "text", ...(replyToId ? { replyToId } : {}) } });

// file: a File/Blob. caption and replyToId are optional.
export const sendMedia = (convId, file, { caption, replyToId } = {}) => {
  const fd = new FormData();
  fd.append("file", file);
  if (caption)   fd.append("caption", caption);
  if (replyToId) fd.append("replyToId", String(replyToId));
  return apiRequest({ url: `${C}/conversations/${convId}/media`, method: "POST", data: fd });
};

export const forwardMessage = (msgId, { userIds = [], conversationIds = [], caption } = {}) =>
  apiRequest({ url: `${C}/messages/${msgId}/forward`, method: "POST", data: { userIds, conversationIds, caption } });

export const getReplySuggestions = (msgId) => apiRequest({ url: `${C}/messages/${msgId}/suggestions` });

// Send a file and/or text to a person from anywhere in the app (e.g. share a PO PDF).
// Returns the conversation id so the caller can open that chat if it wants.
export const shareToUser = async (userId, { file, text } = {}) => {
  const { conversationId } = await startDirect(userId);
  if (file)      await sendMedia(conversationId, file, { caption: text });
  else if (text) await sendMessage(conversationId, text);
  return conversationId;
};
export const setTyping      = (convId)             => apiRequest({ url: `${C}/conversations/${convId}/typing`, method: "POST" });
export const getTyping      = (convId)             => apiRequest({ url: `${C}/conversations/${convId}/typing` });

// ─── Pings ─────────────────────────────────────────────────────────────────
export const sendPing          = (receiverId, pingType, message) => apiRequest({ url: `${C}/pings`, method: "POST", data: { receiverId, pingType, message } });
export const getReceivedPings  = (unreadOnly = false) => apiRequest({ url: `${C}/pings/received`, params: unreadOnly ? { unreadOnly: "true" } : {} });
export const getUnreadPingCount = () => apiRequest({ url: `${C}/pings/unread-count` });
export const markPingRead      = (id) => apiRequest({ url: `${C}/pings/${id}/read`, method: "POST" });
// keepRecords: leave pings that point at a record unread until that record is opened
export const markAllPingsRead  = ({ keepRecords = false } = {}) =>
  apiRequest({ url: `${C}/pings/read-all${keepRecords ? "?keepRecords=true" : ""}`, method: "POST" });

// Records of `module` in the current project that are waiting on `userId`'s approval
export const getPendingApprovalsFor = (module, userId) =>
  apiRequest({ url: `${C}/approval-pings/pending`, params: { module, userId } });

// One ping per record: { receiverId, module, recordIds: [..], message }
export const sendApprovalPing = ({ receiverId, module, recordIds, message }) =>
  apiRequest({ url: `${C}/approval-pings`, method: "POST", data: { receiverId, module, recordIds, message } });

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
