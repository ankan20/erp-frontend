"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, Send, Search, MessageCircle, Loader2 } from "lucide-react";
import { useComm } from "@/context/CommContext";
import {
  getDirectory,
  startDirect,
  getMessages,
  getNewMessages,
  sendMessage as apiSendMsg,
  setTyping as apiSetTyping,
  getTyping,
} from "@/lib/commApi";

// ── User List Panel ──────────────────────────────────────────────────────────
function UserListPanel({ onSelectUser }) {
  const { conversations } = useComm();
  const [search, setSearch]  = useState("");
  const [users, setUsers]    = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDirectory(search || undefined)
      .then(r => { if (!cancelled) setUsers(r?.data || r || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Recent conversations
        </p>
        {conversations.slice(0, 3).map(c => (
          <button
            key={c.conversationId}
            onClick={() => onSelectUser({ convId: c.conversationId, name: c.name })}
            className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-gray-100 transition text-left"
          >
            <div className="w-7 h-7 rounded-full bg-[#d6e6f2] flex items-center justify-center text-[11px] font-bold text-[#003b8e] shrink-0">
              {c.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.name}</p>
              {c.unreadCount > 0 && (
                <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">
                  {c.unreadCount}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {/* Directory */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">No users found</p>
        ) : (
          users.map(u => (
            <button
              key={u.userId}
              onClick={() => onSelectUser({ userId: u.userId, name: u.userName })}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left"
            >
              {/* Avatar with online dot */}
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#d6e6f2] flex items-center justify-center text-[12px] font-bold text-[#003b8e]">
                  {u.userName?.[0]?.toUpperCase() || "?"}
                </div>
                {u.status === "online" || u.status === "in_call" ? (
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white
                    ${u.status === "in_call" ? "bg-amber-400" : "bg-emerald-500"}`} />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.userName}</p>
                <p className="text-[11px] text-gray-400 truncate">{u.empCode || ""}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Chat Window ──────────────────────────────────────────────────────────────
function ChatWindow({ convId: initialConvId, userId, userName, onBack }) {
  const { myId } = useComm();
  const [convId,     setConvId]     = useState(initialConvId || null);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [typing,     setTyping]     = useState([]);
  const [lastId,     setLastId]     = useState(null);
  const bottomRef  = useRef(null);
  const pollRef    = useRef(null);
  const typingTimer = useRef(null);

  // Bootstrap: ensure we have a conversation
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
        if (!cid) return;
        setConvId(cid);

        const r = await getMessages(cid);
        const msgs = r?.messages || [];
        if (!cancelled) {
          setMessages(msgs);
          setLastId(msgs.length > 0 ? msgs[msgs.length - 1].id : null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [userId, initialConvId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages + typing
  useEffect(() => {
    if (!convId) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await getNewMessages(convId, lastId);
        const newMsgs = Array.isArray(r) ? r : [];
        if (newMsgs.length > 0) {
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

  const handleInput = (e) => {
    setInput(e.target.value);
    if (!convId) return;
    clearTimeout(typingTimer.current);
    apiSetTyping(convId).catch(() => {});
  };

  const handleSend = async () => {
    if (!input.trim() || !convId) return;
    const text = input.trim();
    setInput("");
    try {
      await apiSendMsg(convId, text);
      const r = await getNewMessages(convId, lastId);
      const newMsgs = Array.isArray(r) ? r : [];
      if (newMsgs.length > 0) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
        });
        setLastId(newMsgs[newMsgs.length - 1].id);
      }
    } catch {}
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const me = myId();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-[#f5f8ff]">
        <button onClick={onBack} className="p-1 rounded hover:bg-gray-200 transition">
          <ChevronLeft size={16} />
        </button>
        <div className="w-7 h-7 rounded-full bg-[#003b8e] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          {userName?.[0]?.toUpperCase() || "?"}
        </div>
        <span className="text-sm font-semibold flex-1 truncate">{userName || "Chat"}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-[#f9fafb]">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">No messages yet. Say hi!</p>
        ) : (
          messages.map(msg => {
            const mine = msg.isMine || msg.senderId === me;
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm shadow-sm
                  ${mine
                    ? "bg-[#003b8e] text-white rounded-br-sm"
                    : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                  }`}>
                  {msg.isDeleted
                    ? <em className="text-xs opacity-60">Message deleted</em>
                    : msg.content
                  }
                  <p className={`text-[10px] mt-0.5 text-right
                    ${mine ? "text-blue-200" : "text-gray-400"}`}>
                    {msg.sentAt?.slice(11, 16)}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typing.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-gray-400">
              {typing.map(t => t.userName).join(", ")} typing…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-200 flex items-end gap-2">
        <textarea
          value={input}
          onChange={handleInput}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none
            focus:border-[#003b8e] transition max-h-24 overflow-y-auto"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-9 h-9 rounded-full bg-[#003b8e] text-white flex items-center justify-center
            hover:bg-[#002e6e] transition disabled:opacity-40 shrink-0"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Main Float Panel ─────────────────────────────────────────────────────────
export default function ChatFloat() {
  const { chatOpen, closeChat, activeChatConvId, setActiveChatConvId } = useComm();
  const [selected, setSelected] = useState(null); // { convId?, userId?, name }

  useEffect(() => {
    if (activeChatConvId) {
      setSelected({ convId: activeChatConvId, name: "Chat" });
    }
  }, [activeChatConvId]);

  if (!chatOpen) return null;

  return (
    <div
      className="fixed bottom-20 left-5 w-[320px] h-[480px] bg-white rounded-2xl shadow-2xl
        border border-gray-200 flex flex-col overflow-hidden z-[9991]"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#003b8e] text-white">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} />
          <span className="text-sm font-semibold">Messages</span>
        </div>
        <button onClick={closeChat} className="p-1 rounded hover:bg-[#002e6e] transition">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <ChatWindow
            convId={selected.convId}
            userId={selected.userId}
            userName={selected.name}
            onBack={() => { setSelected(null); setActiveChatConvId(null); }}
          />
        ) : (
          <UserListPanel
            onSelectUser={(info) => setSelected(info)}
          />
        )}
      </div>
    </div>
  );
}
