"use client";

import {
  ChevronRight, Clock, File as FileIcon, FileText, Folder, HardDrive, ImageIcon, Loader2, Search, Server, Users, X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { accepts, browse, extOf, fetchAsFile } from "@/lib/edoxDrive";

const TABS = [
  { key: "mine", label: "My Drive", icon: HardDrive },
  { key: "drives", label: "Shared drives", icon: Server },
  { key: "shared", label: "Shared with me", icon: Users },
  { key: "recent", label: "Recent", icon: Clock, filesOnly: true },
];

function iconFor(item) {
  if (item.kind === "folder") return <Folder className="w-4 h-4 text-gray-500 shrink-0" fill="currentColor" fillOpacity={0.15} />;
  const ext = extOf(item.name);
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return <ImageIcon className="w-4 h-4 text-violet-500 shrink-0" />;
  if (ext === "pdf") return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
  return <FileIcon className="w-4 h-4 text-gray-400 shrink-0" />;
}

function size(n) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Browse the person's Edox Drive.
 *   mode="file":   pick a file → onPick(File)   (only files matching `accept`)
 *   mode="folder": choose a folder → onPick(folderId, folderName)
 */
export default function DriveBrowser({ mode = "file", accept, title, actionLabel = "Save here", onPick, onClose }) {
  const [tab, setTab] = useState("mine");
  const [rootId, setRootId] = useState(null);
  const [view, setView] = useState({ kind: "loading" });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);

  const open = useCallback(async (next) => {
    setView({ kind: "loading" });
    try {
      if (next.kind === "folder") {
        const d = await browse({ folder: next.id });
        setView({ kind: "folder", node: d.node, path: d.path || [], items: d.items });
      } else if (next.kind === "drives") {
        const d = await browse({ view: "drives" });
        setView({ kind: "list", items: d.drives.map((x) => ({ id: x.root_id, name: x.name, kind: "folder", drive: true })) });
      } else if (next.kind === "shared") {
        setView({ kind: "list", items: (await browse({ view: "shared-with-me" })).items });
      } else if (next.kind === "recent") {
        setView({ kind: "list", items: (await browse({ view: "recent" })).items });
      } else if (next.kind === "search") {
        setView({ kind: "list", items: (await browse({ q: next.q })).items, search: next.q });
      }
    } catch (e) {
      setView({ kind: "error", message: e.message });
    }
  }, []);

  useEffect(() => {
    browse().then((d) => {
      setRootId(d.root_id);
      open({ kind: "folder", id: d.root_id });
    }).catch((e) => setView({ kind: "error", message: e.message }));
  }, [open]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function switchTab(key) {
    setTab(key);
    setQ("");
    if (key === "mine") open({ kind: "folder", id: rootId });
    else open({ kind: key });
  }

  async function choose(item) {
    if (item.kind === "folder") return open({ kind: "folder", id: item.id });
    if (mode !== "file") return;
    setBusy(item.id);
    try {
      const file = await fetchAsFile(item);
      onPick(file);
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
    setBusy(null);
  }

  const items = (view.items || []).filter((i) => i.kind === "folder" || mode === "file");
  const here = view.kind === "folder" ? view.node : null;
  const canSaveHere = mode === "folder" && here?.can_edit;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/50" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
           className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] max-h-[640px] flex flex-col overflow-hidden"
           onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <img src="/assets/brand/edox-mark.png" alt="" className="w-6 h-6" />
          <h2 className="font-semibold text-gray-800 flex-1 truncate">{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          <nav className="sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r border-gray-100 p-2 flex sm:flex-col gap-1 overflow-x-auto">
            {TABS.filter((t) => !(t.filesOnly && mode === "folder")).map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => switchTab(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] whitespace-nowrap ${tab === key ? "bg-violet-50 text-violet-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0 flex flex-col">
            {mode === "file" && (
              <form className="p-2 border-b border-gray-100" onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) {
                  setTab("search");
                  open({ kind: "search", q: q.trim() });
                }
              }}>
                <label className="relative block">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your Drive"
                         className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-violet-400" />
                </label>
              </form>
            )}

            {view.kind === "folder" && (
              <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 text-[13px] border-b border-gray-50">
                {[...view.path, view.node].map((c, i, all) => (
                  <span key={c.id} className="flex items-center gap-0.5">
                    {i < all.length - 1
                      ? <button type="button" className="px-1.5 py-0.5 rounded text-gray-500 hover:bg-gray-100" onClick={() => open({ kind: "folder", id: c.id })}>{c.name}</button>
                      : <span className="px-1.5 font-semibold text-gray-800">{c.name}</span>}
                    {i < all.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                  </span>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {view.kind === "loading" && <div className="p-6 text-[13px] text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
              {view.kind === "error" && <div className="p-6 text-[13px] text-red-600">{view.message}</div>}
              {(view.kind === "folder" || view.kind === "list") && items.length === 0 && (
                <div className="p-6 text-[13px] text-gray-400">{mode === "folder" ? "No folders here." : "Nothing here."}</div>
              )}
              <ul>
                {items.map((item) => {
                  const fits = item.kind === "folder" || accepts(accept, item.name);
                  const blocked = item.kind === "file" && item.can_download === false;
                  const off = !fits || blocked;
                  return (
                    <li key={item.id}>
                      <button type="button" disabled={off || busy} onClick={() => choose(item)}
                              title={blocked ? "The owner turned off downloads for this file" : !fits ? "This file type can't be attached here" : ""}
                              className="w-full flex items-center gap-3 px-4 py-2 text-left text-[13px] border-b border-gray-50 hover:bg-violet-50/50 disabled:opacity-40 disabled:hover:bg-transparent">
                        {busy === item.id ? <Loader2 className="w-4 h-4 animate-spin text-violet-500" /> : iconFor(item)}
                        <span className="flex-1 truncate text-gray-700">{item.name}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">{item.kind === "file" ? size(item.size) : ""}</span>
                        {item.kind === "folder" && <ChevronRight className="w-4 h-4 text-gray-300" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {mode === "folder" && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
                <span className="flex-1 text-[12px] text-gray-500 truncate">
                  {here ? (here.can_edit ? `Save into “${here.name}”` : "You can only view this folder — choose another.") : "Open a folder."}
                </span>
                <button type="button" onClick={onClose} className="px-3 h-9 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100">Cancel</button>
                <button type="button" disabled={!canSaveHere || busy} onClick={async () => {
                  setBusy("save");
                  const ok = await onPick(here.id, here.name);
                  setBusy(null);
                  if (ok !== false) onClose();
                }} className="px-4 h-9 rounded-lg text-[13px] font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40">
                  {busy === "save" ? "Saving…" : actionLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
