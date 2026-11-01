"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Search } from "lucide-react";
import { getDirectory } from "@/lib/commApi";

// Multi-select list of users. Used for new groups, inviting into a chat,
// group meets and adding people to a live call.
export default function PeoplePicker({
  title, icon, ctaLabel, ctaIcon, onBack, onSubmit,
  excludeIds = [], askName = false, namePlaceholder = "Group name…", requireName = false,
}) {
  const [users,    setUsers]    = useState([]);
  const [selected, setSelected] = useState([]);
  const [search,   setSearch]   = useState("");
  const [name,     setName]     = useState("");
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    getDirectory().then(r => setUsers(r?.data || (Array.isArray(r) ? r : [])))
      .catch(() => setError("Failed to load users")).finally(() => setLoading(false));
  }, []);

  const exclude = new Set(excludeIds.map(Number));
  const q = search.toLowerCase();
  const list = users.filter(u => !exclude.has(Number(u.userId))
    && (!q || u.userName?.toLowerCase().includes(q) || u.empCode?.toLowerCase().includes(q)));
  const isSel = (u) => selected.some(x => x.userId === u.userId);
  const toggle = (u) => setSelected(p => isSel(u) ? p.filter(x => x.userId !== u.userId) : [...p, u]);

  const submit = async () => {
    setBusy(true); setError(null);
    try { await onSubmit(selected, name.trim()); }
    catch (e) { setError(e?.message || "Something went wrong"); setBusy(false); }
  };
  const disabled = busy || !selected.length || (requireName && !name.trim());

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-indigo-50">
        <button onClick={onBack} className="p-1 rounded hover:bg-gray-200"><ChevronLeft size={16} /></button>
        {icon}
        <span className="text-sm font-semibold flex-1 truncate">{title}</span>
        {selected.length > 0 && (
          <span className="text-xs bg-indigo-600 text-white rounded-full px-2 py-0.5">{selected.length}</span>
        )}
      </div>
      <div className="px-3 py-2 border-b border-gray-100 space-y-2">
        {askName && (
          <input value={name} onChange={e => setName(e.target.value)} placeholder={namePlaceholder}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400" />
        )}
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
          <Search size={13} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people…"
            className="flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
        ) : list.map(u => (
          <button key={u.userId} onClick={() => toggle(u)}
            className={`w-full flex items-center gap-3 px-4 py-2 text-left ${isSel(u) ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 text-[10px] text-white font-bold
              ${isSel(u) ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>{isSel(u) && "✓"}</span>
            <span className="w-8 h-8 rounded-full bg-[#d6e6f2] flex items-center justify-center text-[12px] font-bold text-[#003b8e] shrink-0">
              {u.userName?.[0]?.toUpperCase()}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium truncate">{u.userName}</span>
              <span className="block text-[11px] text-gray-400">{u.empCode || ""}</span>
            </span>
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              u.status === "online" ? "bg-emerald-500" : u.status === "in_call" ? "bg-amber-400" : "bg-gray-300"}`} />
          </button>
        ))}
      </div>
      <div className="px-3 py-3 border-t border-gray-200">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <button onClick={submit} disabled={disabled}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin" /> : ctaIcon}
          {ctaLabel(selected.length)}
        </button>
      </div>
    </div>
  );
}
