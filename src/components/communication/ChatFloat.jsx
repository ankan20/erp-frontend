"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  X, ChevronLeft, Send, Search, MessageCircle,
  Phone, Zap, Loader2, PhoneCall, Video, Users, CornerUpLeft, Forward,
} from "lucide-react";
import {
  AttachButton, AttachmentPreview, MessageAttachment, ShareDialog, SmartReplies, validateChatFile,
  PendingApprovalPicker, RecordLink,
} from "@/components/communication/shared";
import { detectModuleFromPath } from "@/lib/moduleRegistry";
import { useComm } from "@/context/CommContext";
import {
  getDirectory,
  startDirect,
  getMessages,
  getNewMessages,
  sendMessage as apiSendMsg,
  sendMedia,
  setTyping as apiSetTyping,
  getTyping,
  sendPing,
  startCall,
  getReceivedPings,
  markAllPingsRead,
  sendApprovalPing,
} from "@/lib/commApi";
import { sounds, setOpenConversation } from "@/lib/commSounds";

const PING_TYPES = [
  { value: "ping",             label: "Ping",              color: "bg-blue-500" },
  { value: "nudge",            label: "Nudge",             color: "bg-purple-500" },
  { value: "urgent",           label: "URGENT",            color: "bg-red-600" },
  { value: "approval_request", label: "Need Approval",     color: "bg-orange-500" },
  { value: "review",           label: "Need Review",       color: "bg-indigo-500" },
  { value: "attention",        label: "Attention Required", color: "bg-amber-500" },
];

// ── Pings I received (opening this list marks them read) ─────────────────────
function ReceivedPings() {
  const { refresh, closePicker } = useComm();
  const [pings, setPings] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getReceivedPings()
      .then(r => {
        if (cancelled) return;
        setPings(Array.isArray(r) ? r.slice(0, 10) : []);
        if (Array.isArray(r) && r.some(p => !p.isRead)) {
          markAllPingsRead().then(() => refresh()).catch(() => {});
        }
      })
      .catch(() => { if (!cancelled) setPings([]); });
    return () => { cancelled = true; };
  }, []);

  if (!pings?.length) return null;

  return (
    <div className="px-3 pt-2 pb-1 border-b border-gray-100 max-h-40 overflow-y-auto">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Received</p>
      {pings.map(p => (
        <div key={p.id} className={`flex items-start gap-2 py-1.5 px-1 rounded ${!p.isRead ? "bg-amber-50" : ""}`}>
          <Zap size={13} className={`mt-0.5 shrink-0 ${!p.isRead ? "text-amber-500" : "text-gray-300"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs">
              <span className="font-semibold">{p.senderName || "Someone"}</span>
              <span className="text-gray-500"> · {p.pingLabel}</span>
            </p>
            {p.contextModule && p.contextRecordId && (
              <RecordLink module={p.contextModule} id={p.contextRecordId} label={p.contextRecordRef}
                showModule onNavigate={closePicker} className="text-[11px]" />
            )}
            {p.message && <p className="text-[11px] text-gray-500 truncate">{p.message}</p>}
          </div>
          <span className="text-[10px] text-gray-400 shrink-0">{p.createdAt?.slice(11, 16)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Shared user directory list ───────────────────────────────────────────────
function UserDirectory({ mode, onSelect }) {
  const { conversations } = useComm();
  const recent = [...(Array.isArray(conversations) ? conversations : [])]
    .sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0))
    .slice(0, 5);
  const [search, setSearch]   = useState("");
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDirectory(search || undefined)
      .then(r => {
        if (!cancelled) setUsers(r?.data || (Array.isArray(r) ? r : []));
      })
      .catch(e => {
        if (!cancelled) setError(e?.message || "Failed to load users");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  const modeLabel = mode === "call" ? "Who to call?"
    : mode === "ping" ? "Who to ping?"
    : "Who to message?";

  const modeIcon = mode === "call"
    ? <PhoneCall size={13} className="text-emerald-600" />
    : mode === "ping"
    ? <Zap size={13} className="text-amber-500" />
    : <MessageCircle size={13} className="text-[#003b8e]" />;

  return (
    <div className="flex flex-col h-full">
      {/* Mode label */}
      <div className="px-4 py-2 flex items-center gap-1.5 bg-gray-50 border-b border-gray-100">
        {modeIcon}
        <span className="text-xs font-semibold text-gray-500">{modeLabel}</span>
      </div>

      {mode === "ping" && <ReceivedPings />}

      {/* Recent conversations (chat mode only) — unread first */}
      {mode === "chat" && recent.length > 0 && (
        <div className="px-3 pt-2 pb-1 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Recent</p>
          {recent.map(c => (
            <button
              key={c.conversationId}
              onClick={() => onSelect({ convId: c.conversationId, name: c.name })}
              className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-gray-100 transition text-left"
            >
              <div className="w-7 h-7 rounded-full bg-[#d6e6f2] flex items-center justify-center text-[11px] font-bold text-[#003b8e] shrink-0">
                {c.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between">
                <p className="text-sm font-medium truncate">{c.name}</p>
                {c.unreadCount > 0 && (
                  <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 ml-1 shrink-0">
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 size={20} className="animate-spin text-[#003b8e]" />
            <p className="text-xs text-gray-400">Loading users…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 text-center">
            <p className="text-xs text-red-500">{error}</p>
            <p className="text-[11px] text-gray-400">Make sure the backend is running and migrated.</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-1">
            <p className="text-sm text-gray-400">No users found</p>
            {search && <p className="text-xs text-gray-300">Try a different search term</p>}
          </div>
        ) : (
          users.map(u => (
            <button
              key={u.userId}
              onClick={() => onSelect({ userId: u.userId, name: u.userName, empCode: u.empCode })}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition text-left"
            >
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#d6e6f2] to-[#b8d4ec]
                  flex items-center justify-center text-[13px] font-bold text-[#003b8e]">
                  {u.userName?.[0]?.toUpperCase() || "?"}
                </div>
                {/* Online dot */}
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white
                  ${u.status === "in_call" ? "bg-amber-400"
                    : u.status === "online" ? "bg-emerald-500"
                    : "bg-gray-300"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.userName}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {u.empCode || ""}
                  {u.status === "in_call" ? " · In a call" : u.status === "online" ? " · Online" : ""}
                </p>
              </div>
              {/* Quick action hint */}
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                ${mode === "call" ? "bg-emerald-100 text-emerald-600"
                  : mode === "ping" ? "bg-amber-100 text-amber-600"
                  : "bg-blue-100 text-[#003b8e]"}`}>
                {mode === "call" ? <Phone size={13} />
                  : mode === "ping" ? <Zap size={13} />
                  : <MessageCircle size={13} />}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Chat window ──────────────────────────────────────────────────────────────
function ChatWindow({ convId: initialConvId, userId, userName, onBack }) {
  const { myId, refresh } = useComm();
  const [convId,   setConvId]   = useState(initialConvId || null);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [typing,   setTyping]   = useState([]);
  const [lastId,   setLastId]   = useState(null);
  const bottomRef  = useRef(null);
  const pollRef    = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        let cid = convId;
        if (!cid && userId) {
          const r = await startDirect(userId);
          cid = r?.conversationId;
        }
        if (!cid) { setLoading(false); return; }
        setConvId(cid);
        const r = await getMessages(cid);
        const msgs = r?.messages || [];
        if (!cancelled) {
          setMessages(msgs);
          setLastId(msgs.length ? msgs[msgs.length - 1].id : null);
        }
        // Loading history marks it read on the server — update the badge now
        refresh();
      } catch {}
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [userId, initialConvId]);

  // Stay pinned to the newest message unless the user scrolled up to read history
  const listRef      = useRef(null);
  const stickToBottom = useRef(true);
  const onListScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  const scrollToBottom = () => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: "end" });
  };
  useEffect(scrollToBottom, [messages]);

  // Suggestion chips / reply bar / file preview shrink the list after it rendered
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: "end" });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setOpenConversation(convId);
    return () => setOpenConversation(null);
  }, [convId]);

  useEffect(() => {
    if (!convId) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await getNewMessages(convId, lastId);
        const newMsgs = Array.isArray(r) ? r : [];
        if (newMsgs.length) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const toAdd = newMsgs.filter(m => !ids.has(m.id));
            return toAdd.length ? [...prev, ...toAdd] : prev;
          });
          setLastId(newMsgs[newMsgs.length - 1].id);
          const me = myId();
          if (newMsgs.some(m => !m.isMine && m.senderId !== me)) sounds.messageReceived();
          refresh();
        }
        const t = await getTyping(convId);
        setTyping(Array.isArray(t) ? t : []);
      } catch {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [convId, lastId]);

  const [pendingFile, setPendingFile] = useState(null);
  const [replyTo,     setReplyTo]     = useState(null);
  const [forwardMsg,  setForwardMsg]  = useState(null);
  const [sending,     setSending]     = useState(false);
  const [sendError,   setSendError]   = useState(null);

  const appendNew = async () => {
    const r = await getNewMessages(convId, lastId);
    const newMsgs = Array.isArray(r) ? r : [];
    if (newMsgs.length) {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
      });
      setLastId(newMsgs[newMsgs.length - 1].id);
    }
  };

  // overrideText is used by quick-reply chips; otherwise sends the input box (+ any attached file)
  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!convId || sending || (!text && !pendingFile)) return;
    setSending(true);
    setSendError(null);
    try {
      const replyToId = replyTo?.id;
      if (pendingFile) await sendMedia(convId, pendingFile, { caption: text || undefined, replyToId });
      else             await apiSendMsg(convId, text, { replyToId });
      sounds.messageSent();
      stickToBottom.current = true;
      if (overrideText === undefined) setInput("");
      setPendingFile(null);
      setReplyTo(null);
      await appendNew();
    } catch (e) {
      setSendError(e?.message || "Could not send");
    }
    setSending(false);
  };

  const pickFile = (file) => { setPendingFile(file); setSendError(null); };

  const onPaste = (e) => {
    const file = e.clipboardData?.files?.[0];
    if (!file) return;
    e.preventDefault();
    const err = validateChatFile(file);
    if (err) setSendError(err); else pickFile(file);
  };

  const me = myId();
  const lastMsg = messages[messages.length - 1];
  const showSuggestions = lastMsg && !lastMsg.isDeleted && !(lastMsg.isMine || lastMsg.senderId === me)
    && !input && !pendingFile;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-[#f5f8ff]">
        <button onClick={onBack} className="p-1 rounded hover:bg-gray-200 transition">
          <ChevronLeft size={16} />
        </button>
        <div className="w-7 h-7 rounded-full bg-[#003b8e] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          {userName?.[0]?.toUpperCase() || "?"}
        </div>
        <span className="text-sm font-semibold flex-1 truncate">{userName || "Chat"}</span>
      </div>

      <div ref={listRef} onScroll={onListScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-[#f9fafb]">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8">No messages yet. Say hi! 👋</p>
        ) : (
          messages.map(msg => {
            const mine = msg.isMine || msg.senderId === me;
            const actions = !msg.isDeleted && (
              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                <button title="Reply" onClick={() => setReplyTo(msg)}
                  className="p-1 rounded-full text-gray-400 hover:text-[#003b8e] hover:bg-gray-200">
                  <CornerUpLeft size={13} />
                </button>
                <button title="Forward" onClick={() => setForwardMsg(msg)}
                  className="p-1 rounded-full text-gray-400 hover:text-[#003b8e] hover:bg-gray-200">
                  <Forward size={13} />
                </button>
              </div>
            );
            return (
              <div key={msg.id} className={`group flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                {mine && actions}
                <div className={`max-w-[78%] rounded-2xl px-2.5 py-1.5 text-sm shadow-sm min-w-0
                  ${mine ? "bg-[#003b8e] text-white rounded-br-sm" : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"}`}>
                  {msg.replyTo && <ReplyQuote reply={msg.replyTo} mine={mine} />}
                  {msg.isDeleted ? <em className="text-xs opacity-60">Message deleted</em> : (
                    <>
                      {msg.fileUrl && msg.type !== "text" && (
                        <div className={msg.content ? "mb-1" : ""}>
                          <MessageAttachment type={msg.type} url={msg.fileUrl} name={msg.fileName} size={msg.fileSize} mine={mine} onLoad={scrollToBottom} />
                        </div>
                      )}
                      {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                    </>
                  )}
                  <p className={`text-[10px] mt-0.5 text-right ${mine ? "text-blue-200" : "text-gray-400"}`}>
                    {msg.sentAt?.slice(11, 16)}
                  </p>
                </div>
                {!mine && actions}
              </div>
            );
          })
        )}
        {typing.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-gray-400">
              {typing.map(t => t.userName).join(", ")} typing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pt-2 pb-2 border-t border-gray-200 space-y-2">
        {showSuggestions && (
          <SmartReplies messageId={lastMsg.id} onPick={(text) => send(text)} disabled={sending} />
        )}
        {replyTo && (
          <div className="flex items-center gap-2 pl-2 border-l-2 border-[#003b8e] bg-blue-50/60 rounded-r-lg py-1 pr-1">
            <CornerUpLeft size={13} className="text-[#003b8e] shrink-0" />
            <div className="flex-1 min-w-0 text-[11px]">
              <p className="font-semibold text-[#003b8e]">Replying to {replyTo.isMine || replyTo.senderId === me ? "yourself" : replyTo.senderName}</p>
              <p className="truncate text-gray-500">{replyTo.content || replyTo.fileName || replyTo.type}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500"><X size={13} /></button>
          </div>
        )}
        {pendingFile && <AttachmentPreview file={pendingFile} onRemove={() => setPendingFile(null)} />}
        {sendError && <p className="text-xs text-red-500">{sendError}</p>}
        <div className="flex items-end gap-1.5">
          <AttachButton onPick={pickFile} onError={setSendError} disabled={sending} />
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); if (convId) apiSetTyping(convId).catch(() => {}); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            onPaste={onPaste}
            rows={1}
            placeholder={pendingFile ? "Add a caption…" : "Type a message…"}
            className="flex-1 min-w-0 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#003b8e] transition max-h-24 overflow-y-auto"
          />
          <button onClick={() => send()} disabled={sending || (!input.trim() && !pendingFile)}
            className="w-9 h-9 rounded-full bg-[#003b8e] text-white flex items-center justify-center hover:bg-[#002e6e] transition disabled:opacity-40 shrink-0">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>

      {forwardMsg && (
        <ShareDialog
          messageId={forwardMsg.id}
          preview={
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-2 text-xs text-gray-600 truncate">
              {forwardMsg.fileName ? `📎 ${forwardMsg.fileName}` : forwardMsg.content}
            </div>
          }
          onClose={() => setForwardMsg(null)}
        />
      )}
    </div>
  );
}

function ReplyQuote({ reply, mine }) {
  const text = reply.isDeleted ? "Message deleted" : (reply.content || reply.fileName || reply.type);
  return (
    <div className={`mb-1 border-l-2 pl-2 py-0.5 rounded-r text-[11px]
      ${mine ? "border-blue-200 bg-white/10 text-blue-100" : "border-[#003b8e] bg-gray-50 text-gray-500"}`}>
      <p className="font-semibold">{reply.senderName}</p>
      <p className="truncate">{text}</p>
    </div>
  );
}

// ── Ping type picker ─────────────────────────────────────────────────────────
function PingTypePicker({ target, onBack }) {
  const pathname = usePathname();
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(null); // null | number of pings sent
  const [msg,      setMsg]      = useState("");
  const [error,    setError]    = useState(null);
  const [approval, setApproval] = useState(false);
  const [module,   setModule]   = useState(() => detectModuleFromPath(pathname) || "");
  const [recordIds, setRecordIds] = useState([]);

  const handle = async (pingType) => {
    if (pingType === "approval_request") { setApproval(true); return; }
    setSending(true);
    setError(null);
    try {
      await sendPing(target.userId, pingType, msg || undefined);
      sounds.pingSent();
      setSent(1);
    } catch (e) {
      setError(e?.message || "Could not send ping");
      setSending(false);
    }
  };

  const sendApproval = async () => {
    if (!module || !recordIds.length) return;
    setSending(true);
    setError(null);
    try {
      const r = await sendApprovalPing({ receiverId: target.userId, module, recordIds, message: msg || undefined });
      sounds.pingSent();
      setSent(r?.sent?.length || recordIds.length);
    } catch (e) {
      setError(e?.message || "Could not send approval request");
      setSending(false);
    }
  };

  if (sent) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
        <Zap size={22} className="text-amber-500" />
      </div>
      <p className="text-sm font-semibold">
        {approval ? `${sent} approval ping${sent > 1 ? "s" : ""} sent to ${target.name}!` : `Ping sent to ${target.name}!`}
      </p>
      <button onClick={onBack} className="text-xs text-[#003b8e] underline mt-2">Back</button>
    </div>
  );

  if (approval) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-[#fffbf0]">
        <button onClick={() => { setApproval(false); setError(null); }} className="p-1 rounded hover:bg-gray-200 transition">
          <ChevronLeft size={16} />
        </button>
        <Zap size={14} className="text-orange-500" />
        <span className="text-sm font-semibold truncate">Approval request · {target.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <p className="text-xs text-gray-500">Records waiting on {target.name}&apos;s approval in this project:</p>
        <PendingApprovalPicker
          userId={target.userId}
          module={module}
          onModuleChange={setModule}
          selected={recordIds}
          onSelectedChange={setRecordIds}
        />
        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2} placeholder="Add a note (optional)…"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <div className="p-3 border-t border-gray-200">
        <button onClick={sendApproval} disabled={sending || !module || !recordIds.length}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold
            hover:bg-orange-600 transition disabled:opacity-40">
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          {recordIds.length ? `Send ${recordIds.length} approval ping${recordIds.length > 1 ? "s" : ""}` : "Select records"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-[#fffbf0]">
        <button onClick={onBack} className="p-1 rounded hover:bg-gray-200 transition">
          <ChevronLeft size={16} />
        </button>
        <Zap size={14} className="text-amber-500" />
        <span className="text-sm font-semibold truncate">Ping {target.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <p className="text-xs text-gray-500 mb-3">Choose ping type:</p>
        {PING_TYPES.map(pt => (
          <button
            key={pt.value}
            onClick={() => handle(pt.value)}
            disabled={sending}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200
              hover:border-amber-400 hover:bg-amber-50 transition text-left disabled:opacity-50"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${pt.color} shrink-0`} />
            <span className="text-sm font-medium">{pt.label}</span>
          </button>
        ))}

        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-1">Optional message:</p>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Call confirm ─────────────────────────────────────────────────────────────
function CallConfirm({ target, onBack }) {
  const { answerIncomingCall, closePicker } = useComm();
  const [calling, setCalling] = useState(null); // null | "voice" | "video"
  const [error,   setError]   = useState(null);

  const handle = async (type) => {
    setCalling(type);
    setError(null);
    try {
      const r = await startCall([target.userId], type);
      if (r?.error) throw new Error(r.error);
      answerIncomingCall({
        callId:        r?.callId,
        callType:      type,
        roomCode:      r?.roomCode,
        initiatorName: target.name,
        participants:  [{ userId: target.userId }],
      });
      closePicker();
    } catch (e) {
      setError(e?.message || "Failed to start call");
      setCalling(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#d6e6f2] to-[#b8d4ec]
        flex items-center justify-center text-xl font-bold text-[#003b8e]">
        {target.name?.[0]?.toUpperCase() || "?"}
      </div>
      <div>
        <p className="font-semibold text-base">{target.name}</p>
        <p className="text-xs text-gray-400">{target.empCode || ""}</p>
      </div>
      <p className="text-xs text-gray-500">Choose call type:</p>
      <div className="flex gap-3">
        <button
          onClick={() => handle("voice")}
          disabled={!!calling}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white
            text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {calling === "voice" ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />}
          Voice
        </button>
        <button
          onClick={() => handle("video")}
          disabled={!!calling}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003b8e] text-white
            text-sm font-medium hover:bg-[#002e6e] transition disabled:opacity-50"
        >
          {calling === "video" ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />}
          Video
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 transition mt-1">
        Cancel
      </button>
    </div>
  );
}


// ── Group meet creator ────────────────────────────────────────────────────────
function GroupMeetPanel({ onBack }) {
  const { answerIncomingCall, closePicker } = useComm();
  const [title,    setTitle]    = useState("");
  const [selected, setSelected] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [creating, setCreating] = useState(false);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    setLoading(true);
    getDirectory().then(r => setUsers(r?.data || (Array.isArray(r) ? r : [])))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (u) => setSelected(prev =>
    prev.find(x => x.userId === u.userId) ? prev.filter(x => x.userId !== u.userId) : [...prev, u]
  );

  const create = async () => {
    if (!selected.length) return;
    setCreating(true);
    try {
      const r = await startCall(selected.map(u => u.userId), "video");
      if (r?.error) throw new Error(r.error);
      answerIncomingCall({
        callId:        r?.callId,
        callType:      "video",
        roomCode:      r?.roomCode,
        initiatorName: "Group Meet",
        participants:  selected,
      });
      closePicker();
    } catch {
      setCreating(false);
    }
  };

  const filtered = users.filter(u =>
    !search || u.userName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-indigo-50">
        <button onClick={onBack} className="p-1 rounded hover:bg-gray-200 transition">
          <ChevronLeft size={16} />
        </button>
        <Users size={14} className="text-indigo-600" />
        <span className="text-sm font-semibold flex-1">New Group Meet</span>
        {selected.length > 0 && (
          <span className="text-xs bg-indigo-600 text-white rounded-full px-2 py-0.5">
            {selected.length} selected
          </span>
        )}
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Meeting title (optional)…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400 mb-2"
        />
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
          <Search size={13} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search participants…"
            className="flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
        ) : filtered.map(u => {
          const checked = !!selected.find(x => x.userId === u.userId);
          return (
            <button key={u.userId} onClick={() => toggle(u)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition text-left
                ${checked ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0
                ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                {checked && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <div className="w-8 h-8 rounded-full bg-[#d6e6f2] flex items-center justify-center
                text-[12px] font-bold text-[#003b8e] shrink-0">
                {u.userName?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.userName}</p>
                <p className="text-[11px] text-gray-400">{u.empCode || ""}</p>
              </div>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                u.status === "online" ? "bg-emerald-500" : u.status === "in_call" ? "bg-amber-400" : "bg-gray-300"
              }`} />
            </button>
          );
        })}
      </div>

      <div className="px-3 py-3 border-t border-gray-200">
        <button
          onClick={create}
          disabled={creating || !selected.length}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
            bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700
            transition disabled:opacity-40"
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />}
          Start Meet with {selected.length || "..."} people
        </button>
      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export default function ChatFloat() {
  const { pickerMode, closePicker, activeChatConvId, setActiveChatConvId } = useComm();

  // screen: "list" | "chat" | "ping" | "call" | "group"
  const [screen,   setScreen]   = useState("list");
  const [selected, setSelected] = useState(null); // { userId?, convId?, name, empCode? }

  // When pickerMode changes, reset to list view
  useEffect(() => {
    setScreen("list");
    setSelected(null);
  }, [pickerMode]);

  // If a convId was pushed from outside (e.g. notification click)
  useEffect(() => {
    if (activeChatConvId) {
      setSelected({ convId: activeChatConvId, name: "Chat" });
      setScreen("chat");
    }
  }, [activeChatConvId]);

  // Clicking outside the panel (and outside the FAB) closes it
  useEffect(() => {
    if (!pickerMode) return;
    const onDown = (e) => {
      if (!e.target.closest?.("[data-comm-ui]")) closePicker();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [pickerMode, closePicker]);

  if (!pickerMode) return null;

  const headerColor =
    pickerMode === "call" ? "bg-emerald-700"
    : pickerMode === "ping" ? "bg-amber-600"
    : "bg-[#003b8e]";

  const headerIcon =
    pickerMode === "call" ? <Phone size={15} />
    : pickerMode === "ping" ? <Zap size={15} />
    : <MessageCircle size={15} />;

  const headerLabel =
    pickerMode === "call" ? "Start a Call"
    : pickerMode === "ping" ? "Send a Ping"
    : "Messages";

  const onGroupMeet = () => setScreen("group");

  const onSelectUser = (info) => {
    setSelected(info);
    if (pickerMode === "chat")      setScreen("chat");
    else if (pickerMode === "call") setScreen("call");
    else if (pickerMode === "ping") setScreen("ping");
  };

  return (
    <div data-comm-ui
      className="fixed bottom-[60px] left-[7px] w-[320px] h-[480px] max-h-[calc(100vh-80px)] bg-white rounded-2xl shadow-2xl
        border border-gray-200 flex flex-col overflow-hidden z-[9991]"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
    >
      {/* Panel header */}
      <div className={`flex items-center justify-between px-4 py-3 text-white ${headerColor}`}>
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className="text-sm font-semibold">{headerLabel}</span>
        </div>
        <button onClick={closePicker} className="p-1 rounded hover:bg-black/20 transition">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {screen === "list" && (
          <>
            {pickerMode === "call" && (
              <button
                onClick={onGroupMeet}
                className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 border-b
                  border-indigo-100 hover:bg-indigo-100 transition text-left"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                  <Users size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-700">Group Video Meet</p>
                  <p className="text-[11px] text-indigo-400">Start a meeting with multiple people</p>
                </div>
              </button>
            )}
            <UserDirectory mode={pickerMode} onSelect={onSelectUser} />
          </>
        )}
        {screen === "chat" && selected && (
          <ChatWindow
            convId={selected.convId}
            userId={selected.userId}
            userName={selected.name}
            onBack={() => { setScreen("list"); setSelected(null); setActiveChatConvId(null); }}
          />
        )}
        {screen === "ping" && selected && (
          <PingTypePicker
            target={selected}
            onBack={() => { setScreen("list"); setSelected(null); }}
          />
        )}
        {screen === "call" && selected && (
          <CallConfirm
            target={selected}
            onBack={() => { setScreen("list"); setSelected(null); }}
          />
        )}
        {screen === "group" && (
          <GroupMeetPanel onBack={() => setScreen("list")} />
        )}
      </div>
    </div>
  );
}
