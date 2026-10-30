"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, ChevronLeft, Send, Search, MessageCircle,
  Phone, Zap, Loader2, PhoneCall, Video,
} from "lucide-react";
import { useComm } from "@/context/CommContext";
import {
  getDirectory,
  startDirect,
  getMessages,
  getNewMessages,
  sendMessage as apiSendMsg,
  setTyping as apiSetTyping,
  getTyping,
  sendPing,
  startCall,
} from "@/lib/commApi";

const PING_TYPES = [
  { value: "ping",             label: "Ping",              color: "bg-blue-500" },
  { value: "nudge",            label: "Nudge",             color: "bg-purple-500" },
  { value: "urgent",           label: "URGENT",            color: "bg-red-600" },
  { value: "approval_request", label: "Need Approval",     color: "bg-orange-500" },
  { value: "review",           label: "Need Review",       color: "bg-indigo-500" },
  { value: "attention",        label: "Attention Required", color: "bg-amber-500" },
];

// ── Shared user directory list ───────────────────────────────────────────────
function UserDirectory({ mode, onSelect }) {
  const { conversations } = useComm();
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

      {/* Recent conversations (chat mode only) */}
      {mode === "chat" && conversations.length > 0 && (
        <div className="px-3 pt-2 pb-1 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Recent</p>
          {conversations.slice(0, 3).map(c => (
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
  const { myId } = useComm();
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
      } catch {}
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [userId, initialConvId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
        }
        const t = await getTyping(convId);
        setTyping(Array.isArray(t) ? t : []);
      } catch {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [convId, lastId]);

  const handleSend = async () => {
    if (!input.trim() || !convId) return;
    const text = input.trim();
    setInput("");
    try {
      await apiSendMsg(convId, text);
      const r = await getNewMessages(convId, lastId);
      const newMsgs = Array.isArray(r) ? r : [];
      if (newMsgs.length) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
        });
        setLastId(newMsgs[newMsgs.length - 1].id);
      }
    } catch {}
  };

  const me = myId();

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

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-[#f9fafb]">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8">No messages yet. Say hi! 👋</p>
        ) : (
          messages.map(msg => {
            const mine = msg.isMine || msg.senderId === me;
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm shadow-sm
                  ${mine ? "bg-[#003b8e] text-white rounded-br-sm" : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"}`}>
                  {msg.isDeleted ? <em className="text-xs opacity-60">Message deleted</em> : msg.content}
                  <p className={`text-[10px] mt-0.5 text-right ${mine ? "text-blue-200" : "text-gray-400"}`}>
                    {msg.sentAt?.slice(11, 16)}
                  </p>
                </div>
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

      <div className="px-3 py-2 border-t border-gray-200 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => { setInput(e.target.value); if (convId) apiSetTyping(convId).catch(() => {}); }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#003b8e] transition max-h-24 overflow-y-auto"
        />
        <button onClick={handleSend} disabled={!input.trim()}
          className="w-9 h-9 rounded-full bg-[#003b8e] text-white flex items-center justify-center hover:bg-[#002e6e] transition disabled:opacity-40 shrink-0">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Ping type picker ─────────────────────────────────────────────────────────
function PingTypePicker({ target, onBack }) {
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [msg,     setMsg]     = useState("");

  const handle = async (pingType) => {
    setSending(true);
    try {
      await sendPing(target.userId, pingType, msg || undefined);
      setSent(true);
    } catch {
      setSending(false);
    }
  };

  if (sent) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
        <Zap size={22} className="text-amber-500" />
      </div>
      <p className="text-sm font-semibold">Ping sent to {target.name}!</p>
      <button onClick={onBack} className="text-xs text-[#003b8e] underline mt-2">Back</button>
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
        </div>
      </div>
    </div>
  );
}

// ── Call confirm ─────────────────────────────────────────────────────────────
function CallConfirm({ target, callType, onBack }) {
  const { answerIncomingCall } = useComm();
  const [calling, setCalling] = useState(false);

  const handle = async () => {
    setCalling(true);
    try {
      const r = await startCall([target.userId], callType);
      answerIncomingCall({
        callId:        r?.callId,
        callType,
        roomCode:      r?.roomCode,
        initiatorName: target.name,
        participants:  [{ userId: target.userId }],
      });
    } catch {
      setCalling(false);
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
      <div className="flex gap-3">
        <button
          onClick={handle}
          disabled={calling}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003b8e] text-white text-sm font-medium hover:bg-[#002e6e] transition disabled:opacity-50"
        >
          {calling ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />}
          {callType === "video" ? "Video Call" : "Voice Call"}
        </button>
      </div>
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 transition">
        Cancel
      </button>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export default function ChatFloat() {
  const { pickerMode, closePicker, activeChatConvId, setActiveChatConvId } = useComm();

  // screen: "list" | "chat" | "ping" | "call"
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

  const onSelectUser = (info) => {
    setSelected(info);
    if (pickerMode === "chat")      setScreen("chat");
    else if (pickerMode === "call") setScreen("call");
    else if (pickerMode === "ping") setScreen("ping");
  };

  return (
    <div
      className="fixed bottom-20 left-5 w-[320px] h-[480px] bg-white rounded-2xl shadow-2xl
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
          <UserDirectory mode={pickerMode} onSelect={onSelectUser} />
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
            callType={pickerMode === "call" ? "voice" : "voice"}
            onBack={() => { setScreen("list"); setSelected(null); }}
          />
        )}
      </div>
    </div>
  );
}
