"use client";

import { useEffect, useState } from "react";
import { X, Search, Send, Loader2, Forward } from "lucide-react";
import { getDirectory, forwardMessage, shareToUser } from "@/lib/commApi";
import AttachmentPreview from "./AttachmentPreview";

// Pick people and send them something, with an optional caption.
//   Forward an existing chat message:  <ShareDialog messageId={msg.id} onClose={...} />
//   Share a new file from any page:    <ShareDialog file={pdfFile} initialCaption="PO #12" onClose={...} />
//   Share plain text:                  <ShareDialog initialCaption="Please check indent 45" onClose={...} />
export default function ShareDialog({ messageId, file, preview, initialCaption = "", title, onClose, onDone }) {
  const [users,    setUsers]    = useState([]);
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState([]);
  const [caption,  setCaption]  = useState(initialCaption);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    getDirectory()
      .then(r => setUsers(r?.data || (Array.isArray(r) ? r : [])))
      .catch(() => setError("Could not load people"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (u) => setSelected(prev =>
    prev.some(x => x.userId === u.userId) ? prev.filter(x => x.userId !== u.userId) : [...prev, u]);

  const canSend = selected.length > 0 && (messageId || file || caption.trim()) && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const userIds = selected.map(u => u.userId);
      if (messageId) {
        await forwardMessage(messageId, { userIds, caption: caption.trim() || undefined });
      } else {
        await Promise.all(userIds.map(uid => shareToUser(uid, { file, text: caption.trim() || undefined })));
      }
      onDone?.(userIds);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Could not send");
      setSending(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = users.filter(u => !q || u.userName?.toLowerCase().includes(q) || u.empCode?.toLowerCase().includes(q));

  return (
    <div data-comm-ui className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#003b8e] text-white">
          <Forward size={16} />
          <span className="text-sm font-semibold flex-1">{title || (messageId ? "Forward message" : "Share")}</span>
          {selected.length > 0 && <span className="text-[11px] bg-white/20 rounded-full px-2 py-0.5">{selected.length} selected</span>}
          <button onClick={onClose} className="p-1 rounded hover:bg-black/20"><X size={16} /></button>
        </div>

        {(file || preview) && (
          <div className="px-3 pt-3">{file ? <AttachmentPreview file={file} /> : preview}</div>
        )}

        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
            <Search size={13} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people…"
              className="flex-1 bg-transparent text-sm outline-none" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[140px] py-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">No people found</p>
          ) : filtered.map(u => {
            const on = selected.some(x => x.userId === u.userId);
            return (
              <button key={u.userId} type="button" onClick={() => toggle(u)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${on ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0
                  ${on ? "bg-[#003b8e] border-[#003b8e]" : "border-gray-300"}`}>
                  {on && <span className="text-white text-[10px] font-bold">✓</span>}
                </div>
                <div className="w-8 h-8 rounded-full bg-[#d6e6f2] flex items-center justify-center text-[12px] font-bold text-[#003b8e] shrink-0">
                  {u.userName?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.userName}</p>
                  <p className="text-[11px] text-gray-400">{u.empCode || ""}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-200 p-3 space-y-2">
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2}
            placeholder={messageId ? "Add a message (optional)…" : "Add a caption…"}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#003b8e]" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="button" onClick={send} disabled={!canSend}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#003b8e] text-white text-sm font-semibold
              hover:bg-[#002e6e] transition disabled:opacity-40">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {messageId ? "Forward" : "Send"}{selected.length ? ` to ${selected.length}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
